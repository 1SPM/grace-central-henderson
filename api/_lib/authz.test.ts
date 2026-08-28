/**
 * Unit tests for the shared-platform authorization module.
 *
 * Covers: authentication (invalid/missing claims), account-status
 * enforcement (session/account lifecycle), role/permission-based access,
 * and member self-access resolution. Uses a fake Supabase client
 * (tests/fixtures/mockSupabase.ts) — no network, no real database.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import {
  FIXTURE_CHURCH_ID,
  FIXTURE_OTHER_CHURCH_ID,
  FIXTURE_STAFF_USER,
  FIXTURE_SUSPENDED_USER,
  FIXTURE_PERSON,
  FIXTURE_PERSON_NO_PORTAL,
} from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

function makeReq(token: string | null = 'valid-token') {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as import('@vercel/node').VercelRequest;
}

function makeReqWithHost(host: string) {
  return { headers: { host } } as unknown as import('@vercel/node').VercelRequest;
}

function makeReqWithHostAndToken(host: string, token: string) {
  return { headers: { host, authorization: `Bearer ${token}` } } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.resetModules();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
});

describe('resolveStaffActor — authentication', () => {
  it('rejects a request with no bearer token', async () => {
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = createMockSupabase({ tables: {} });
    const res = makeRes();

    const actor = await resolveStaffActor(makeReq(null), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a token whose JWT is missing the church_id claim', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({ sub: 'user_x', app_metadata: {} });
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = createMockSupabase({ tables: {} });
    const res = makeRes();

    const actor = await resolveStaffActor(makeReq(), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('resolveStaffActor — account status', () => {
  it('rejects a suspended account even with a structurally valid token', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_SUSPENDED_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_SUSPENDED_USER.id, account_status: 'suspended' } }),
      },
    });
    const res = makeRes();

    const actor = await resolveStaffActor(makeReq(), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'account_not_active' }));
  });

  it('rejects a valid token with no matching users row in this church', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: 'user_unknown',
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = createMockSupabase({ tables: { users: () => ({ data: null }) } });
    const res = makeRes();

    const actor = await resolveStaffActor(makeReq(), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('resolveStaffActor / requirePermission — role access', () => {
  function supabaseForActiveStaff(permissionKeys: string[]) {
    return createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        // loadPermissionKeys does two hops (no direct FK between user_roles
        // and role_permissions — both only reference `roles`): first the
        // caller's granted role_ids, then the permissions for those roles.
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: permissionKeys.map(key => ({ permissions: { key } })) }),
      },
    });
  }

  it('resolves the union of permission keys granted across roles', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_STAFF_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = supabaseForActiveStaff(['work_orders.view', 'work_orders.manage']);
    const res = makeRes();

    const actor = await resolveStaffActor(makeReq(), res, supabase as never);

    expect(actor).not.toBeNull();
    expect(actor!.permissions.has('work_orders.view')).toBe(true);
    expect(actor!.permissions.has('work_orders.manage')).toBe(true);
    expect(actor!.permissions.has('giving_financial.manage')).toBe(false);
  });

  it('requirePermission 403s a caller missing the required permission (restricted financial data)', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_STAFF_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { requirePermission } = await import('./authz.js');
    // Communications-role permission set — no giving_financial.* grant.
    const supabase = supabaseForActiveStaff(['communications.view', 'communications.manage']);
    const res = makeRes();

    const actor = await requirePermission(makeReq(), res, supabase as never, 'giving_financial.view');

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'insufficient_permission', required: 'giving_financial.view' }),
    );
  });

  it('requirePermission 403s a caller missing care.view (restricted care data)', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_STAFF_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { requirePermission } = await import('./authz.js');
    const supabase = supabaseForActiveStaff(['communications.view']);
    const res = makeRes();

    const actor = await requirePermission(makeReq(), res, supabase as never, 'care.view');

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('requirePermission returns the actor when the permission is granted', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_STAFF_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { requirePermission } = await import('./authz.js');
    const supabase = supabaseForActiveStaff(['care.view', 'care.manage']);
    const res = makeRes();

    const actor = await requirePermission(makeReq(), res, supabase as never, 'care.view');

    expect(actor).not.toBeNull();
    expect(actor!.userId).toBe(FIXTURE_STAFF_USER.id);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('a member_portal_user-shaped permission set cannot pass work_orders.view (portal users excluded from Work Orders)', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_STAFF_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { requirePermission } = await import('./authz.js');
    const supabase = supabaseForActiveStaff(['consent.manage_own', 'portal.self_service']);
    const res = makeRes();

    const actor = await requirePermission(makeReq(), res, supabase as never, 'work_orders.view');

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('resolveMemberActor — member self-access', () => {
  it('403s when the person has not been portal-enabled by staff', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_PERSON_NO_PORTAL.clerk_user_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: FIXTURE_PERSON_NO_PORTAL.id, portal_enabled: false } }),
      },
    });
    const res = makeRes();

    const actor = await resolveMemberActor(makeReq(), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'portal_access_not_enabled' }));
  });

  it('resolves the caller to their own people.id, never a different person', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_PERSON.clerk_user_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: FIXTURE_PERSON.id, portal_enabled: true } }),
      },
    });
    const res = makeRes();

    const actor = await resolveMemberActor(makeReq(), res, supabase as never);

    expect(actor).not.toBeNull();
    expect(actor!.personId).toBe(FIXTURE_PERSON.id);
    expect(actor!.kind).toBe('member');
  });
});

describe('resolveStaffActor — demo-mode bootstrap', () => {
  afterEach(() => {
    delete process.env.VITE_ENABLE_DEMO_MODE;
    delete process.env.VITE_DEFAULT_CHURCH_ID;
  });

  it('503s when demo mode is on but no default church is configured', async () => {
    process.env.VITE_ENABLE_DEMO_MODE = 'true';
    delete process.env.VITE_DEFAULT_CHURCH_ID;
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = createMockSupabase({ tables: {} });
    const res = makeRes();

    const actor = await resolveStaffActor(makeReq(null), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('bypasses Clerk verification entirely and resolves a real demo user with system_administrator permissions', async () => {
    process.env.VITE_ENABLE_DEMO_MODE = 'true';
    process.env.VITE_DEFAULT_CHURCH_ID = FIXTURE_CHURCH_ID;
    const { resolveStaffActor } = await import('./authz.js');

    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: 'demo-user-row-id', account_status: 'active' } }),
        roles: () => ({ data: { id: 'sysadmin-role-id' } }),
        // Same table, two call shapes: the "existing grant?" check uses
        // .maybeSingle() (truthy on a non-empty array works fine), and
        // loadPermissionKeys's first hop reads the array directly (no .single()).
        user_roles: () => ({ data: [{ id: 'grant-1', role_id: 'sysadmin-role-id' }] }),
        // loadPermissionKeys's second hop — role_permissions has no direct
        // FK to user_roles (both only reference `roles`), so it's queried
        // separately by role_id, not nested under user_roles. This mock
        // shape matches the real, FK-valid PostgREST embed
        // (role_permissions.permission_id -> permissions.id).
        role_permissions: () => ({ data: [{ permissions: { key: 'work_orders.manage' } }, { permissions: { key: 'approvals.decide' } }] }),
      },
    });
    const res = makeRes();

    // No Authorization header at all — demo mode must not require one.
    const actor = await resolveStaffActor(makeReq(null), res, supabase as never);

    expect(actor).not.toBeNull();
    expect(actor!.churchId).toBe(FIXTURE_CHURCH_ID);
    expect(actor!.permissions.has('work_orders.manage')).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('still enforces account_status on the demo user (a suspended demo bootstrap user is blocked)', async () => {
    process.env.VITE_ENABLE_DEMO_MODE = 'true';
    process.env.VITE_DEFAULT_CHURCH_ID = FIXTURE_CHURCH_ID;
    const { resolveStaffActor } = await import('./authz.js');

    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: 'demo-user-row-id', account_status: 'suspended' } }),
      },
    });
    const res = makeRes();

    const actor = await resolveStaffActor(makeReq(null), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('auto-activates for a known demo host even with VITE_ENABLE_DEMO_MODE unset — no shared-var drift', async () => {
    delete process.env.VITE_ENABLE_DEMO_MODE;
    const { resolveStaffActor } = await import('./authz.js');

    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: 'demo-user-row-id', account_status: 'active' } }),
        roles: () => ({ data: { id: 'sysadmin-role-id' } }),
        user_roles: () => ({ data: [{ id: 'grant-1', role_id: 'sysadmin-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'work_orders.manage' } }] }),
      },
    });
    const res = makeRes();

    // No Authorization header, no env var — only a known demo Host header.
    const actor = await resolveStaffActor(makeReqWithHost('grace-crm-two.vercel.app'), res, supabase as never);

    expect(actor).not.toBeNull();
    expect(actor!.churchId).toBe('22222222-2222-2222-2222-222222222222');
    expect(res.status).not.toHaveBeenCalled();
  });

  // Regression (TD-043, 2026-08-28): this test previously asserted the
  // OPPOSITE — that the demo bootstrap auto-activates on Central
  // Henderson's own hostname — which locked an unauthenticated
  // system_administrator path onto a live tenant into the suite as
  // intended behaviour. The bypass may only ever activate on a demo host
  // (DEMO_HOSTS). See api/_lib/authz.demo.test.ts.
  it('does NOT auto-activate for gracecrm-centralhenderson.org (a live client) — falls through to real Clerk auth', async () => {
    delete process.env.VITE_ENABLE_DEMO_MODE;
    const { resolveStaffActor } = await import('./authz.js');

    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: 'demo-user-row-id', account_status: 'active' } }),
        roles: () => ({ data: { id: 'sysadmin-role-id' } }),
        user_roles: () => ({ data: [{ id: 'grant-1', role_id: 'sysadmin-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'work_orders.manage' } }] }),
      },
    });
    const res = makeRes();

    const actor = await resolveStaffActor(makeReqWithHost('gracecrm-centralhenderson.org'), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    // No demo users row is created for a real tenant.
    expect(supabase.__calls.filter(c => c.table === 'users' && c.op === 'insert')).toHaveLength(0);
  });

  it('does NOT auto-activate for a genuinely unmapped host — falls through to real Clerk auth and 401s with no token', async () => {
    delete process.env.VITE_ENABLE_DEMO_MODE;
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = createMockSupabase({ tables: {} });
    const res = makeRes();

    const actor = await resolveStaffActor(makeReqWithHost('some-other-church.example.com'), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('a real bearer token on a known demo host is NEVER downgraded to the shared anonymous demo actor', async () => {
    delete process.env.VITE_ENABLE_DEMO_MODE;
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_STAFF_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [] }),
      },
    });
    const res = makeRes();

    // gracecrm-centralhenderson.org is a known demo host, but a real
    // bearer token is present — this must resolve the caller's own real
    // identity via requireClerkAuth, never the shared demo actor.
    const actor = await resolveStaffActor(
      makeReqWithHostAndToken('gracecrm-centralhenderson.org', 'valid-token'),
      res,
      supabase as never,
    );

    expect(actor).not.toBeNull();
    expect(actor!.userId).toBe(FIXTURE_STAFF_USER.id);
    expect(actor!.clerkUserId).toBe(FIXTURE_STAFF_USER.clerk_id);
  });
});

describe('resolveStaffActor — "view as [team member]" (x-grace-view-as)', () => {
  function makeReqWithViewAs(token: string, viewAsClerkId: string) {
    return {
      headers: { authorization: `Bearer ${token}`, 'x-grace-view-as': viewAsClerkId },
    } as unknown as import('@vercel/node').VercelRequest;
  }

  it('ignores the header for a real caller who is NOT a master admin — resolves their own identity', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_STAFF_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveStaffActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active', person_id: null } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        // No admin.manage_settings — an ordinary staff permission only.
        role_permissions: () => ({ data: [{ permissions: { key: 'work_orders.manage' } }] }),
      },
    });
    const res = makeRes();

    const actor = await resolveStaffActor(
      makeReqWithViewAs('valid-token', 'demo-leader-james-wilson+11111111-1111-1111-1111-111111111111'),
      res,
      supabase as never,
    );

    expect(actor).not.toBeNull();
    expect(actor!.userId).toBe(FIXTURE_STAFF_USER.id);
    expect(actor!.clerkUserId).toBe(FIXTURE_STAFF_USER.clerk_id);
    // The target lookup must never even be attempted — a second `users`
    // select would appear here if the permission gate hadn't short-circuited.
    expect(supabase.__calls.filter(c => c.table === 'users' && c.op === 'select')).toHaveLength(1);
  });

  it('a real master admin can view as a named team member, and it is logged', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_STAFF_USER.clerk_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveStaffActor } = await import('./authz.js');

    let usersCall = 0;
    let rolesCall = 0;
    const TARGET_USER_ID = 'target-leader-user-id';
    const TARGET_CLERK_ID = 'demo-leader-james-wilson+11111111-1111-1111-1111-111111111111';
    const TARGET_PERSON_ID = '00000000-0000-0000-0000-000000000101';

    const supabase = createMockSupabase({
      tables: {
        users: () => {
          usersCall += 1;
          // 1st call resolves the real caller (the admin); 2nd resolves
          // the view-as target — matching resolveStaffActor's call order.
          return usersCall === 1
            ? { data: { id: FIXTURE_STAFF_USER.id, account_status: 'active', person_id: null } }
            : { data: { id: TARGET_USER_ID, account_status: 'active', person_id: TARGET_PERSON_ID } };
        },
        user_roles: () => ({ data: [{ role_id: 'some-role-id' }] }),
        role_permissions: () => {
          rolesCall += 1;
          // 1st call: the caller's own permissions (must include
          // admin.manage_settings for the gate to open at all). 2nd call:
          // the target's — deliberately a DIFFERENT, non-admin set, to
          // prove the resolved actor really is the target, not the caller.
          return rolesCall === 1
            ? { data: [{ permissions: { key: 'admin.manage_settings' } }] }
            : { data: [{ permissions: { key: 'pastoral_care.manage' } }] };
        },
        security_events: () => ({ data: null }),
      },
    });
    const res = makeRes();

    const actor = await resolveStaffActor(
      makeReqWithViewAs('valid-token', TARGET_CLERK_ID),
      res,
      supabase as never,
    );

    expect(actor).not.toBeNull();
    expect(actor!.userId).toBe(TARGET_USER_ID);
    expect(actor!.clerkUserId).toBe(TARGET_CLERK_ID);
    expect(actor!.personId).toBe(TARGET_PERSON_ID);
    expect(actor!.permissions.has('admin.manage_settings')).toBe(false);
    expect(actor!.permissions.has('pastoral_care.manage')).toBe(true);

    const auditInsert = supabase.__calls.find(c => c.table === 'security_events' && c.op === 'insert');
    expect(auditInsert).toBeDefined();
    expect((auditInsert!.payload as { event_type: string }).event_type).toBe('authz.view_as');
  });

  it('the anonymous demo bootstrap ignores x-grace-view-as entirely — no bearer token means no admin permission to gate on', async () => {
    delete process.env.VITE_ENABLE_DEMO_MODE;
    const { resolveStaffActor } = await import('./authz.js');

    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: 'demo-user-row-id', account_status: 'active' } }),
        roles: () => ({ data: { id: 'sysadmin-role-id' } }),
        user_roles: () => ({ data: [{ id: 'grant-1', role_id: 'sysadmin-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'admin.manage_settings' } }] }),
      },
    });
    const res = makeRes();

    // No Authorization header (so hasBearerToken is false, and the demo
    // host's bypass takes over) — but a crafted x-grace-view-as header IS
    // present, exactly what an attacker hitting the API directly
    // (bypassing the app's own sign-in gate) would send. It must be fully
    // ignored: the anonymous path only ever resolves the single shared
    // demo-workos-admin actor, never a named individual, regardless of any
    // header sent.
    //
    // Uses a demo host deliberately: as of TD-043's 2026-08-28 correction
    // the bypass no longer activates on a live client's hostname at all,
    // so exercising this on grace-crm.dev is the only way to reach the
    // anonymous path this test is about.
    const req = {
      headers: { host: 'grace-crm.dev', 'x-grace-view-as': 'demo-leader-james-wilson+22222222-2222-2222-2222-222222222222' },
    } as unknown as import('@vercel/node').VercelRequest;

    const actor = await resolveStaffActor(req, res, supabase as never);

    expect(actor).not.toBeNull();
    expect(actor!.clerkUserId).toBe('demo-workos-admin+22222222-2222-2222-2222-222222222222');
    expect(supabase.__calls.filter(c => c.table === 'users' && c.op === 'select')).toHaveLength(1);
  });
});

describe('resolveMemberActor — demo-mode bootstrap (Members Portal)', () => {
  afterEach(() => {
    delete process.env.VITE_ENABLE_DEMO_MODE;
    delete process.env.VITE_DEFAULT_CHURCH_ID;
  });

  it('503s when demo mode is on but no default church is configured', async () => {
    process.env.VITE_ENABLE_DEMO_MODE = 'true';
    delete process.env.VITE_DEFAULT_CHURCH_ID;
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({ tables: {} });
    const res = makeRes();

    const actor = await resolveMemberActor(makeReq(null), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('bypasses Clerk verification entirely and resolves a real, portal-enabled demo member — never a client-supplied church', async () => {
    process.env.VITE_ENABLE_DEMO_MODE = 'true';
    process.env.VITE_DEFAULT_CHURCH_ID = FIXTURE_CHURCH_ID;
    const { resolveMemberActor } = await import('./authz.js');

    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: 'demo-member-row-id', portal_enabled: true } }),
      },
    });
    const res = makeRes();

    // No Authorization header, and no way for the caller to name a
    // different church_id — demo mode always resolves the server's own
    // configured DEMO_CHURCH_ID (tenant isolation holds even in demo mode).
    const actor = await resolveMemberActor(makeReq(null), res, supabase as never);

    expect(actor).not.toBeNull();
    expect(actor!.churchId).toBe(FIXTURE_CHURCH_ID);
    expect(actor!.kind).toBe('member');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('still enforces portal_enabled on the demo member (fail-closed even in demo mode)', async () => {
    process.env.VITE_ENABLE_DEMO_MODE = 'true';
    process.env.VITE_DEFAULT_CHURCH_ID = FIXTURE_CHURCH_ID;
    const { resolveMemberActor } = await import('./authz.js');

    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: 'demo-member-row-id', portal_enabled: false } }),
      },
    });
    const res = makeRes();

    const actor = await resolveMemberActor(makeReq(null), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('a real bearer token on a known demo host is NEVER downgraded to the shared anonymous demo member', async () => {
    delete process.env.VITE_ENABLE_DEMO_MODE;
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_PERSON.clerk_user_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: FIXTURE_PERSON.id, portal_enabled: true } }),
      },
    });
    const res = makeRes();

    // gracecrm-centralhenderson.org is a known demo host, but a real
    // bearer token is present — this must resolve the caller's own real
    // person record via requireClerkAuth, never the shared demo member.
    const actor = await resolveMemberActor(
      makeReqWithHostAndToken('gracecrm-centralhenderson.org', 'valid-token'),
      res,
      supabase as never,
    );

    expect(actor).not.toBeNull();
    expect(actor!.personId).toBe(FIXTURE_PERSON.id);
    expect(actor!.clerkUserId).toBe(FIXTURE_PERSON.clerk_user_id);
  });
});

describe('resolveMemberActor — tenant isolation', () => {
  it('resolves a member only within the church carried on their own JWT — never a client-requested church', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: FIXTURE_PERSON.clerk_user_id,
      app_metadata: { church_id: FIXTURE_CHURCH_ID },
    });
    const { resolveMemberActor } = await import('./authz.js');

    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: FIXTURE_PERSON.id, portal_enabled: true } }),
      },
    });
    const res = makeRes();

    const actor = await resolveMemberActor(makeReq(), res, supabase as never);

    expect(actor).not.toBeNull();
    expect(actor!.churchId).toBe(FIXTURE_CHURCH_ID);
    expect(actor!.churchId).not.toBe(FIXTURE_OTHER_CHURCH_ID);
  });
});

function makePreviewReq(token: string, method: 'GET' | 'POST' = 'GET') {
  return {
    method,
    headers: { authorization: `Bearer ${token}` },
  } as unknown as import('@vercel/node').VercelRequest;
}

describe('resolveMemberActor — staff preview token (read-only)', () => {
  it('rejects a non-GET request before ever touching the database', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({ tables: {} });
    const res = makeRes();

    const actor = await resolveMemberActor(makePreviewReq('pvt_abc123', 'POST'), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'preview_mode_read_only' }));
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('never attempts Clerk verification for a preview-prefixed bearer token', async () => {
    const { verifyToken } = await import('@clerk/backend');
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        portal_preview_tokens: () => ({
          data: { id: 'tok-1', church_id: FIXTURE_CHURCH_ID, person_id: FIXTURE_PERSON.id, expires_at: new Date(Date.now() + 60_000).toISOString(), use_count: 0 },
        }),
        people: () => ({ data: { id: FIXTURE_PERSON.id, clerk_user_id: FIXTURE_PERSON.clerk_user_id } }),
      },
    });

    const callsBefore = (verifyToken as ReturnType<typeof vi.fn>).mock.calls.length;
    await resolveMemberActor(makePreviewReq('pvt_abc123'), makeRes(), supabase as never);

    // verifyToken's call count is shared across this whole test file (the
    // mock isn't reset between tests) — assert it didn't grow, not that
    // it's zero.
    expect((verifyToken as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
  });

  it('401s an expired preview token', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        portal_preview_tokens: () => ({
          data: { id: 'tok-1', church_id: FIXTURE_CHURCH_ID, person_id: FIXTURE_PERSON.id, expires_at: new Date(Date.now() - 60_000).toISOString(), use_count: 0 },
        }),
      },
    });
    const res = makeRes();

    const actor = await resolveMemberActor(makePreviewReq('pvt_expired'), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'preview_token_invalid_or_expired' }));
  });

  it('401s a token that does not exist', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: { portal_preview_tokens: () => ({ data: null }) },
    });
    const res = makeRes();

    const actor = await resolveMemberActor(makePreviewReq('pvt_nonexistent'), res, supabase as never);

    expect(actor).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('resolves a valid token to the target member, flagged isPreview', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        portal_preview_tokens: () => ({
          data: { id: 'tok-1', church_id: FIXTURE_CHURCH_ID, person_id: FIXTURE_PERSON.id, expires_at: new Date(Date.now() + 60_000).toISOString(), use_count: 0 },
        }),
        people: () => ({ data: { id: FIXTURE_PERSON.id, clerk_user_id: FIXTURE_PERSON.clerk_user_id } }),
      },
    });

    const actor = await resolveMemberActor(makePreviewReq('pvt_valid'), makeRes(), supabase as never);

    expect(actor).not.toBeNull();
    expect(actor!.personId).toBe(FIXTURE_PERSON.id);
    expect(actor!.churchId).toBe(FIXTURE_CHURCH_ID);
    expect(actor!.isPreview).toBe(true);
  });

  it('stamps use_count/last_used_at on the token row when resolved', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const supabase = createMockSupabase({
      tables: {
        portal_preview_tokens: () => ({
          data: { id: 'tok-1', church_id: FIXTURE_CHURCH_ID, person_id: FIXTURE_PERSON.id, expires_at: new Date(Date.now() + 60_000).toISOString(), use_count: 2 },
        }),
        people: () => ({ data: { id: FIXTURE_PERSON.id, clerk_user_id: FIXTURE_PERSON.clerk_user_id } }),
      },
    });

    await resolveMemberActor(makePreviewReq('pvt_valid'), makeRes(), supabase as never);

    const updateCall = supabase.__calls.find(c => c.table === 'portal_preview_tokens' && c.op === 'update');
    expect(updateCall).toBeDefined();
    expect((updateCall!.payload as { use_count: number }).use_count).toBe(3);
  });
});
