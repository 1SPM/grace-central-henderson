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

  // Real OR: {type: 'websearch'} routes through websearch_to_tsquery, which
  // treats a bare `|` as punctuation (dropped) rather than an operator and
  // implicitly ANDs the remaining words — a multi-concept query would then
  // only match a row containing every word at once. Omitting `type` routes
  // through plain to_tsquery, which parses `|` as OR — the semantics
  // tokenizeQuery's join(' | ') actually intends.
  const tsQuery = tokenizeQuery(opts.query).join(' | ');
  if (tsQuery) {
    const { data: relevant } = await supabase
      .from('grace_memories')
      .select('id, content, source, person_ids, status, expires_at, created_at')
      .eq('church_id', opts.churchId)
      .eq('user_id', opts.userId)
      .eq('status', 'active')
      .textSearch('content_tsv', tsQuery)
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
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WEEKDAY_RE = /\b(sun|mon|tue|wed|thu|fri|sat)(?:day|nesday|rsday|urday|s|es|r|rs)?\b/i;
const WEEKDAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
// A note that already carries a calendar date needs no anchor.
const EXPLICIT_DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/i;

/**
 * The calendar day a timestamp falls on IN THE CHURCH'S ZONE, as a local
 * date-only value safe for day arithmetic. The server runs in UTC; a note
 * taken at 6pm Pacific on a Thursday is already Friday in UTC, which would
 * push "Thursday" a whole week out. The client sends its zone with each
 * turn; an unknown or missing zone falls back to the server's.
 */
function calendarDay(at: Date, timeZone?: string): Date {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(at);
      const get = (t: string) => Number(parts.find(x => x.type === t)?.value);
      const d = new Date(get('year'), get('month') - 1, get('day'));
      if (!Number.isNaN(d.getTime())) return d;
    } catch { /* invalid zone — fall through */ }
  }
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * R-21: a note that names only a weekday ("check-in with Bill is Thursday at
 * 2pm") was recalled with a calendar date the model invented — live, twice,
 * "that's today, September 4th" on a Friday, with the header above already
 * telling it not to. Telling the model not to compute a date was not enough;
 * so the server computes it. Returns a parenthetical to append to the memory
 * line: the next occurrence of that weekday after the note was taken, or —
 * when the note was written on that very weekday — both candidates, because
 * "Thursday" said on a Thursday genuinely is ambiguous and the honest reply
 * is to say so rather than pick.
 */
export function weekdayOnlyHint(content: string, createdAt: string | Date, timeZone?: string): string | null {
  if (EXPLICIT_DATE_RE.test(content)) return null;
  const m = WEEKDAY_RE.exec(content);
  if (!m) return null;
  const target = WEEKDAY_INDEX[m[1].toLowerCase()];
  const noted = new Date(createdAt);
  if (Number.isNaN(noted.getTime())) return null;
  const name = WEEKDAY_NAMES[target];
  const notedDay = calendarDay(noted, timeZone);
  const delta = (target - notedDay.getDay() + 7) % 7;
  if (delta === 0) {
    const following = new Date(notedDay); following.setDate(notedDay.getDate() + 7);
    return `(weekday only — this note was written on a ${name}, so "${name}" may mean that same day, ${fmt(notedDay)}, or the following ${name}, ${fmt(following)}; say that it is unclear rather than choosing)`;
  }
  const next = new Date(notedDay); next.setDate(notedDay.getDate() + delta);
  return `(weekday only — the next ${name} after this note is ${fmt(next)}; if you give a date, give exactly that one)`;
}

export function buildMemoryBlock(memories: GraceMemoryRow[], timeZone?: string): string {
  if (memories.length === 0) return '';
  const lines = memories.map(m => {
    // Weekday included so a relative day word inside the note ("Thursday")
    // can be reasoned about against the day the note was actually taken —
    // in the church's zone, not the server's.
    const date = fmt(calendarDay(new Date(m.created_at), timeZone));
    const label = m.source === 'user_stated' ? 'you said' : 'noted from chat';
    const hint = weekdayOnlyHint(m.content, m.created_at, timeZone);
    // R-17: this used to render as `[Aug 31, you said] …`, which the model
    // read as the date of the thing described rather than the date the note
    // was taken — live, twice, it turned "my check-in is Thursday" into
    // "that's today, Aug 31" (a Monday). The date now sits inside the
    // attribution phrase so it can only be read as provenance. The exact
    // substrings "you said" / "noted from chat" are load-bearing: the
    // qualification suite and the Pilot Capability Manifest assert them.
    return `- [${label} on ${date}] ${m.content}${hint ? ` ${hint}` : ''}`;
  });
  return `\n== PERSONAL MEMORY (things this staff member told you earlier — may be stale or superseded, oldest to newest) ==\nThese are conversation notes, NOT church records. If anything here conflicts with the live church data above, the church data wins. If two notes below conflict with each other (e.g. a corrected date), trust the one with the more recent date — it supersedes the earlier one. Attribute memories as "you told me…", never state them as database facts.\nTHE DATE IN EACH BRACKET IS WHEN THE NOTE WAS TAKEN — never the date of anything described inside it. If a note names only a weekday, a parenthetical after it gives the calendar date that weekday resolves to — use exactly that date if you give one, never compute a different one, and if the parenthetical says it is unclear, say so. Never say a commitment is "today" or "tomorrow" unless today's date above is literally that date. For any other relative wording ("next week") give it as the staff member said it and do not attach a date.\n${lines.join('\n')}`;
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
  /** Only needed if apiKey is an identity-linked key — see claude.ts. */
  workspaceId?: string;
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
    () => callClaude({ apiKey: input.apiKey, workspaceId: input.workspaceId, prompt, maxTokens: 300, temperature: 0.2, fetchImpl: input.fetchImpl }),
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
