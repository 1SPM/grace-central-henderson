import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const resolveChurchIdForHostMock = vi.fn();
vi.mock('../_lib/resolveChurchByHost.js', () => ({
  resolveChurchIdForHost: resolveChurchIdForHostMock,
}));

const enforceRateLimitMock = vi.fn();
vi.mock('../_lib/rateLimit/limiter.js', () => ({
  clientIp: () => '1.2.3.4',
  enforceRateLimit: (...args: unknown[]) => enforceRateLimitMock(...args),
}));

const CENTRAL_HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_CHURCH_ID = '22222222-2222-2222-2222-222222222222';
const SIMULATION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

interface MockOpts {
  parentRow?: { id: string; display_name: string | null; projected_impact_micro_usd: number } | null;
  parentError?: unknown;
  upsertResult?: { data: { id: string } | null; error: unknown };
  aggregateRows?: { projected_monthly_impact_micro_usd: number }[];
}

let lastUpsertCall: { payload: Record<string, unknown>; opts: unknown } | null = null;

function makeSupabaseMock(opts: MockOpts) {
  return {
    from(table: string) {
      if (table === 'workshop_simulations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: opts.parentRow ?? null, error: opts.parentError ?? null }),
              }),
            }),
          }),
        };
      }
      if (table === 'workshop_wallet_activations') {
        return {
          upsert: (payload: Record<string, unknown>, upsertOpts: unknown) => {
            lastUpsertCall = { payload, opts: upsertOpts };
            return {
              select: () => ({
                single: () => Promise.resolve(opts.upsertResult ?? { data: { id: 'activation-1' }, error: null }),
              }),
            };
          },
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: opts.aggregateRows ?? [],
                error: null,
                count: (opts.aggregateRows ?? []).length,
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

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { host: 'grace-members.vercel.app' },
    body: { simulationId: SIMULATION_ID, headlineCause: 'missions' },
    ...overrides,
  } as unknown as VercelRequest;
}

describe('POST /api/workshop/wallet-activate', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    resolveChurchIdForHostMock.mockReset();
    resolveChurchIdForHostMock.mockResolvedValue(CENTRAL_HENDERSON_CHURCH_ID);
    enforceRateLimitMock.mockReset();
    enforceRateLimitMock.mockResolvedValue(false);
    lastUpsertCall = null;
    supabaseMockOpts = {
      parentRow: { id: SIMULATION_ID, display_name: 'Jane', projected_impact_micro_usd: 40_000_000 },
    };
  });

  it('resolves the church from the Host header', async () => {
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(resolveChurchIdForHostMock).toHaveBeenCalledWith('grace-members.vercel.app', expect.anything());
    expect(res.statusCode).toBe(200);
  });

  it('rejects a headlineCause outside the allowlist', async () => {
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq({ body: { simulationId: SIMULATION_ID, headlineCause: 'vacation_fund' } }), res);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe('invalid_request');
  });

  it('rejects a request missing simulationId', async () => {
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq({ body: { headlineCause: 'missions' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('404s on an unknown simulationId', async () => {
    supabaseMockOpts.parentRow = null;
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: string }).error).toBe('unknown_simulation');
  });

  it('404s on a simulationId that belongs to a different church (cross-tenant guard)', async () => {
    // The mock's parent lookup itself is scoped by church_id in the real
    // query chain (.eq('id', ...).eq('church_id', ...)) -- simulate the
    // cross-tenant case the same way the real DB would: no matching row.
    resolveChurchIdForHostMock.mockResolvedValue(OTHER_CHURCH_ID);
    supabaseMockOpts.parentRow = null;
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(404);
  });

  it('upserts on conflict simulation_id rather than inserting a duplicate', async () => {
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(lastUpsertCall).not.toBeNull();
    expect(lastUpsertCall!.opts).toEqual({ onConflict: 'simulation_id' });
    expect(lastUpsertCall!.payload).toMatchObject({
      simulation_id: SIMULATION_ID,
      headline_cause: 'missions',
      display_name: 'Jane',
      projected_monthly_impact_micro_usd: 40_000_000,
    });
  });

  it('returns the projected monthly impact converted from micro-USD, and church aggregate totals', async () => {
    supabaseMockOpts.aggregateRows = [{ projected_monthly_impact_micro_usd: 40_000_000 }, { projected_monthly_impact_micro_usd: 10_000_000 }];
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { projectedMonthlyImpactUsd: number; church: { walletActivationCount: number; totalWalletProjectedImpactUsd: number } };
    expect(body.projectedMonthlyImpactUsd).toBe(40);
    expect(body.church.walletActivationCount).toBe(2);
    expect(body.church.totalWalletProjectedImpactUsd).toBe(50);
  });

  it('rate-limits after the configured threshold', async () => {
    enforceRateLimitMock.mockImplementation(async (res: VercelResponse) => {
      res.status(429).json({ error: 'rate_limited' });
      return true;
    });
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(429);
  });

  it('404s when no domain resolves to a church', async () => {
    resolveChurchIdForHostMock.mockResolvedValue(null);
    const { default: handler } = await import('./_wallet-activate.js');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(404);
  });
});
