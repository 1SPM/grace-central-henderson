/**
 * Grace staff memory (ADR-014, migration 075).
 *
 * Owns everything that reads/writes grace_conversations, grace_messages,
 * and grace_memories: the explicit "remember that…" directive, the
 * post-turn extraction pass, retrieval, and the prompt block that presents
 * memories to the model as supplementary context — never as church data.
 *
 * Every function here takes a service-role SupabaseClient. RLS on these
 * tables is SELECT-only (migration 075); this module is the only writer.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { generate } from './ai/gateway.js';
import { callClaude, DEFAULT_CLAUDE_MODEL } from './ai/adapters/claude.js';

export interface GraceMemoryRow {
  id: string;
  content: string;
  source: 'user_stated' | 'ai_extracted';
  person_ids: string[];
  created_at: string;
}

// ---------------------------------------------------------------------
// Explicit directive — "remember that I have a meeting with Bill Thursday"
// ---------------------------------------------------------------------

function normalizeMemoryText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Ported from src/lib/grace-brain.ts (client-side version now retired in
 *  favor of this server-side path — see GraceChatContext.tsx). */
export function parseRememberDirective(input: string): string | null {
  const trimmed = normalizeMemoryText(input);
  const match = trimmed.match(/^remember(?:\s+that)?\s+(.+)$/i);
  if (!match) return null;
  const memory = normalizeMemoryText(match[1]);
  return memory.length >= 2 ? memory : null;
}

// ---------------------------------------------------------------------
// Person-name resolution — links a memory to the people it mentions so
// entity-scoped retrieval ("tell me about Bill") can find it later.
// ---------------------------------------------------------------------

