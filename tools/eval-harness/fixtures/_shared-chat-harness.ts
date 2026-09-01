/**
 * Minimal mock-Claude/mock-Supabase plumbing for exercising the full
 * api/grace/_chat.ts route from an EvalCase's run().
 *
 * api/grace/_chat.central-henderson-fixture.test.ts — the authoritative
 * Fixture #001 regression test, left completely unmodified — duplicates
 * this same plumbing locally rather than exporting it, matching this
 * codebase's established self-contained-test-file convention. There is no
 * surface to import from that file, so this module duplicates it once
 * here, for reuse across every Fixture #001 EvalCase, rather than
 * re-duplicating it per case.
 *
 * NOT a test file itself (no .test. in the name) — vitest's `tools/**`
 * include glob will not pick this up directly.
 */
import { vi } from 'vitest';
import { createMockSupabase } from '../../../tests/fixtures/mockSupabase.js';
import { FIXTURE_STAFF_USER } from '../../../tests/fixtures/shared-platform.js';

export function makeReq(body: unknown) {
  return { method: 'POST', headers: { authorization: 'Bearer valid-token' }, body } as unknown as import('@vercel/node').VercelRequest;
}

export function makeRes() {
  const written: string[] = [];
  const headers: Record<string, string> = {};
  const res: Record<string, unknown> = {
    written, headers,
    setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
    removeHeader: vi.fn((k: string) => { delete headers[k]; }),
    write: vi.fn((chunk: string) => { written.push(chunk); }),
    end: vi.fn(),
    send: vi.fn((text: string) => { written.push(text); }),
  };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { written: string[] };
}

function sseFrame(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function mockClaudeStream(chunks: string[]) {
  const capture: { prompt?: string } = {};
  const fetchImpl = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { stream?: boolean; messages: Array<{ content: string }> };
    if (body.stream) {
      capture.prompt = body.messages[0].content;
      const encoder = new TextEncoder();
      const frames = [
        sseFrame({ type: 'message_start', message: { usage: { input_tokens: 500 } } }),
        ...chunks.map(c => sseFrame({ type: 'content_block_delta', delta: { type: 'text_delta', text: c } })),
        sseFrame({ type: 'message_delta', usage: { output_tokens: 50 } }),
      ];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) { for (const f of frames) controller.enqueue(encoder.encode(f)); controller.close(); },
      });
      return { ok: true, body: stream };
    }
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '[]' }], usage: {} }) };
  });
  return { fetchImpl, capture };
}

export interface SupabaseForOpts {
  knowledgeRows?: unknown[];
  /** Fixture #003 (people/households REMEMBER): person rows for name-matching in retrieveMemories. */
  people?: Array<{ id: string; first_name: string; last_name: string }>;
  /** Fixture #003 (people/households REMEMBER): pre-existing grace_memories rows. */
  existingMemories?: Array<{ id: string; content: string; source: string; person_ids: string[]; status: string; expires_at: string | null; created_at: string }>;
  /** Self-awareness fixture (Prompt 9): the actor's granted permission keys — defaults to the baseline 'ask_grace.use' so every existing caller is unaffected. An empty array simulates an authenticated-but-unpermissioned actor. */
  permissions?: string[];
}

export function supabaseFor(opts: SupabaseForOpts = {}) {
  const permissionKeys = opts.permissions ?? ['ask_grace.use'];
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active', person_id: null } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: permissionKeys.map(key => ({ permissions: { key } })) }),
      grace_conversations: (op) => op === 'select' ? { data: null } : { data: { id: 'conv-new' } },
      grace_messages: (op) => op === 'select' ? { data: [] } : { data: { id: `msg-${Math.random().toString(36).slice(2)}` } },
      grace_memories: (op) => op === 'select' ? { data: opts.existingMemories ?? [] } : { data: { id: 'mem-new', content: 'saved', source: 'user_stated', person_ids: [], created_at: '2026-08-30T00:00:00.000Z' } },
      grace_knowledge: () => ({ data: opts.knowledgeRows ?? [] }),
      people: () => ({ data: opts.people ?? [] }),
      church_ai_budgets: () => ({ data: { monthly_cap_micro_usd: 100_000_000, hard_cutoff_multiplier: 1.1 } }),
      token_usage: () => ({ data: [] }),
    },
  });
}

export async function postToChat(
  supabase: ReturnType<typeof supabaseFor>,
  body: unknown,
  fetchImpl: typeof fetch,
  churchId: string,
  /**
   * Deterministic-tier cases never reach Anthropic for real (fetch is
   * mocked), so a fake key is fine there. The live-judgment tier passes
   * the REAL global fetch and needs the real key to reach the real API —
   * override this to a real process.env.ANTHROPIC_API_KEY value in that
   * case, never hardcode a live key call site to the fake default.
   */
  anthropicApiKey = 'test-anthropic-key',
) {
  vi.resetModules();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.ANTHROPIC_API_KEY = anthropicApiKey;

  global.fetch = fetchImpl;
  vi.doMock('@clerk/backend', () => ({ verifyToken: vi.fn().mockResolvedValue({ sub: FIXTURE_STAFF_USER.clerk_id, app_metadata: { church_id: churchId } }) }));
  vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn().mockReturnValue(supabase) }));

  const handler = (await import('../../../api/grace/_chat.js')).default;
  const res = makeRes();
  await handler(makeReq(body), res);
  return res;
}
