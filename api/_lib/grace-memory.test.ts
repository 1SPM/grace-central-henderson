/**
 * ADR-014 (Grace staff memory). Covers the pure directive parser, the
 * dedupe/provenance write path, retrieval (recency + relevance + entity
 * union, expiry filtering), the DB-facts-win prompt wording, and
 * extraction robustness against malformed model output.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';
import {
  parseRememberDirective,
  saveMemory,
  retrieveMemories,
  buildMemoryBlock,
  runExtraction,
  resolvePersonIds,
} from './grace-memory.js';

const BILL_ID = '77777777-7777-4777-8777-777777777777';

describe('parseRememberDirective', () => {
  it('parses "remember that…" and bare "remember …"', () => {
    expect(parseRememberDirective('remember that I have a meeting with Bill Thursday')).toBe('I have a meeting with Bill Thursday');
    expect(parseRememberDirective('Remember Christopher prefers texts')).toBe('Christopher prefers texts');
  });

  it('returns null for anything that is not a directive', () => {
    expect(parseRememberDirective('what tasks are due?')).toBeNull();
    expect(parseRememberDirective('remember')).toBeNull();
  });
});

describe('saveMemory', () => {
  it('inserts a new memory with the given provenance', async () => {
    const supabase = createMockSupabase({
      tables: {
        grace_memories: (op) => op === 'select'
          ? { data: [] }
          : { data: { id: 'mem-1', content: 'my meeting with Bill is Thursday', source: 'user_stated', person_ids: [], created_at: '2026-08-30T00:00:00.000Z' } },
      },
    });

    const row = await saveMemory(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      userId: FIXTURE_STAFF_USER.id,
      content: 'my meeting with Bill is Thursday',
      source: 'user_stated',
    });

    expect(row?.content).toBe('my meeting with Bill is Thursday');
    expect(supabase.__calls.filter(c => c.table === 'grace_memories' && c.op === 'insert')).toHaveLength(1);
  });

  it('skips an active duplicate (case-insensitive) without inserting', async () => {
    const supabase = createMockSupabase({
      tables: {
        grace_memories: () => ({ data: [{ id: 'mem-1', content: 'my meeting with Bill is Thursday' }] }),
      },
    });

    const row = await saveMemory(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      userId: FIXTURE_STAFF_USER.id,
      content: 'My Meeting With Bill Is Thursday',
      source: 'user_stated',
    });

    expect(row).toBeNull();
    expect(supabase.__calls.filter(c => c.table === 'grace_memories' && c.op === 'insert')).toHaveLength(0);
  });
});

describe('resolvePersonIds', () => {
  it('matches a full name and a first-name-only mention', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: [{ id: BILL_ID, first_name: 'Bill', last_name: 'Johnson' }] }),
      },
    });

    expect(await resolvePersonIds(supabase as never, FIXTURE_CHURCH_ID, ['Bill Johnson'])).toEqual([BILL_ID]);
    expect(await resolvePersonIds(supabase as never, FIXTURE_CHURCH_ID, ['Bill'])).toEqual([BILL_ID]);
    expect(await resolvePersonIds(supabase as never, FIXTURE_CHURCH_ID, ['Nobody'])).toEqual([]);
  });
});

describe('retrieveMemories', () => {
  it('unions recency + relevance + entity matches, deduped, expired rows filtered out', async () => {
    const memoryRows = [
      { id: 'mem-1', content: 'my meeting with Bill is Thursday', source: 'user_stated', person_ids: [BILL_ID], status: 'active', expires_at: null, created_at: '2026-08-30T00:00:00.000Z' },
      { id: 'mem-2', content: 'expired thing', source: 'user_stated', person_ids: [], status: 'active', expires_at: '2020-01-01T00:00:00.000Z', created_at: '2026-08-01T00:00:00.000Z' },
    ];
    const supabase = createMockSupabase({
      tables: {
        grace_memories: () => ({ data: memoryRows }),
        people: () => ({ data: [{ id: BILL_ID, first_name: 'Bill', last_name: 'Johnson' }] }),
      },
    });

    const result = await retrieveMemories(supabase as never, { churchId: FIXTURE_CHURCH_ID, userId: FIXTURE_STAFF_USER.id, query: 'tell me about Bill Johnson' });

    expect(result.map(r => r.id)).toEqual(['mem-1']); // expired mem-2 filtered, no duplicate mem-1 despite 3 lookups
  });

  it('caps the result at 15', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `mem-${i}`, content: `fact ${i}`, source: 'user_stated', person_ids: [], status: 'active', expires_at: null, created_at: new Date(2026, 7, i + 1).toISOString(),
    }));
    const supabase = createMockSupabase({ tables: { grace_memories: () => ({ data: many }) } });

    const result = await retrieveMemories(supabase as never, { churchId: FIXTURE_CHURCH_ID, userId: FIXTURE_STAFF_USER.id, query: 'xyz' });
    expect(result.length).toBeLessThanOrEqual(15);
  });
});

describe('buildMemoryBlock', () => {
  it('returns empty string for no memories', () => {
    expect(buildMemoryBlock([])).toBe('');
  });

  it('states the DB-facts-win rule and labels each memory by source', () => {
    const block = buildMemoryBlock([
      { id: 'mem-1', content: 'my meeting with Bill is Thursday', source: 'user_stated', person_ids: [], created_at: '2026-08-30T00:00:00.000Z' },
      { id: 'mem-2', content: 'likes to be texted, not called', source: 'ai_extracted', person_ids: [], created_at: '2026-08-29T00:00:00.000Z' },
    ]);
    expect(block).toContain('the church data wins');
    expect(block).toContain('NOT church records');
    expect(block).toContain('you said');
    expect(block).toContain('noted from chat');
    expect(block).toContain('my meeting with Bill is Thursday');
  });
});

describe('runExtraction', () => {
  const baseInput = {
    churchId: FIXTURE_CHURCH_ID,
    userId: FIXTURE_STAFF_USER.id,
    userMessage: 'I have a meeting with Bill Johnson this Thursday about the budget',
    assistantReply: 'Got it — anything else?',
    sourceMessageId: 'msg-1',
    sourceConversationId: 'conv-1',
    apiKey: 'test-key',
  };

  beforeEach(() => {
    delete process.env.GRACE_MEMORY_EXTRACTION;
  });

  function fetchReturning(text: string) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }),
    }) as unknown as typeof fetch;
  }

  function budgetOkSupabase(extra: Record<string, (op: string, payload: unknown) => { data: unknown }> = {}) {
    return createMockSupabase({
      tables: {
        church_ai_budgets: () => ({ data: { monthly_cap_micro_usd: 100_000_000, hard_cutoff_multiplier: 1.1 } }),
        token_usage: () => ({ data: [] }),
        people: () => ({ data: [{ id: BILL_ID, first_name: 'Bill', last_name: 'Johnson' }] }),
        grace_memories: (op) => op === 'select' ? { data: [] } : { data: { id: 'mem-new', content: 'fact', source: 'ai_extracted', person_ids: [], created_at: '2026-08-30T00:00:00.000Z' } },
        ...extra,
      },
    });
  }

  it('writes a memory with provenance from a well-formed extraction', async () => {
    const supabase = budgetOkSupabase();
    const fetchImpl = fetchReturning('[{"content": "meeting with Bill Johnson Thursday about the budget", "person_names": ["Bill Johnson"]}]');

    const saved = await runExtraction({ ...baseInput, supabase: supabase as never, fetchImpl });

    expect(saved).toHaveLength(1);
    const insertCall = supabase.__calls.find(c => c.table === 'grace_memories' && c.op === 'insert');
    expect((insertCall!.payload as Record<string, unknown>).source).toBe('ai_extracted');
    expect((insertCall!.payload as Record<string, unknown>).source_message_id).toBe('msg-1');
    expect((insertCall!.payload as Record<string, unknown>).person_ids).toEqual([BILL_ID]);
  });

  it('writes nothing when the model returns malformed JSON', async () => {
    const supabase = budgetOkSupabase();
    const fetchImpl = fetchReturning('not json at all');

    const saved = await runExtraction({ ...baseInput, supabase: supabase as never, fetchImpl });

    expect(saved).toEqual([]);
    expect(supabase.__calls.filter(c => c.table === 'grace_memories' && c.op === 'insert')).toHaveLength(0);
  });

  it('writes nothing when the model returns an empty array (the common case)', async () => {
    const supabase = budgetOkSupabase();
    const fetchImpl = fetchReturning('[]');

    const saved = await runExtraction({ ...baseInput, supabase: supabase as never, fetchImpl });
    expect(saved).toEqual([]);
  });

  it('skips extraction entirely for a "remember that…" message (handled explicitly, not via extraction)', async () => {
    const supabase = budgetOkSupabase();
    const fetchImpl = vi.fn();

    const saved = await runExtraction({ ...baseInput, userMessage: 'remember that I have a meeting with Bill Thursday', supabase: supabase as never, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(saved).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('skips extraction for very short messages', async () => {
    const supabase = budgetOkSupabase();
    const fetchImpl = vi.fn();

    const saved = await runExtraction({ ...baseInput, userMessage: 'ok thanks', supabase: supabase as never, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(saved).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('respects the GRACE_MEMORY_EXTRACTION=off kill switch', async () => {
    process.env.GRACE_MEMORY_EXTRACTION = 'off';
    const supabase = budgetOkSupabase();
    const fetchImpl = vi.fn();

    const saved = await runExtraction({ ...baseInput, supabase: supabase as never, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(saved).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
