/**
 * Member-assistant harness for the eval framework — drives
 * api/_lib/ai/assistant-runtime.ts's runAssistantTurn directly. There is
 * no HTTP indirection worth mocking for the deterministic tier:
 * api/portal/_assistant.ts only parses, validates, and delegates.
 *
 * Deliberately a SIBLING of _shared-chat-harness.ts (staff Ask GRACE via
 * postToChat), not an extension of it. The two assistants are separate
 * stacks with different guarantees (docs/GRACE_INTELLIGENCE_
 * QUALIFICATION_FRAMEWORK.md, "Scope"): the member runtime has no HTTP
 * handler in the loop, no server-side conversation table, and — today —
 * no memory at all (docs/AI_BOUNDARIES.md:98). This harness exists so the
 * member surface can be qualified on its own terms; see
 * docs/MEMBER_MEMORY_QUALIFICATION_PLAN.md.
 *
 * Two seams, matching how the runtime is actually wired:
 *   - Claude goes through the injected `fetchImpl` on AssistantTurnInput
 *     (added for exactly this harness, mirroring grace-memory.ts's
 *     RunExtractionInput.fetchImpl). mockClaudeToolLoop() scripts one
 *     response per model call and captures every request's system
 *     instruction, messages, and declared tool names.
 *   - Moderation reads GLOBAL fetch: moderation.ts's moderate() takes an
 *     optional fetchImpl, but the runtime calls it with no options, so
 *     there is no injection point. installModerationStub() stubs global
 *     fetch for the OpenAI URL only and THROWS on any other URL — so if a
 *     model call ever leaks to global fetch instead of the injected seam,
 *     the case fails loudly instead of silently succeeding.
 *
 * The `member_memories` table below is the ONLY stateful table: a row
 * inserted on turn 1 is visible to a select on turn 2, and a delete
 * clears it. The table does not exist in any migration yet — it is the
 * shape the qualification plan expects the future implementation to
 * create, so the deferred memory cases can be written against a real
 * fixture the moment they get a run().
 *
 * NOT a test file (no .test. in the name) — vitest's tools/** glob will
 * not collect it directly.
 */
import { vi, type Mock } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMockSupabase } from '../../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_OTHER_CHURCH_ID, FIXTURE_PERSON } from '../../../tests/fixtures/shared-platform.js';
import type { MemberActor } from '../../../api/_lib/authz.js';
import {
  runAssistantTurn,
  type AssistantHistoryTurn,
  type AssistantTurnResult,
} from '../../../api/_lib/ai/assistant-runtime.js';
import type { ClaudeMessage } from '../../../api/_lib/ai/adapters/claude.js';

// ---------------------------------------------------------------------
// Actors — every id is fabricated; nothing here is real personal data.
// ---------------------------------------------------------------------

/** The member under test: FIXTURE_PERSON, portal-enabled, staff-reviewed. */
export const MEMBER_ACTOR: MemberActor = {
  kind: 'member',
  personId: FIXTURE_PERSON.id,
  clerkUserId: FIXTURE_PERSON.clerk_user_id,
  churchId: FIXTURE_CHURCH_ID,
  identityVerified: true,
};

/** A DIFFERENT member of the SAME church — the cross-member isolation actor. */
export const OTHER_MEMBER_ACTOR: MemberActor = {
  kind: 'member',
  personId: '88888888-8888-4888-8888-888888888888',
  clerkUserId: 'user_test_othermember_0001',
  churchId: FIXTURE_CHURCH_ID,
  identityVerified: true,
};

/** A member of a DIFFERENT church — the tenant-isolation actor. */
export const OTHER_CHURCH_MEMBER_ACTOR: MemberActor = {
  kind: 'member',
  personId: '77777777-7777-4777-8777-777777777777',
  clerkUserId: 'user_test_otherchurch_0001',
  churchId: FIXTURE_OTHER_CHURCH_ID,
  identityVerified: true,
};

// ---------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------

/** The row shape the future member_memories table is expected to have —
 *  mirrors grace_memories (migration 075) keyed by person_id instead of
 *  the staff-only user_id. See docs/MEMBER_MEMORY_QUALIFICATION_PLAN.md. */
export interface MemberMemoryRow {
  id: string;
  church_id: string;
  person_id: string;
  content: string;
  source: 'user_stated' | 'ai_extracted';
  status: 'active' | 'superseded' | 'expired';
  expires_at: string | null;
  created_at: string;
}

