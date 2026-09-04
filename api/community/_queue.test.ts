/**
 * Tests for the staff moderation queue (TD-051 / members-portal audit,
 * Phase 2). The two things worth pinning: a post that's both never-reviewed
 * AND reported appears exactly once (in `pending`, not duplicated into
 * `reported`), and report reasons/counts are attached to the right post.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));

const FAITHFUL_HOST = 'grace-crm-two.vercel.app'; // a real DEMO_HOSTS entry (authz.ts)

function staffReq() {
  return {
    method: 'GET',
    query: {},
    headers: { host: FAITHFUL_HOST }, // no Authorization header → demo staff bootstrap
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

// The demo staff actor is bootstrapped as system_administrator (every
// permission), which itself requires: a `users` row (found immediately —
// skip the insert branch), a `roles` row for the role id, a `user_roles`
// row proving the grant already exists (skip its insert branch too), and
// loadPermissionKeys's own user_roles + role_permissions reads. See
// api/_lib/authz.ts's resolveDemoStaffActor / loadPermissionKeys.
function staffTables(extra: Record<string, (op: string, payload: unknown) => { data: unknown; error: unknown }>) {
  return {
    users: () => ({ data: { id: 'staff-user-1', account_status: 'active' }, error: null }),
    roles: () => ({ data: { id: 'role-sysadmin' }, error: null }),
    user_roles: () => ({ data: [{ id: 'grant-1', role_id: 'role-sysadmin' }], error: null }),
    role_permissions: () => ({ data: [{ permissions: { key: 'communications.manage' } }], error: null }),
    ...extra,
  };
}

async function loadHandler(supabase: unknown) {
  vi.doMock('@supabase/supabase-js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
    return { ...actual, createClient: vi.fn(() => supabase) };
  });
  return (await import('./_queue.js')).default;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  delete process.env.CLERK_SECRET_KEY;
});

describe('GET /api/community/queue', () => {
  it('never double-lists a post that is both pending and reported — pending wins', async () => {
    // The route queries community_posts twice — once for the pending list
    // (Promise.all, runs first), once for the reported-posts detail (after,
    // only if there's a non-pending reported id). The mock fixture can't
    // distinguish two selects on the same table by their .eq()/.in() chain
    // (only the initial .select() column args are visible to it, and both
    // queries use the same column list), so this counts invocations instead
    // — call order is deterministic because the route only issues the
    // second query after awaiting the first.
    let communityPostsCall = 0;
    const supabase = createMockSupabase({
      tables: staffTables({
        community_posts: () => {
          communityPostsCall += 1;
          if (communityPostsCall === 1) {
            // First call: the pending-only query.
            return {
              data: [{ id: 'post-both', author_person_id: 'a', post_type: 'praise', body: 'both', moderation_status: 'pending', created_at: '1', people: { first_name: 'A', last_name: 'One' } }],
              error: null,
            };
          }
          // Second call: the reported-and-approved detail query.
          return {
            data: [{ id: 'post-reported-only', author_person_id: 'b', post_type: 'blessing', body: 'reported', moderation_status: 'approved', created_at: '2', people: { first_name: 'B', last_name: 'Two' } }],
            error: null,
          };
        },
        community_post_reports: () => ({
          data: [
            { id: 'r1', post_id: 'post-both', reason: 'off-topic', created_at: '1', reported_by_person_id: 'x' },
            { id: 'r2', post_id: 'post-reported-only', reason: 'spam', created_at: '2', reported_by_person_id: 'y' },
            { id: 'r3', post_id: 'post-reported-only', reason: null, created_at: '3', reported_by_person_id: 'z' },
          ],
          error: null,
        }),
      }),
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(staffReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const [payload] = res.json.mock.calls[0] as [{ pending: { id: string }[]; reported: { id: string; report_count: number; report_reasons: string[] }[] }];

    expect(payload.pending.map(p => p.id)).toContain('post-both');
    expect(payload.reported.map(p => p.id)).not.toContain('post-both');

    const reportedOnly = payload.reported.find(p => p.id === 'post-reported-only');
    expect(reportedOnly).toBeTruthy();
    expect(reportedOnly!.report_count).toBe(2);
    expect(reportedOnly!.report_reasons).toEqual(['spam']); // the null-reason report contributes to the count, not to reasons
  });

  it('returns empty lists cleanly when nothing is pending or reported', async () => {
    const supabase = createMockSupabase({
      tables: staffTables({
        community_posts: () => ({ data: [], error: null }),
        community_post_reports: () => ({ data: [], error: null }),
      }),
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(staffReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ pending: [], reported: [] });
  });
});
