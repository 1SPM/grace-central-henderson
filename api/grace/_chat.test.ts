/**
 * Route tests for POST/GET /api/grace/chat (ADR-014, Memory V1).
 *
 * Covers the founder's acceptance story directly:
 *   - cross-session recall: a fact saved in one handler invocation is
 *     present in the prompt sent to the model in a completely separate
 *     invocation (no shared in-memory state — mirrors two different days).
 *   - automatic retrieval: a memory tagged with a person shows up when
 *     the question mentions that person, and is absent otherwise.
 * Plus the route-level contract: auth, the "remember that…" short
 * circuit, per-turn persistence scoping, and budget refusal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

const BILL_ID = '88888888-8888-4888-8888-888888888888';

function makeReq(body: unknown, method: 'GET' | 'POST' = 'POST') {
  return { method, headers: { authorization: 'Bearer valid-token' }, body } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const written: string[] = [];
  const headers: Record<string, string> = {};
  const res: Record<string, unknown> = {
    written,
    headers,
    setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
    removeHeader: vi.fn((k: string) => { delete headers[k]; }),
    write: vi.fn((chunk: string) => { written.push(chunk); }),
    end: vi.fn(),
    send: vi.fn((text: string) => { written.push(text); }),
  };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & {
    written: string[]; headers: Record<string, string>;
    status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>;
  };
}

function sseFrame(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Mocks Claude's streaming Messages API (used for the main turn) AND its
 * non-streaming form (used by the post-turn extraction pass) behind one
 * fetch stub — the two are told apart by the `stream` flag in the
 * request body, exactly like the real endpoint hits both in one turn.
 * `capture.prompt` records the streaming call's message content, mirroring
 * the acceptance tests' need to inspect what was actually sent to the model.
 */
function mockClaudeStream(chunks: string[]) {
  const capture: { prompt?: string } = {};
  const generateContentStream = vi.fn();
  const fetchImpl = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { stream?: boolean; messages: Array<{ content: string }> };
    generateContentStream();
    if (body.stream) {
      capture.prompt = body.messages[0].content;
      const encoder = new TextEncoder();
      const frames = [
        sseFrame({ type: 'message_start', message: { usage: { input_tokens: 500 } } }),
        ...chunks.map(c => sseFrame({ type: 'content_block_delta', delta: { type: 'text_delta', text: c } })),
        sseFrame({ type: 'message_delta', usage: { output_tokens: 50 } }),
      ];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const f of frames) controller.enqueue(encoder.encode(f));
          controller.close();
        },
      });
      return { ok: true, body: stream };
    }
    // Extraction call (non-streaming) — default to no facts so it never
    // interferes with assertions about the main turn.
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '[]' }], usage: {} }) };
  });
  return { fetchImpl, capture, generateContentStream };
}

interface SupabaseOpts {
  existingMemories?: Array<{ id: string; content: string; source: string; person_ids: string[]; status: string; expires_at: string | null; created_at: string }>;
  conversationId?: string | null;
  budgetExceeded?: boolean;
  people?: Array<{ id: string; first_name: string; last_name: string }>;
}

function supabaseFor(opts: SupabaseOpts = {}) {
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active', person_id: null } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: [{ permissions: { key: 'ask_grace.use' } }] }),
      grace_conversations: (op) => op === 'select'
        ? { data: opts.conversationId ? { id: opts.conversationId } : null }
        : { data: { id: 'conv-new' } },
      grace_messages: (op) => op === 'select'
        ? { data: [] }
        : { data: { id: `msg-${Math.random().toString(36).slice(2)}` } },
      grace_memories: (op) => op === 'select'
        ? { data: opts.existingMemories ?? [] }
        : { data: { id: 'mem-new', content: 'saved', source: 'user_stated', person_ids: [], created_at: '2026-08-30T00:00:00.000Z' } },
      people: () => ({ data: opts.people ?? [] }),
      church_ai_budgets: () => ({ data: { monthly_cap_micro_usd: opts.budgetExceeded ? 100 : 100_000_000, hard_cutoff_multiplier: 1.1 } }),
      token_usage: () => ({ data: opts.budgetExceeded ? [{ cost_micro_usd: 1_000_000, created_at: new Date().toISOString() }] : [] }),
    },
  });
}

async function post(supabase: ReturnType<typeof supabaseFor>, body: unknown, fetchImpl?: typeof fetch) {
  if (fetchImpl) global.fetch = fetchImpl;
  const handler = (await import('./_chat.js')).default;
  const { createClient } = await import('@supabase/supabase-js');
  vi.mocked(createClient).mockReturnValue(supabase as never);
  const res = makeRes();
  await handler(makeReq(body), res);
  return res;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  // Default fetch: extraction-shaped response ("no facts") so any test
  // that doesn't care about the model call still gets something sane.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: '[]' }], usage: {} }),
  }) as unknown as typeof fetch;

  const { verifyToken } = await import('@clerk/backend');
  (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    sub: FIXTURE_STAFF_USER.clerk_id,
    app_metadata: { church_id: FIXTURE_CHURCH_ID },
  });
});

