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
