/**
 * Tests for the post-reaction toggle (members-portal audit, Phase 2).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));

const FAITHFUL_HOST = 'grace-crm-two.vercel.app';
const ME = 'me-person-1';

function memberReq(body: unknown) {
  return {
    method: 'POST',
    query: {},
    body,
    headers: { host: FAITHFUL_HOST },
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
  return (await import('./_reactions.js')).default;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  delete process.env.CLERK_SECRET_KEY;
});

describe('POST /api/community/reactions', () => {
  it('adds a reaction when the caller has not reacted with that type yet', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: ME, portal_enabled: true }, error: null }),
        community_posts: () => ({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null }),
        community_reactions: (op) => (op === 'select' ? { data: null, error: null } : { data: {}, error: null }),
      },
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(memberReq({ post_id: '11111111-1111-4111-8111-111111111111', reaction_type: 'pray' }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ reacted: true });
  });

  it('removes the reaction on a second call — a toggle, not an accumulator', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: ME, portal_enabled: true }, error: null }),
        community_posts: () => ({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null }),
        community_reactions: (op) => (op === 'select' ? { data: { id: 'reaction-1' }, error: null } : { data: {}, error: null }),
      },
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(memberReq({ post_id: '11111111-1111-4111-8111-111111111111', reaction_type: 'pray' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ reacted: false });
  });

  it('404s reacting to a post the caller cannot see (not found in their church)', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: ME, portal_enabled: true }, error: null }),
        community_posts: () => ({ data: null, error: null }),
      },
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(memberReq({ post_id: '22222222-2222-4222-8222-222222222222', reaction_type: 'pray' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects a reaction_type outside the allowed set', async () => {
    const supabase = createMockSupabase({
      tables: { people: () => ({ data: { id: ME, portal_enabled: true }, error: null }) },
    });
    const handler = await loadHandler(supabase);
    const res = fakeRes();

    await handler(memberReq({ post_id: '11111111-1111-4111-8111-111111111111', reaction_type: 'laugh' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
