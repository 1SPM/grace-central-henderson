/**
 * Central Henderson church knowledge (ADR-015, migration 076) — "Grace
 * Knows the Church," phase one.
 *
 * Mirrors grace-memory.ts's retrieval/prompt-block shape, minus everything
 * write-related: grace_knowledge has no runtime write path at all — every
 * row arrives via migration, never via the app. This is church-scoped
 * reference data (shared across every staff member at a church), not
 * per-user conversation-derived memory.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface GraceKnowledgeRow {
  id: string;
  category: 'identity' | 'mission' | 'strategy' | 'ownership_path' | 'scope_boundary';
  title: string;
  content: string;
  source_label: string;
}

function tokenizeQuery(query: string): string[] {
  return query
    .split(/[^a-zA-Z']+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);
}

const RETRIEVE_LIMIT = 12;

/**
 * scope_boundary rows are always included, regardless of query relevance —
 * a guardrail that only surfaces when the question happens to match a
 * keyword isn't a guardrail. Everything else (identity/mission/strategy/
 * ownership_path) is retrieved by full-text relevance against the query,
 * same tokenizer and websearch mode as grace-memory.ts's retrieveMemories.
 * No embeddings, no tool-calling — plain Postgres full-text search.
 */
export async function retrieveChurchKnowledge(
  supabase: SupabaseClient,
  opts: { churchId: string; query: string },
): Promise<GraceKnowledgeRow[]> {
  const byId = new Map<string, GraceKnowledgeRow>();

  const { data: boundaries } = await supabase
    .from('grace_knowledge')
    .select('id, category, title, content, source_label')
    .eq('church_id', opts.churchId)
    .eq('status', 'active')
    .eq('category', 'scope_boundary');
  for (const row of (boundaries ?? []) as GraceKnowledgeRow[]) {
    byId.set(row.id, row);
  }

  const tsQuery = tokenizeQuery(opts.query).join(' | ');
  if (tsQuery) {
    const { data: relevant } = await supabase
      .from('grace_knowledge')
      .select('id, category, title, content, source_label')
      .eq('church_id', opts.churchId)
      .eq('status', 'active')
      .textSearch('content_tsv', tsQuery, { type: 'websearch' })
      .limit(8);
    for (const row of (relevant ?? []) as GraceKnowledgeRow[]) {
      byId.set(row.id, row);
    }
  }

  // scope_boundary rows sort last — closest to the eventual question, same
  // "most salient nearest the question" principle retrieveMemories uses for
  // recency ordering.
  const rows = [...byId.values()];
  rows.sort((a, b) => {
    const aBoundary = a.category === 'scope_boundary' ? 1 : 0;
    const bBoundary = b.category === 'scope_boundary' ? 1 : 0;
    return aBoundary - bBoundary;
  });
  return rows.slice(0, RETRIEVE_LIMIT);
}

const GUARDRAIL_FOOTER = `GUARDRAILS (always apply, regardless of what's retrieved above):
- The four-part strategy is navigation language only — never a behavioral score, ranking, or eligibility judgment about a person.
- Never state a Central Henderson-specific financial figure, attendance number, debt figure, or ministry outcome. If asked for one, say plainly you don't have an authorized Henderson-specific source for that — do not substitute the consolidated Central Christian Church and Affiliates figures, and do not use outside/general knowledge you may have about this organization.
- Giving, care, and spiritual-conversation data about a real person never comes from this block.`;

/**
 * The prompt block presenting church knowledge to the model. Framed
 * explicitly as approved background to be woven into an answer, never
 * recited verbatim as a quoted list or pasted-in document — and never the
 * source's raw fixture data (no schema/field names, no financial figures).
 */
export function buildKnowledgeBlock(rows: GraceKnowledgeRow[]): string {
  if (rows.length === 0) return '';
  const lines = rows.map(r => `- [${r.category}] ${r.content} (source: ${r.source_label})`);
  return `\n== CENTRAL CHURCH CONTEXT (source-scoped, reviewed — answer conversationally using this, do not recite it as a quoted list) ==\nThis is approved background about the church, not live operational data. Weave it naturally into your answer instead of pasting it verbatim. Each item below is attributed to its source.\n${lines.join('\n')}\n\n${GUARDRAIL_FOOTER}`;
}