export interface MemberSupabaseForOpts {
  /** Pre-existing member_memories rows (any person, any church) — the
   *  select handler returns ONLY active, unexpired rows, exactly as the
   *  future retrieveMemberMemories query is expected to. Person/church
   *  scoping is NOT applied by the mock (its .eq() is a no-op — see
   *  tests/fixtures/mockSupabase.ts) — a case proving isolation must
   *  assert on the recorded .eq() filters via eqFiltersFor(), not on the
   *  returned rows. */
  memories?: MemberMemoryRow[];
  /** The single `people` row get_my_profile's .maybeSingle() resolves to. */
  person?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null;
}

export type MemberSupabase = ReturnType<typeof createMockSupabase> & { __memories: MemberMemoryRow[] };

export function memberSupabaseFor(opts: MemberSupabaseForOpts = {}): MemberSupabase {
  const memories: MemberMemoryRow[] = [...(opts.memories ?? [])];
  const person = opts.person === undefined
    ? { id: FIXTURE_PERSON.id, first_name: FIXTURE_PERSON.first_name, last_name: FIXTURE_PERSON.last_name, email: 'test.member@example.invalid', phone: null }
    : opts.person;

  const supabase = createMockSupabase({
    tables: {
      church_ai_budgets: () => ({ data: null }),          // no row → default cap, plenty of headroom
      token_usage: () => ({ data: [] }),                  // zero spend this month
      security_events: () => ({ data: { id: 'sec-1' } }),
      platform_events: () => ({ data: { id: 'evt-1' } }),
      care_requests: () => ({ data: { id: 'cr-1' } }),
      consents: () => ({ data: null }),
      prayer_requests: () => ({ data: [] }),
      people: () => ({ data: person }),
      member_memories: (op, payload) => {
        if (op === 'insert') {
          const rows = (Array.isArray(payload) ? payload : [payload]) as Partial<MemberMemoryRow>[];
          for (const r of rows) {
            memories.push({
              id: `mem-${memories.length + 1}`,
              status: 'active',
              expires_at: null,
              created_at: new Date().toISOString(),
              ...r,
            } as MemberMemoryRow);
          }
          return { data: memories[memories.length - 1] };
        }
        if (op === 'delete') {
          // The mock cannot see which row the filters targeted; a delete
          // clears the table. A future delete case asserts on the recorded
          // .eq() filters (person_id + church_id + id) for the scoping proof.
          memories.splice(0, memories.length);
          return { data: null };
        }
        const now = Date.now();
        return { data: memories.filter(m => m.status === 'active' && (!m.expires_at || Date.parse(m.expires_at) > now)) };
      },
    },
  });

  return Object.assign(supabase, { __memories: memories });
}

// ---------------------------------------------------------------------
// Claude (injected fetchImpl seam)
// ---------------------------------------------------------------------

export type ScriptedModelTurn =
  | { text: string }
  | { toolCalls: Array<{ id?: string; name: string; input?: Record<string, unknown> }> };

export interface ClaudeCapturedCall {
  system: string;
  messages: ClaudeMessage[];
  /** Tool names the runtime DECLARED to the model on this call. */
  tools: string[];
}

export interface ClaudeCapture {
  calls: ClaudeCapturedCall[];
}

/**
 * Scripts the model, one entry per model call, in order. When the script
 * runs out the model answers a plain "ok" so a case can't hang on an
 * unexpected extra loop iteration. Returns the Anthropic JSON shape
 * callClaudeWithTools parses (content blocks + usage), never a
 * ClaudeToolCallResult — this stubs the wire, not the adapter.
 */
export function mockClaudeToolLoop(script: ScriptedModelTurn[]) {
  const capture: ClaudeCapture = { calls: [] };
  const queue = [...script];
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (!u.includes('api.anthropic.com/v1/messages')) {
      throw new Error(`member harness fetchImpl only serves the Anthropic Messages API; got ${u}`);
    }
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      system: string;
      messages: ClaudeMessage[];
      tools?: Array<{ name: string }>;
    };
    capture.calls.push({ system: body.system, messages: body.messages, tools: (body.tools ?? []).map(t => t.name) });

    const next = queue.shift() ?? { text: 'ok' };
    const content = 'text' in next
      ? [{ type: 'text', text: next.text }]
      : next.toolCalls.map((c, i) => ({
          type: 'tool_use',
          id: c.id ?? `toolu_${capture.calls.length}_${i}`,
          name: c.name,
          input: c.input ?? {},
        }));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content,
        stop_reason: 'text' in next ? 'end_turn' : 'tool_use',
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    } as unknown as Response;
  });
  return { fetchImpl: spy as unknown as typeof fetch, spy, capture };
}

