import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const resolveStaffActorMock = vi.fn();
vi.mock('../_lib/authz.js', () => ({
  resolveStaffActor: (...args: unknown[]) => resolveStaffActorMock(...args),
}));

const CENTRAL_HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';
const SIMULATION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

interface MockOpts {
  simulationRows?: {
    id: string; display_name: string | null; monthly_spend_micro_usd: number;
    allocations: unknown; illustrative_rate_bps: number; projected_impact_micro_usd: number; created_at: string;
  }[];
  walletRows?: { simulation_id: string; headline_cause: string; projected_monthly_impact_micro_usd: number; created_at: string }[];
}

function makeSupabaseMock(opts: MockOpts) {
  return {
    from(table: string) {
      if (table === 'workshop_simulations') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: opts.simulationRows ?? [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'workshop_wallet_activations') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: opts.walletRows ?? [], error: null }),
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
  return { method: 'GET', headers: {} } as unknown as VercelRequest;
}

describe('GET /api/workshop/participants', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    resolveStaffActorMock.mockReset();
    resolveStaffActorMock.mockResolvedValue({
      churchId: CENTRAL_HENDERSON_CHURCH_ID,
      permissions: new Set(['analytics.view']),
    });
    supabaseMockOpts = {
      simulationRows: [
        {
          id: SIMULATION_ID, display_name: 'Jane', monthly_spend_micro_usd: 2_000_000_000,
          allocations: [{ cause: 'missions', pct: 100 }], illustrative_rate_bps: 200,
          projected_impact_micro_usd: 40_000_000, created_at: '2026-09-07T00:00:00Z',
        },
      ],
      walletRows: [],
    };
  });

  it('403s when the actor lacks analytics.view', async () => {
    resolveStaffActorMock.mockResolvedValue({ churchId: CENTRAL_HENDERSON_CHURCH_ID, permissions: new Set() });
    const { default: handler } = await import('./_participants.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(403);
  });

  it('includes workshopUrl for Central Henderson', async () => {
    const { default: handler } = await import('./_participants.js');
    const res = mockRes();
    await handler(mockReq(), res);
    const body = res.body as { workshopUrl: string | null };
    expect(body.workshopUrl).toBe('https://grace-members.vercel.app/workshop.html');
  });

  it('a participant with no wallet activation gets walletActivation: null, not an error', async () => {
    const { default: handler } = await import('./_participants.js');
    const res = mockRes();
    await handler(mockReq(), res);
    const body = res.body as { participants: { walletActivation: unknown }[] };
    expect(body.participants).toHaveLength(1);
    expect(body.participants[0].walletActivation).toBeNull();
  });

  it('merges a wallet activation onto its matching participant by simulation_id', async () => {
    supabaseMockOpts.walletRows = [
      { simulation_id: SIMULATION_ID, headline_cause: 'missions', projected_monthly_impact_micro_usd: 40_000_000, created_at: '2026-09-07T00:05:00Z' },
    ];
    const { default: handler } = await import('./_participants.js');
    const res = mockRes();
    await handler(mockReq(), res);
    const body = res.body as {
      walletActivationCount: number;
      totalWalletProjectedImpactUsd: number;
      participants: { id: string; walletActivation: { headlineCause: string; projectedMonthlyImpactUsd: number } | null }[];
    };
    expect(body.walletActivationCount).toBe(1);
    expect(body.totalWalletProjectedImpactUsd).toBe(40);
    expect(body.participants[0].walletActivation).toEqual({
      headlineCause: 'missions',
      projectedMonthlyImpactUsd: 40,
      createdAt: '2026-09-07T00:05:00Z',
    });
  });
});
