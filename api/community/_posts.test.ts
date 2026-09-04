/**
 * Tests for the community composer backend (members-portal audit, Phase 2 /
 * TD-049). Exercises the actual application-level logic this route adds on
 * top of RLS: bidirectional block exclusion, reaction aggregation, and the
 * composable-post-type allowlist — not Postgres filtering itself, which the
 * mock fixture doesn't model.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));

const FAITHFUL_HOST = 'grace-crm-two.vercel.app'; // a real DEMO_HOSTS entry (authz.ts)
const ME = 'me-person-1';

function memberReq(method: string, opts: { query?: Record<string, string>; body?: unknown } = {}) {
  return {
    method,
    query: opts.query ?? {},
    body: opts.body,
    headers: { host: FAITHFUL_HOST }, // no Authorization header → demo member bootstrap
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

async function loadHandler(supabase: unknown) {
  vi.doMock('@supabase/supabase-js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
    return { ...actual, createClient: vi.fn(() => supabase) };
  });
  return (await import('./_posts.js')).default;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  delete process.env.CLERK_SECRET_KEY;
});

describe('POST /api/community/posts', () => {
  it('creates a post that starts pending, and reports back its status', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: ME, portal_enabled: true }, error: null }),
        community_posts: (op, payload) => {
          if (op === 'insert') {
            expect(payload).toMatchObject({ author_person_id: ME, post_type: 'praise', body: 'God is good!' });
            return { data: { id: 'post-1', post_type: 'praise', body: 'God is good!', moderation_status: 'pending', created_at: '2026-01-01' }, error: null };
          }
          return { data: null, error: null };
        },
        platform_events: () => ({ data: { id: 'evt-1' }, error: null }),
      },
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(memberReq('POST', { body: { post_type: 'praise', body: 'God is good!' } }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    const [payload] = res.json.mock.calls[0] as [{ post: { moderation_status: string } }];
    expect(payload.post.moderation_status).toBe('pending');
  });

  it('rejects a post_type outside the composable allowlist (e.g. "prayer" — that is /api/portal/prayer\'s job)', async () => {
    const supabase = createMockSupabase({ tables: { people: () => ({ data: { id: ME, portal_enabled: true }, error: null }) } });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(memberReq('POST', { body: { post_type: 'prayer', body: 'Please pray for me' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('GET /api/community/posts', () => {
  it('excludes posts from a member the caller blocked, AND from a member who blocked the caller', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: ME, portal_enabled: true }, error: null }),
        // The handler makes two separate queries against this table (one
        // per block direction) but the mock fixture can't distinguish them
        // by filter — it returns the same two rows for both, each row
        // shaped for one direction. .map(b => b.blocked_person_id) on the
        // second row is undefined (harmless, matches no real id), and vice
        // versa for the first — so both real ids still land in the
        // resulting exclusion set correctly.
        member_blocks: () => ({ data: [{ blocked_person_id: 'blocked-by-me' }, { blocker_person_id: 'blocked-me' }], error: null }),
        community_posts: () => ({
          data: [
            { id: 'p-mine', author_person_id: ME, post_type: 'praise', body: 'mine', moderation_status: 'approved', created_at: '3', people: { first_name: 'Me', last_name: 'Person' } },
            { id: 'p-ok', author_person_id: 'ok-person', post_type: 'blessing', body: 'visible', moderation_status: 'approved', created_at: '2', people: { first_name: 'Ok', last_name: 'Person' } },
            { id: 'p-blocked-by-me', author_person_id: 'blocked-by-me', post_type: 'praise', body: 'hidden 1', moderation_status: 'approved', created_at: '1', people: { first_name: 'Blocked', last_name: 'ByMe' } },
            { id: 'p-blocked-me', author_person_id: 'blocked-me', post_type: 'praise', body: 'hidden 2', moderation_status: 'approved', created_at: '0', people: { first_name: 'Blocked', last_name: 'Me' } },
          ],
          error: null,
        }),
        community_reactions: () => ({ data: [], error: null }),
      },
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(memberReq('GET'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const [payload] = res.json.mock.calls[0] as [{ posts: { id: string }[] }];
    const ids = payload.posts.map(p => p.id);
    expect(ids).toContain('p-mine');
    expect(ids).toContain('p-ok');
    expect(ids).not.toContain('p-blocked-by-me');
    expect(ids).not.toContain('p-blocked-me');
  });

  it('aggregates reaction counts and marks which ones the caller made', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: ME, portal_enabled: true }, error: null }),
        member_blocks: () => ({ data: [], error: null }),
        community_posts: () => ({
          data: [{ id: 'p-1', author_person_id: 'other', post_type: 'praise', body: 'x', moderation_status: 'approved', created_at: '1', people: { first_name: 'A', last_name: 'B' } }],
          error: null,
        }),
        community_reactions: () => ({
          data: [
            { post_id: 'p-1', person_id: ME, reaction_type: 'pray' },
            { post_id: 'p-1', person_id: 'someone-else', reaction_type: 'pray' },
            { post_id: 'p-1', person_id: 'someone-else', reaction_type: 'amen' },
          ],
          error: null,
        }),
      },
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(memberReq('GET'), res);

    const [payload] = res.json.mock.calls[0] as [{ posts: { reaction_counts: Record<string, number>; my_reactions: string[] }[] }];
    const post = payload.posts[0];
    expect(post.reaction_counts).toEqual({ pray: 2, amen: 1 });
    expect(post.my_reactions).toEqual(['pray']);
  });
});
