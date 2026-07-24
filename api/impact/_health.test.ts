/**
 * Route test for GET /api/impact/health — proves the permission gate
 * (analytics.view) and that the response carries current/snapshots/at_risk.
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
      people: () => ({ data: [] }),
      recurring_giving: () => ({ data: [] }),
      group_memberships: () => ({ data: [] }),
      care_requests: () => ({ data: [] }),
      member_activity_events: () => ({ data: [] }),
      health_snapshots: () => ({ data: [] }),
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

describe('GET /api/impact/health', () => {
  it('403s a caller without analytics.view', async () => {
    const handler = (await import('./_health.js')).default;
    const supabase = supabaseForStaffWithPermissions([]);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns current/snapshots/at_risk for a caller with analytics.view', async () => {
    const handler = (await import('./_health.js')).default;
    const supabase = supabaseForStaffWithPermissions(['analytics.view']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('current');
    expect(body).toHaveProperty('snapshots');
    expect(body).toHaveProperty('at_risk');
  });
});
