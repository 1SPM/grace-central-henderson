/**
 * ADR-015 (Central Henderson church knowledge). Covers retrieval (the
 * always-on scope_boundary union, relevance search, dedupe, cap) and the
 * prompt block's conversational framing, source attribution, and always-on
 * guardrail footer.
 */
import { describe, it, expect } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID } from '../../tests/fixtures/shared-platform.js';
import { retrieveChurchKnowledge, buildKnowledgeBlock } from './grace-knowledge.js';

const ROWS = [
  { id: 'k-mission', category: 'mission' as const, title: 'Mission', content: 'We exist to introduce people to Jesus and help them follow Him.', source_label: 'Central — consolidated FY2024, PDF pp. 7-10.' },
  { id: 'k-strategy', category: 'strategy' as const, title: 'Strategy', content: 'Attend, invite, take a next step, give generously. Navigation language only, never a behavioral score.', source_label: 'Central — consolidated FY2024, PDF pp. 7-10.' },
  { id: 'k-boundary-financials', category: 'scope_boundary' as const, title: 'Financials out of scope', content: 'All financial figures in the FY2024 report are consolidated, not Henderson-specific. No authorized Henderson-specific financial source exists in this knowledge base.', source_label: 'Central — consolidated FY2024, scope guardrail.' },
  { id: 'k-boundary-giving', category: 'scope_boundary' as const, title: 'Giving stays permissioned', content: 'Never a source for any individual member\'s giving, care, or spiritual-conversation data.', source_label: 'Grace product constraint.' },
];

describe('retrieveChurchKnowledge', () => {
  it('always includes scope_boundary rows regardless of query topic', async () => {
    const supabase = createMockSupabase({ tables: { grace_knowledge: () => ({ data: ROWS }) } });

    const result = await retrieveChurchKnowledge(supabase as never, { churchId: FIXTURE_CHURCH_ID, query: 'good morning' });

    const ids = result.map(r => r.id);
    expect(ids).toContain('k-boundary-financials');
    expect(ids).toContain('k-boundary-giving');
  });

  it('surfaces topical content for a relevant query', async () => {
    const supabase = createMockSupabase({ tables: { grace_knowledge: () => ({ data: ROWS }) } });

    const result = await retrieveChurchKnowledge(supabase as never, { churchId: FIXTURE_CHURCH_ID, query: "what's Central's mission?" });

    expect(result.map(r => r.id)).toContain('k-mission');
  });

  it('dedupes rows that match both the boundary fetch and the relevance search', async () => {
    const supabase = createMockSupabase({ tables: { grace_knowledge: () => ({ data: ROWS }) } });

    const result = await retrieveChurchKnowledge(supabase as never, { churchId: FIXTURE_CHURCH_ID, query: 'financial' });

    const ids = result.map(r => r.id);
    expect(ids.filter(id => id === 'k-boundary-financials')).toHaveLength(1);
  });

  it('sorts scope_boundary rows last', async () => {
    const supabase = createMockSupabase({ tables: { grace_knowledge: () => ({ data: ROWS }) } });

    const result = await retrieveChurchKnowledge(supabase as never, { churchId: FIXTURE_CHURCH_ID, query: 'mission strategy' });

    const lastCategories = result.slice(-2).map(r => r.category);
    expect(lastCategories.every(c => c === 'scope_boundary')).toBe(true);
  });

  it('caps the result at 12', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `k-${i}`, category: 'mission' as const, title: `Fact ${i}`, content: `content ${i}`, source_label: 'source',
    }));
    const supabase = createMockSupabase({ tables: { grace_knowledge: () => ({ data: many }) } });

    const result = await retrieveChurchKnowledge(supabase as never, { churchId: FIXTURE_CHURCH_ID, query: 'content' });
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it('returns an empty array for a church with no knowledge rows', async () => {
    const supabase = createMockSupabase({ tables: { grace_knowledge: () => ({ data: [] }) } });

    const result = await retrieveChurchKnowledge(supabase as never, { churchId: FIXTURE_CHURCH_ID, query: 'anything' });
    expect(result).toEqual([]);
  });
});

describe('buildKnowledgeBlock', () => {
  it('returns empty string for no rows — keeps the wiring safe for every non-Henderson church', () => {
    expect(buildKnowledgeBlock([])).toBe('');
  });

  it('instructs conversational use, not verbatim recitation', () => {
    const block = buildKnowledgeBlock(ROWS);
    expect(block).toContain('do not recite it as a quoted list');
    expect(block).toContain('Weave it naturally into your answer');
  });

  it('attaches each row\'s source_label for attribution', () => {
    const block = buildKnowledgeBlock(ROWS);
    for (const row of ROWS) {
      expect(block).toContain(row.source_label);
    }
  });

  it('always appends the guardrail footer, unconditional on which rows were retrieved', () => {
    const block = buildKnowledgeBlock([ROWS[0]]); // mission only, no scope_boundary row present
    expect(block).toContain("don't have an authorized Henderson-specific source");
    expect(block).toContain('never a behavioral score, ranking, or eligibility judgment');
    expect(block).toContain('do not use outside/general knowledge');
  });
});