export async function resolvePersonIds(
  supabase: SupabaseClient,
  churchId: string,
  names: string[],
): Promise<string[]> {
  if (names.length === 0) return [];

  const { data } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('church_id', churchId);

  const people = (data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>;
  const matched = new Set<string>();

  for (const name of names) {
    const needle = name.trim().toLowerCase();
    if (!needle) continue;
    for (const p of people) {
      const full = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim().toLowerCase();
      const first = (p.first_name ?? '').toLowerCase();
      if (full === needle || (first && first === needle) || (full && full.includes(needle))) {
        matched.add(p.id);
      }
    }
  }
  return [...matched];
}

// ---------------------------------------------------------------------
// Write path — dedupe + provenance
// ---------------------------------------------------------------------

export interface SaveMemoryInput {
  churchId: string;
  userId: string;
  content: string;
  source: 'user_stated' | 'ai_extracted';
  sourceMessageId?: string | null;
  sourceConversationId?: string | null;
  personIds?: string[];
  expiresAt?: string | null;
}

/**
 * Inserts a memory unless an active memory with the same normalized text
 * already exists for this user — a staff member repeating themselves
 * shouldn't pile up duplicate rows. Returns the inserted row, or null when
 * skipped as a duplicate or on write failure (never throws — callers must
 * not fail the chat turn because a memory write failed).
 */
export async function saveMemory(supabase: SupabaseClient, input: SaveMemoryInput): Promise<GraceMemoryRow | null> {
  const content = normalizeMemoryText(input.content);
  if (content.length < 2) return null;

  const { data: existing } = await supabase
    .from('grace_memories')
    .select('id, content')
    .eq('church_id', input.churchId)
    .eq('user_id', input.userId)
    .eq('status', 'active');

  const key = content.toLowerCase();
  const dupe = ((existing ?? []) as Array<{ content: string }>).some(row => row.content.toLowerCase() === key);
  if (dupe) return null;

  const { data, error } = await supabase
    .from('grace_memories')
    .insert({
      church_id: input.churchId,
      user_id: input.userId,
      content,
      source: input.source,
      source_message_id: input.sourceMessageId ?? null,
      source_conversation_id: input.sourceConversationId ?? null,
      person_ids: input.personIds ?? [],
      expires_at: input.expiresAt ?? null,
    })
    .select('id, content, source, person_ids, created_at')
    .single();

  if (error || !data) return null;
  return data as GraceMemoryRow;
}

// ---------------------------------------------------------------------
// Retrieval — "knows when to go look"
// ---------------------------------------------------------------------

function tokenizeQuery(query: string): string[] {
  return query
    .split(/[^a-zA-Z']+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);
}

function activeFilter<T extends { status?: string; expires_at?: string | null }>(rows: T[]): T[] {
  const now = Date.now();
  return rows.filter(r => (!r.status || r.status === 'active') && (!r.expires_at || new Date(r.expires_at).getTime() > now));
}

/**
 * Union of three cheap lookups: recency, full-text relevance, and
 * person-entity match. Deduped, capped at 15. No tool-calling / embeddings
 * in V1 (docs: ADR-014) — this is deliberately "nothing fancy."
 */
export async function retrieveMemories(
  supabase: SupabaseClient,
  opts: { churchId: string; userId: string; query: string },
): Promise<GraceMemoryRow[]> {
  const byId = new Map<string, GraceMemoryRow>();

  const { data: recent } = await supabase
    .from('grace_memories')
    .select('id, content, source, person_ids, status, expires_at, created_at')
    .eq('church_id', opts.churchId)
    .eq('user_id', opts.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(8);
  for (const row of activeFilter((recent ?? []) as Array<GraceMemoryRow & { status: string; expires_at: string | null }>)) {
    byId.set(row.id, row);
  }

  const tsQuery = tokenizeQuery(opts.query).join(' | ');
  if (tsQuery) {
    const { data: relevant } = await supabase
      .from('grace_memories')
      .select('id, content, source, person_ids, status, expires_at, created_at')
      .eq('church_id', opts.churchId)
      .eq('user_id', opts.userId)
      .eq('status', 'active')
      .textSearch('content_tsv', tsQuery, { type: 'websearch' })
      .limit(8);
    for (const row of activeFilter((relevant ?? []) as Array<GraceMemoryRow & { status: string; expires_at: string | null }>)) {
      byId.set(row.id, row);
    }
  }

  const nameTokens = tokenizeQuery(opts.query);
  if (nameTokens.length > 0) {
    const personIds = await resolvePersonIds(supabase, opts.churchId, nameTokens);
    if (personIds.length > 0) {
      const { data: entityMatches } = await supabase
        .from('grace_memories')
        .select('id, content, source, person_ids, status, expires_at, created_at')
        .eq('church_id', opts.churchId)
        .eq('user_id', opts.userId)
        .eq('status', 'active')
        .overlaps('person_ids', personIds)
        .limit(8);
      for (const row of activeFilter((entityMatches ?? []) as Array<GraceMemoryRow & { status: string; expires_at: string | null }>)) {
        byId.set(row.id, row);
      }
    }
  }

  // Chronological, oldest first — the model reads top-to-bottom, so the
  // most recent note (most likely to reflect the current state when two
  // notes conflict, e.g. a corrected date) lands last, closest to the
  // question. See buildMemoryBlock's explicit "trust the most recent"
  // instruction below — sort order and instruction work together.
  return [...byId.values()]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-15);
}

/**
 * The prompt block presenting memories to the model. Framed explicitly as
 * user-told context, not church data — if it conflicts with live church
 * data elsewhere in the prompt, the church data wins (ADR-014).
 */
export function buildMemoryBlock(memories: GraceMemoryRow[]): string {
  if (memories.length === 0) return '';
  const lines = memories.map(m => {
    const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const label = m.source === 'user_stated' ? 'you said' : 'noted from chat';
    return `- [${date}, ${label}] ${m.content}`;
  });
  return `\n== PERSONAL MEMORY (things this staff member told you earlier — may be stale or superseded, oldest to newest) ==\nThese are conversation notes, NOT church records. If anything here conflicts with the live church data above, the church data wins. If two notes below conflict with each other (e.g. a corrected date), trust the one with the more recent date — it supersedes the earlier one. Attribute memories as "you told me…", never state them as database facts.\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------
// Extraction — a small post-turn pass over what the STAFF USER said
// ---------------------------------------------------------------------

const EXTRACTION_MIN_LENGTH = 15;

interface ExtractedFact {
  content: string;
  person_names?: string[];
  expires_at?: string | null;
}

function parseExtractionJson(text: string): ExtractedFact[] {
  try {
    // Model sometimes wraps JSON in a code fence — strip it defensively.
    const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is ExtractedFact => !!f && typeof f === 'object' && typeof (f as ExtractedFact).content === 'string')
      .slice(0, 3);
  } catch {
    return [];
  }
}

export interface RunExtractionInput {
  supabase: SupabaseClient;
  churchId: string;
  userId: string;
  userMessage: string;
  assistantReply: string;
  sourceMessageId: string;
  sourceConversationId: string;
  apiKey: string;
  /** Test seam — same DI pattern as callClaude's own fetchImpl. */
  fetchImpl?: typeof fetch;
}

const EXTRACTION_PROMPT = `Extract 0-3 durable personal facts the STAFF USER stated about their own plans, commitments, or context (meetings, dates, preferences, things they said to remember). Do NOT extract facts already stated as church records, questions the user asked, or any judgment/inference about a church member. Usually return [].

Respond with ONLY a JSON array, no prose, no code fence: [{"content": "...", "person_names": ["..."], "expires_at": "YYYY-MM-DD or null"}]

Staff user said: "%USER%"
Grace replied: "%REPLY%"`;

/**
 * Fire-and-awaited (with a caller-imposed timeout) after a turn completes.
 * Never throws — malformed model output or a failed call simply writes
 * nothing, so extraction can never fail the chat turn itself.
 */
export async function runExtraction(input: RunExtractionInput): Promise<GraceMemoryRow[]> {
  if (process.env.GRACE_MEMORY_EXTRACTION === 'off') return [];
  if (input.userMessage.trim().length < EXTRACTION_MIN_LENGTH) return [];
  if (parseRememberDirective(input.userMessage)) return []; // already handled explicitly

  const prompt = EXTRACTION_PROMPT
    .replace('%USER%', input.userMessage.slice(0, 2000).replace(/"/g, "'"))
    .replace('%REPLY%', input.assistantReply.slice(0, 500).replace(/"/g, "'"));

  const result = await generate(
    {
      supabase: input.supabase,
      churchId: input.churchId,
      feature: 'grace-memory-extract',
      provider: 'claude',
      model: DEFAULT_CLAUDE_MODEL,
    },
    () => callClaude({ apiKey: input.apiKey, prompt, maxTokens: 300, temperature: 0.2, fetchImpl: input.fetchImpl }),
  );

  if (!result.allowed || !result.provider.success || !result.provider.text) return [];

  const facts = parseExtractionJson(result.provider.text);
  if (facts.length === 0) return [];

  const saved: GraceMemoryRow[] = [];
  for (const fact of facts) {
    const personIds = fact.person_names?.length
      ? await resolvePersonIds(input.supabase, input.churchId, fact.person_names)
      : [];
    const row = await saveMemory(input.supabase, {
      churchId: input.churchId,
      userId: input.userId,
      content: fact.content,
      source: 'ai_extracted',
      sourceMessageId: input.sourceMessageId,
      sourceConversationId: input.sourceConversationId,
      personIds,
      expiresAt: fact.expires_at ?? null,
    });
    if (row) saved.push(row);
  }
  return saved;
}
