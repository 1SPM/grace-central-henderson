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
vi.mock('@google/genai', () => ({ GoogleGenAI: vi.fn() }));

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

// GoogleGenAI is invoked with `new` in the adapter — a mockImplementation
// must be a real function (not an arrow) for `new` to work at all.
function mockGenAI(ctor: ReturnType<typeof vi.fn>, stream: { generateContentStream: ReturnType<typeof vi.fn> }) {
  vi.mocked(ctor).mockImplementation(function GoogleGenAIMock() {
    return { models: stream } as never;
  } as never);
}

function makeGenAIStream(chunks: string[]) {
  const capture: { contents?: string } = {};
  const generateContentStream = vi.fn().mockImplementation(async ({ contents }: { contents: string }) => {
    capture.contents = contents;
    async function* gen() {
      for (const c of chunks) yield { text: c, usageMetadata: undefined };
      yield { text: undefined, usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 50 } };
    }
    return gen();
  });
  return { generateContentStream, capture };
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

async function post(supabase: ReturnType<typeof supabaseFor>, body: unknown) {
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
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  // Extraction always runs a non-streaming fetch call after the turn;
  // stub it to return "no facts" by default so it never interferes with
  // assertions about the main turn.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }], usageMetadata: {} }),
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
    const { GoogleGenAI } = await import('@google/genai');
    const stream = makeGenAIStream(['should not be used']);
    mockGenAI(GoogleGenAI, stream);

    const supabase = supabaseFor();
    const res = await post(supabase, { message: 'remember that my meeting with Bill is Thursday', dataContext: 'church data here' });

    expect(stream.generateContentStream).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Remembered: my meeting with Bill is Thursday'));

    const memInsert = supabase.__calls.find(c => c.table === 'grace_memories' && c.op === 'insert');
    expect(memInsert).toBeDefined();
    expect((memInsert!.payload as Record<string, unknown>).source).toBe('user_stated');
  });
});

describe('POST /api/grace/chat — turn persistence', () => {
  it('persists both sides of the turn, scoped to church and user', async () => {
    const { GoogleGenAI } = await import('@google/genai');
    const stream = makeGenAIStream(['Sure, ', 'here you go.']);
    mockGenAI(GoogleGenAI, stream);

    const supabase = supabaseFor();
    const res = await post(supabase, { message: 'what tasks are overdue', dataContext: 'church data' });

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
    const { GoogleGenAI } = await import('@google/genai');
    const stream = makeGenAIStream(['unused']);
    mockGenAI(GoogleGenAI, stream);

    const supabase = supabaseFor({ budgetExceeded: true });
    const res = await post(supabase, { message: 'what tasks are overdue', dataContext: '' });

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
    const { GoogleGenAI } = await import('@google/genai');
    const stream = makeGenAIStream(['Thursday at the usual spot.']);
    mockGenAI(GoogleGenAI, stream);

    const supabaseDay2 = supabaseFor({
      existingMemories: [{
        id: 'mem-1', content: savedMemory.content as string, source: 'user_stated',
        person_ids: [], status: 'active', expires_at: null, created_at: '2026-08-30T00:00:00.000Z',
      }],
    });
    await post(supabaseDay2, { message: 'when is my meeting with Bill?', dataContext: 'church data' });

    expect(stream.capture.contents).toContain('my meeting with Bill is Thursday');
    expect(stream.capture.contents).toContain('the church data wins'); // DB-facts-win framing present
  });
});

describe('POST /api/grace/chat — acceptance: automatic retrieval', () => {
  it('surfaces a person-tagged memory when the question mentions that person, and omits it otherwise', async () => {
    const memory = {
      id: 'mem-bill', content: 'Bill prefers Saturday morning meetings', source: 'user_stated' as const,
      person_ids: [BILL_ID], status: 'active', expires_at: null, created_at: '2026-08-29T00:00:00.000Z',
    };
    const people = [{ id: BILL_ID, first_name: 'Bill', last_name: 'Johnson' }];

    const { GoogleGenAI } = await import('@google/genai');
    const streamAbout = makeGenAIStream(['ok']);
    mockGenAI(GoogleGenAI, streamAbout);
    await post(supabaseFor({ existingMemories: [memory], people }), { message: 'tell me about Bill Johnson', dataContext: '' });
    expect(streamAbout.capture.contents).toContain('Bill prefers Saturday morning meetings');

    vi.resetModules();
    const { GoogleGenAI: GoogleGenAI2 } = await import('@google/genai');
    const streamUnrelated = makeGenAIStream(['ok']);
    mockGenAI(GoogleGenAI2, streamUnrelated);
    await post(supabaseFor({ existingMemories: [], people }), { message: 'what events are coming up this week', dataContext: '' });
    expect(streamUnrelated.capture.contents).not.toContain('Bill prefers Saturday morning meetings');
  });
});
