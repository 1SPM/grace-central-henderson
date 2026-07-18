/**
 * Route test for GET /api/workos/decision-queue — proves permission
 * filtering happens server-side (skipped categories are never queried,
 * not just hidden from the response).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq() {
  return { method: 'GET', headers: { authorization: 'Bearer valid-token' } } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function supabaseForStaffWithPermissions(permissionKeys: string[]) {
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: permissionKeys.map(key => ({ permissions: { key } })) }),
      approvals: () => ({ data: [] }),
      care_requests: () => ({ data: [] }),
      kyc_verifications: () => ({ data: [] }),
      card_transfers: () => ({ data: [] }),
      member_invitations: () => ({ data: [] }),
      tasks: () => ({ data: [] }),
    },
  });
}

beforeEach(async () => {
  vi.resetModules();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  const { verifyToken } = await import('@clerk/backend');
  (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    sub: FIXTURE_STAFF_USER.clerk_id,
    app_metadata: { church_id: FIXTURE_CHURCH_ID },
  });
});

describe('GET /api/workos/decision-queue — permission filtering', () => {
  it('never queries care_requests for a caller without care.view', async () => {
    const handler = (await import('./_decision-queue.js')).default;
    const supabase = supabaseForStaffWithPermissions(['approvals.view']);
    const req = makeReq();
    const res = makeRes();

    // Route creates its own client internally via createClient — but our
    // mock replaces the module before import, so intercept by mocking
    // @supabase/supabase-js's createClient to return our fake instead.
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    await handler(req, res);

    const careCalls = supabase.__calls.filter(c => c.table === 'care_requests');
    expect(careCalls).toHaveLength(0);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ counts: expect.objectContaining({ by_kind: expect.not.objectContaining({ crisis: expect.anything() }) }) }),
    );
  });

  it('queries care_requests when the caller holds care.view', async () => {
    const handler = (await import('./_decision-queue.js')).default;
    const supabase = supabaseForStaffWithPermissions(['care.view']);
    const req = makeReq();
    const res = makeRes();

    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    await handler(req, res);

    const careCalls = supabase.__calls.filter(c => c.table === 'care_requests');
    expect(careCalls.length).toBeGreaterThan(0);
  });

  it('always queries member_invitations regardless of permissions (coarse-gated today)', async () => {
    const handler = (await import('./_decision-queue.js')).default;
    const supabase = supabaseForStaffWithPermissions([]);
    const req = makeReq();
    const res = makeRes();

    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    await handler(req, res);

    const inviteCalls = supabase.__calls.filter(c => c.table === 'member_invitations');
    expect(inviteCalls.length).toBeGreaterThan(0);
  });
});