// ---------------------------------------------------------------------
// Moderation (global fetch seam)
// ---------------------------------------------------------------------

/**
 * Global fetch serves ONLY the OpenAI moderation endpoint and throws for
 * anything else. That throw is deliberate: a model call reaching global
 * fetch means it bypassed the injected seam, which a case must never
 * silently absorb.
 */
export function installModerationStub(opts: { flagged?: boolean } = {}) {
  process.env.OPENAI_API_KEY = 'test-moderation-key';
  const spy = vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('api.openai.com/v1/moderations')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [{ flagged: Boolean(opts.flagged), categories: opts.flagged ? { harassment: true } : {} }] }),
      } as unknown as Response;
    }
    throw new Error(`global fetch reached for ${u} — the model must go through the injected fetchImpl, never global fetch`);
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

export function resetModerationStub(): void {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
}

// ---------------------------------------------------------------------
// Driving a turn
// ---------------------------------------------------------------------

/** Let fire-and-forget writes (recordUsage is `void`-called) land before
 *  a case inspects the recorded calls. */
export async function settle(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

export interface RunMemberTurnOpts {
  supabase: MemberSupabase;
  member?: MemberActor;
  message: string;
  history?: AssistantHistoryTurn[];
  claude: { fetchImpl: typeof fetch };
  moderation?: { flagged?: boolean };
}

/**
 * One member turn end to end through the real runtime, with moderation
 * stubbed and torn down around it so cases never leak the global stub
 * into each other.
 */
export async function runMemberTurn(opts: RunMemberTurnOpts): Promise<AssistantTurnResult> {
  installModerationStub(opts.moderation);
  try {
    const result = await runAssistantTurn({
      supabase: opts.supabase as unknown as SupabaseClient,
      member: opts.member ?? MEMBER_ACTOR,
      message: opts.message,
      history: opts.history,
      apiKey: 'test-anthropic-key',
      fetchImpl: opts.claude.fetchImpl,
    });
    await settle();
    return result;
  } finally {
    resetModerationStub();
  }
}

// ---------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------

type RecordedCall = { table: string; op: string; payload: unknown };

/** Every insert/upsert recorded against `table`. */
export function writesTo(supabase: MemberSupabase, table: string): RecordedCall[] {
  return supabase.__calls.filter(c => c.table === table && (c.op === 'insert' || c.op === 'upsert'));
}

/** Distinct tables that received any mutating call (insert/upsert/update/delete). */
export function writtenTables(supabase: MemberSupabase): string[] {
  const mutating = new Set(['insert', 'upsert', 'update', 'delete']);
  return [...new Set(supabase.__calls.filter(c => mutating.has(c.op)).map(c => c.table))];
}

/** True when any mutating call's payload, serialized, contains `needle`. */
export function anyWriteContains(supabase: MemberSupabase, needle: string): boolean {
  const mutating = new Set(['insert', 'upsert', 'update']);
  return supabase.__calls
    .filter(c => mutating.has(c.op))
    .some(c => JSON.stringify(c.payload ?? null).includes(needle));
}

/**
 * The (column, value) pairs every `.eq()` call recorded against `table`'s
 * select builders. This is the ONLY way to prove scoping with the shared
 * mock — its filters are no-ops on the returned data, but the builder
 * each `.select()` returns is a stable spy whose `.eq` records its args.
 */
export function eqFiltersFor(supabase: MemberSupabase, table: string): Array<[string, unknown]> {
  const entry = supabase.from(table) as unknown as { select: Mock };
  const out: Array<[string, unknown]> = [];
  for (const r of entry.select.mock.results) {
    const builder = r.value as { eq?: Mock } | undefined;
    for (const call of builder?.eq?.mock.calls ?? []) {
      out.push([String(call[0]), call[1]]);
    }
  }
  return out;
}

/** The tool_result blocks the runtime sent back to the model on the
 *  call after a tool_use — where an unknown tool's `unknown_tool` marker
 *  lands. */
export function toolResultsSentOnCall(capture: ClaudeCapture, callIndex: number): Array<{ tool_use_id: string; content: string }> {
  const call = capture.calls[callIndex];
  if (!call) return [];
  const out: Array<{ tool_use_id: string; content: string }> = [];
  for (const m of call.messages) {
    if (m.role !== 'user' || typeof m.content === 'string') continue;
    for (const block of m.content) {
      if (block.type === 'tool_result') out.push({ tool_use_id: block.tool_use_id, content: block.content });
    }
  }
  return out;
}
