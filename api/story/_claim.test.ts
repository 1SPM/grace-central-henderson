/**
 * Redemption behaviour at the route boundary.
 *
 * What a mocked .rpc() can and cannot prove is worth stating, because the
 * headline guarantee here is concurrency. tests/fixtures/mockSupabase.ts says
 * it plainly: a mock "CANNOT show anything about what the function does — the
 * transaction, the row locks ... are all on the other side of this boundary."
 * So these tests prove the CALL CONTRACT and the refusal handling; the
 * single-use guarantee itself is proven against a real database in
 * tools/story-handoff-atomic-smoke.test.ts, and the conditional-UPDATE
 * predicate is asserted as migration text below.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const FAITHFUL = '22222222-2222-2222-2222-222222222222';
const VALID_TOKEN = 'a'.repeat(43);

let rpcResult: { data: unknown; error: unknown } = { data: [{ status: 'ok', draft_id: 'draft_1' }], error: null };
let rpcParams: Record<string, unknown> | undefined;
let rpcCallCount = 0;
let draftRow: Record<string, unknown> | null = null;

vi.mock('../_lib/rateLimit/limiter.js', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(false),
  clientIp: () => '203.0.113.9',
}));
vi.mock('../_lib/platformEvents.js', () => ({ emitPlatformEvent: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: vi.fn(async (_fn: string, params: Record<string, unknown>) => {
      rpcCallCount += 1; rpcParams = params; return rpcResult;
    }),
    from: () => {
      const b: Record<string, unknown> = {};
      const chain = () => b;
      Object.assign(b, {
        select: chain, eq: chain, update: chain, insert: chain,
        single: vi.fn(async () => ({ data: draftRow, error: draftRow ? null : { message: 'no rows' } })),
        maybeSingle: vi.fn(async () => ({ data: draftRow, error: null })),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
      });
      return b;
    },
  }),
}));

function makeRes() {
  const res: Record<string, unknown> = {};
  res.setHeader = vi.fn(() => res);
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.end = vi.fn(() => res);
  return res as unknown as VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn> };
}
async function call(body: unknown, method = 'POST') {
  const { default: handler } = await import('./_claim.js');
  const res = makeRes();
  await handler({ method, headers: { host: 'grace-members.vercel.app' }, body } as unknown as VercelRequest, res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks(); vi.resetModules();
  rpcCallCount = 0; rpcParams = undefined;
  rpcResult = { data: [{ status: 'ok', draft_id: 'draft_1' }], error: null };
  draftRow = {
    id: 'draft_1', preferred_name: 'Maya', sections: { church: ['Two years'] },
    segments: { attendance_mode: 'both' }, consent_followup: false, consent_money_sections: false,
  };
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

describe('scanner prefetch', () => {
  it('a GET does not consume the token — it never reaches the RPC', async () => {
    // iOS Camera, Messages and chat apps prefetch URLs to build previews. If
    // this consumed on GET, members would routinely be told their story was
    // already taken before they tapped anything.
    const res = await call(undefined, 'GET');
    expect(res.status).toHaveBeenCalledWith(405);
    expect(rpcCallCount).toBe(0);
  });

  it('an OPTIONS preflight does not consume the token either', async () => {
    await call(undefined, 'OPTIONS');
    expect(rpcCallCount).toBe(0);
  });
});

describe('input validation', () => {
  it.each([
    ['missing token', { tenant: 'faithful' }],
    ['malformed token', { token: 'not a token!' }],
    ['over-long token', { token: 'a'.repeat(200) }],
  ])('rejects %s before any database call', async (_l, body) => {
    const res = await call(body);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(rpcCallCount).toBe(0);
  });
});

describe('redemption', () => {
  it('passes the HASH of the token, never the token itself', async () => {
    await call({ token: VALID_TOKEN, tenant: 'faithful' });
    expect(rpcParams?.p_token_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rpcParams)).not.toContain(VALID_TOKEN);
  });

  it('scopes redemption to the resolved church', async () => {
    await call({ token: VALID_TOKEN, tenant: 'faithful' });
    expect(rpcParams?.p_church_id).toBe(FAITHFUL);
  });

  it('returns the story and a fresh attach nonce on success', async () => {
    const res = await call({ token: VALID_TOKEN, tenant: 'faithful' });
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({ ok: true, draft_id: 'draft_1', preferred_name: 'Maya' });
    expect(payload.attach_nonce).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  });

  it('never caches a redeemed story', async () => {
    const res = await call({ token: VALID_TOKEN, tenant: 'faithful' });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it.each([
    ['expired', 410],
    ['cancelled', 410],
    ['already_used', 410],
    ['unknown', 404],
  ])('reports %s distinctly', async (status, httpCode) => {
    rpcResult = { data: [{ status, draft_id: null }], error: null };
    const res = await call({ token: VALID_TOKEN, tenant: 'faithful' });
    expect(res.status).toHaveBeenCalledWith(httpCode);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe(status);
    expect(payload.message).toBeTruthy();
  });

  it('gives a wrong-tenant token the same answer as a nonexistent one', async () => {
    // Must not confirm that a token is real in some other church.
    rpcResult = { data: [{ status: 'unknown', draft_id: null }], error: null };
    const res = await call({ token: VALID_TOKEN, tenant: 'faithful' });
    expect(res.json.mock.calls[0][0].error).toBe('unknown');
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/church|tenant/i);
  });

  it('calls the RPC exactly once — no SELECT-then-UPDATE race', async () => {
    await call({ token: VALID_TOKEN, tenant: 'faithful' });
    expect(rpcCallCount).toBe(1);
  });
});

describe('migration 082 predicate', () => {
  it('redeems with a conditional UPDATE guarded on redeemed_at is null', () => {
    // The single-use guarantee lives in this predicate. A mocked RPC cannot
    // see it, so assert the migration text directly — the technique
    // tools/lint-rls.ts uses for the same reason.
    const sql = readFileSync('supabase/migrations/082_visitor_story_handoff.sql', 'utf8');
    const fn = sql.slice(sql.indexOf('redeem_visitor_story_handoff'));
    expect(fn).toMatch(/update\s+visitor_story_handoffs/i);
    expect(fn).toMatch(/redeemed_at\s+is\s+null/i);
    expect(fn).toMatch(/cancelled_at\s+is\s+null/i);
    expect(fn).toMatch(/expires_at\s+>\s+now\(\)/i);
    expect(fn).toMatch(/returning\s+h\.draft_id/i);
    // A preceding SELECT ... FOR UPDATE would mean the check and the write are
    // separate statements; this must be one.
    expect(fn).not.toMatch(/for\s+update/i);
  });

  it('is service-role only', () => {
    const sql = readFileSync('supabase/migrations/082_visitor_story_handoff.sql', 'utf8');
    expect(sql).toMatch(/revoke execute on function public\.redeem_visitor_story_handoff.*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.redeem_visitor_story_handoff.*to service_role/i);
  });
});
