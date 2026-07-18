/**
 * Route tests for /api/workos/notification-prefs — proves prefs are
 * strictly self-scoped (the route never trusts a user_id from the
 * body) and that the crisis-email default is only lazily seeded for a
 * care.view holder with zero existing rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq(method: 'GET' | 'PUT', body?: unknown) {
  return { method, headers: { authorization: 'Bearer valid-token' }, body } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
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

describe('GET /api/workos/notification-prefs', () => {
  it('returns existing prefs without seeding when rows already exist', async () => {
    const handler = (await import('./_notification-prefs.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'care.view' } }] }),
        staff_notification_prefs: () => ({ data: [{ category: 'approvals', channel: 'email', enabled: true }] }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.prefs).toEqual([{ category: 'approvals', channel: 'email', enabled: true }]);
    const insertCalls = supabase.__calls.filter(c => c.table === 'staff_notification_prefs' && c.op === 'insert');
    expect(insertCalls).toHaveLength(0);
  });

  it('lazily seeds a crisis/email/enabled row for a care.view holder with zero prefs', async () => {
    const handler = (await import('./_notification-prefs.js')).default;
    let callCount = 0;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'care.view' } }] }),
        staff_notification_prefs: (op) => {
          if (op === 'select') {
            callCount += 1;
            if (callCount === 1) return { data: [] };
            return { data: [{ category: 'crisis', channel: 'email', enabled: true }] };
          }
          return { data: null };
        },
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const insertCalls = supabase.__calls.filter(c => c.table === 'staff_notification_prefs' && c.op === 'insert');
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].payload).toMatchObject({ category: 'crisis', channel: 'email', enabled: true, user_id: FIXTURE_STAFF_USER.id });
  });

  it('does not seed for a caller without care.view', async () => {
    const handler = (await import('./_notification-prefs.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: [] }),
        staff_notification_prefs: () => ({ data: [] }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    const insertCalls = supabase.__calls.filter(c => c.table === 'staff_notification_prefs' && c.op === 'insert');
    expect(insertCalls).toHaveLength(0);
  });
});

describe('PUT /api/workos/notification-prefs', () => {
  it('upserts prefs scoped to the resolved actor, ignoring any user_id in the body', async () => {
    const handler = (await import('./_notification-prefs.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: [] }),
        staff_notification_prefs: () => ({ data: [{ category: 'approvals', channel: 'email', enabled: false }] }),
        platform_events: () => ({ data: { id: 'fixture-platform-event-id' } }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(
      makeReq('PUT', {
        user_id: 'some-other-user-id-attempting-to-write-elsewhere',
        prefs: [{ category: 'approvals', channel: 'email', enabled: false }],
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const upsertCalls = supabase.__calls.filter(c => c.table === 'staff_notification_prefs' && c.op === 'upsert');
    expect(upsertCalls).toHaveLength(1);
    const payload = upsertCalls[0].payload as Array<Record<string, unknown>>;
    expect(payload[0].user_id).toBe(FIXTURE_STAFF_USER.id);
    expect(payload[0].user_id).not.toBe('some-other-user-id-attempting-to-write-elsewhere');
  });

  it('400s on an invalid category', async () => {
    const handler = (await import('./_notification-prefs.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: [] }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('PUT', { prefs: [{ category: 'not-a-real-category', channel: 'email', enabled: true }] }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
