import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const resolveChurchIdForHostMock = vi.fn();
vi.mock('../_lib/resolveChurchByHost.js', () => ({
  resolveChurchIdForHost: resolveChurchIdForHostMock,
}));

const CENTRAL_HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';

interface MockOpts {
  simulationRows?: { monthly_spend_micro_usd: number; projected_impact_micro_usd: number; allocations: unknown }[];
  walletRows?: { headline_cause: string; projected_monthly_impact_micro_usd: number }[];
}

function makeSupabaseMock(opts: MockOpts) {
  return {
    from(table: string) {
      if (table === 'workshop_simulations') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: opts.simulationRows ?? [],
                error: null,
                count: (opts.simulationRows ?? []).length,
              }),
          }),
        };
      }
      if (table === 'workshop_wallet_activations') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: opts.walletRows ?? [],
                error: null,
                count: (opts.walletRows ?? []).length,
              }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

let supabaseMockOpts: MockOpts = {};
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => makeSupabaseMock(supabaseMockOpts)),
}));

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    end() { return this; },
    setHeader() { return this; },
  };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown };
}

function mockReq(): VercelRequest {
  return { method: 'GET', headers: { host: 'grace-members.vercel.app' } } as unknown as VercelRequest;
}

describe('GET /api/workshop/aggregate', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    resolveChurchIdForHostMock.mockReset();
    resolveChurchIdForHostMock.mockResolvedValue(CENTRAL_HENDERSON_CHURCH_ID);
    supabaseMockOpts = {
      simulationRows: [
        { monthly_spend_micro_usd: 2_000_000_000, projected_impact_micro_usd: 40_000_000, allocations: [{ cause: 'missions', pct: 100 }] },
      ],
      walletRows: [{ headline_cause: 'missions', projected_monthly_impact_micro_usd: 40_000_000 }],
    };
  });

  it('404s when no domain resolves to a church', async () => {
    resolveChurchIdForHostMock.mockResolvedValue(null);
    const { default: handler } = await import('./_aggregate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(404);
  });

  it('returns the existing spend-stage aggregate unchanged', async () => {
    const { default: handler } = await import('./_aggregate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    const body = res.body as { participantCount: number; totalProjectedImpactUsd: number };
    expect(body.participantCount).toBe(1);
    expect(body.totalProjectedImpactUsd).toBe(40);
  });

  it('adds a wallet section computed from workshop_wallet_activations', async () => {
    const { default: handler } = await import('./_aggregate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    const body = res.body as { wallet: { activationCount: number; totalProjectedImpactUsd: number; byCauseUsd: Record<string, number> } };
    expect(body.wallet.activationCount).toBe(1);
    expect(body.wallet.totalProjectedImpactUsd).toBe(40);
    expect(body.wallet.byCauseUsd.missions).toBe(40);
  });

  it('returns a zeroed wallet section when there are no wallet activations yet', async () => {
    supabaseMockOpts.walletRows = [];
    const { default: handler } = await import('./_aggregate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    const body = res.body as { wallet: { activationCount: number; totalProjectedImpactUsd: number } };
    expect(body.wallet.activationCount).toBe(0);
    expect(body.wallet.totalProjectedImpactUsd).toBe(0);
  });
});
