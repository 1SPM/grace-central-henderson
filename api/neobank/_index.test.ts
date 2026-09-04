/**
 * Regression test for TD-053 (members-portal audit, Phase 1): GET
 * /api/neobank?resource=me used requireClerkAuth directly instead of
 * resolveMemberActor, unlike every other api/portal/* route — so a
 * demo or "preview as member" session, which never carries a real Clerk
 * bearer token, fell straight to a 401 instead of getting the same
 * demo-bootstrap actor the rest of the portal already resolves. That
 * showed up as usePortalImpactCard.ts having to hardcode an explicit
 * 'preview'/'signed_out' dead-wallet state.
 *
 * This only covers the new fallback path — the file has no prior test
 * coverage, and a full pass over its ~15 other actions (KYC review,
 * card issuance, staff admin reads, set_limits, ...) is out of scope
 * for "route resource=me through resolveMemberActor."
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));

const FAITHFUL_HOST = 'grace-crm-two.vercel.app'; // a real entry in authz.ts's DEMO_HOSTS, church 22222222-...-222222222222

function demoReq() {
  return {
    method: 'GET',
    query: { resource: 'me' },
    headers: { host: FAITHFUL_HOST }, // no Authorization header — the demo/preview case
  } as unknown as import('@vercel/node').VercelRequest;
}

function fakeRes() {
  const res: Record<string, unknown> = {
    setHeader: vi.fn(),
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  delete process.env.CLERK_SECRET_KEY;   // force requireClerkAuth to fail — no token anyway
  delete process.env.VITE_ENABLE_DEMO_MODE;
  delete process.env.VITE_DEFAULT_CHURCH_ID;
  delete process.env.I2C_LIVE;
});

describe('GET /api/neobank?resource=me — demo/preview session (TD-053)', () => {
  it('resolves the demo member actor and returns a wallet payload instead of 401', async () => {
    const supabase = createMockSupabase({
      tables: {
        churches: () => ({ data: { subscription_plan: 'enterprise', subscription_status: 'active' }, error: null }),
        people: (op) => {
          if (op === 'select') {
            return { data: { id: 'demo-person-1', portal_enabled: true, first_name: 'Demo', last_name: 'Member', email: null }, error: null };
          }
          return { data: null, error: null };
        },
      },
    });
    vi.doMock('@supabase/supabase-js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
      return { ...actual, createClient: vi.fn(() => supabase) };
    });

    const handler = (await import('./_index.js')).default;
    const res = fakeRes();

    await handler(demoReq(), res);

    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.status).toHaveBeenCalledWith(200);
    const [payload] = res.json.mock.calls[res.json.mock.calls.length - 1] as [Record<string, unknown>];
    expect(payload).toMatchObject({ person_id: 'demo-person-1', cards: [], transactions: [] });
  });

  it('still 401s a real (invalid) Clerk session on a non-demo host — the fallback is demo/preview-only', async () => {
    const supabase = createMockSupabase({ tables: {} });
    vi.doMock('@supabase/supabase-js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
      return { ...actual, createClient: vi.fn(() => supabase) };
    });
    process.env.CLERK_SECRET_KEY = 'test-secret-key';
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invalid token'));

    const handler = (await import('./_index.js')).default;
    const res = fakeRes();
    const req = {
      method: 'GET',
      query: { resource: 'me' },
      headers: { host: 'gracecrm-centralhenderson.org', authorization: 'Bearer garbage' }, // live tenant, real bearer, invalid
    } as unknown as import('@vercel/node').VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