describe('POST /api/grace/chat — auth', () => {
  it('401s without a valid Clerk token', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invalid token'));

    const res = await post(supabaseFor(), { message: 'hello', dataContext: '' });
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('POST /api/grace/chat — "remember that…" short circuit', () => {
  it('writes a user_stated memory and replies without calling the model', async () => {
    const stream = mockClaudeStream(['should not be used']);

    const supabase = supabaseFor();
    const res = await post(supabase, { message: 'remember that my meeting with Bill is Thursday', dataContext: 'church data here' }, stream.fetchImpl);

    expect(stream.generateContentStream).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Remembered: my meeting with Bill is Thursday'));

    const memInsert = supabase.__calls.find(c => c.table === 'grace_memories' && c.op === 'insert');
    expect(memInsert).toBeDefined();
    expect((memInsert!.payload as Record<string, unknown>).source).toBe('user_stated');
  });
});

describe('POST /api/grace/chat — turn persistence', () => {
  it('persists both sides of the turn, scoped to church and user', async () => {
    const stream = mockClaudeStream(['Sure, ', 'here you go.']);

    const supabase = supabaseFor();
    const res = await post(supabase, { message: 'what tasks are overdue', dataContext: 'church data' }, stream.fetchImpl);

    expect(res.written.join('')).toBe('Sure, here you go.');

    const inserts = supabase.__calls.filter(c => c.table === 'grace_messages' && c.op === 'insert');
    expect(inserts).toHaveLength(2);
    for (const call of inserts) {
      const payload = call.payload as Record<string, unknown>;
      expect(payload.church_id).toBe(FIXTURE_CHURCH_ID);
      expect(payload.user_id).toBe(FIXTURE_STAFF_USER.id);
    }
    expect((inserts[0].payload as Record<string, unknown>).role).toBe('user');
    expect((inserts[1].payload as Record<string, unknown>).role).toBe('assistant');
    expect((inserts[1].payload as Record<string, unknown>).content).toBe('Sure, here you go.');
  });

  it('refuses with 402 when the church AI budget is exhausted, and never calls the model', async () => {
    const stream = mockClaudeStream(['unused']);

    const supabase = supabaseFor({ budgetExceeded: true });
    const res = await post(supabase, { message: 'what tasks are overdue', dataContext: '' }, stream.fetchImpl);

    expect(stream.generateContentStream).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'ai_budget_exceeded' }));
  });
});

describe('POST /api/grace/chat — acceptance: cross-session recall', () => {
  it('a fact saved in one invocation is present in the prompt of a completely separate invocation', async () => {
    // Invocation 1 (simulating "today"): explicit remember directive.
    const supabaseDay1 = supabaseFor();
    await post(supabaseDay1, { message: 'remember that my meeting with Bill is Thursday', dataContext: '' });
    const savedMemory = supabaseDay1.__calls.find(c => c.table === 'grace_memories' && c.op === 'insert')!.payload as Record<string, unknown>;

    // Invocation 2 ("tomorrow"): a brand new supabase mock and a fresh
    // module registry — nothing is shared except what the fixture below
    // hands back for a select on grace_memories, exactly like a real
    // second request would read from the database.
    vi.resetModules();
    const stream = mockClaudeStream(['Thursday at the usual spot.']);

    const supabaseDay2 = supabaseFor({
      existingMemories: [{
        id: 'mem-1', content: savedMemory.content as string, source: 'user_stated',
        person_ids: [], status: 'active', expires_at: null, created_at: '2026-08-30T00:00:00.000Z',
      }],
    });
    await post(supabaseDay2, { message: 'when is my meeting with Bill?', dataContext: 'church data' }, stream.fetchImpl);

    expect(stream.capture.prompt).toContain('my meeting with Bill is Thursday');
    expect(stream.capture.prompt).toContain('the church data wins'); // DB-facts-win framing present
  });
});

describe('POST /api/grace/chat — acceptance: automatic retrieval', () => {
  it('surfaces a person-tagged memory when the question mentions that person, and omits it otherwise', async () => {
    const memory = {
      id: 'mem-bill', content: 'Bill prefers Saturday morning meetings', source: 'user_stated' as const,
      person_ids: [BILL_ID], status: 'active', expires_at: null, created_at: '2026-08-29T00:00:00.000Z',
    };
    const people = [{ id: BILL_ID, first_name: 'Bill', last_name: 'Johnson' }];

    const streamAbout = mockClaudeStream(['ok']);
    await post(supabaseFor({ existingMemories: [memory], people }), { message: 'tell me about Bill Johnson', dataContext: '' }, streamAbout.fetchImpl);
    expect(streamAbout.capture.prompt).toContain('Bill prefers Saturday morning meetings');

    vi.resetModules();
    const streamUnrelated = mockClaudeStream(['ok']);
    await post(supabaseFor({ existingMemories: [], people }), { message: 'what events are coming up this week', dataContext: '' }, streamUnrelated.fetchImpl);
    expect(streamUnrelated.capture.prompt).not.toContain('Bill prefers Saturday morning meetings');
  });
});
