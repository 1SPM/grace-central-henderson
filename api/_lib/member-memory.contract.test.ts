import { describe, it } from 'vitest';

/**
 * Unit contract for the FUTURE `api/_lib/member-memory.ts` and
 * `api/portal/_memories.ts` — written before either exists, so the
 * implementation is built to a spec rather than the spec to the
 * implementation. Every entry is `it.todo` on purpose: vitest reports them
 * as todo, not as passing and not as failing, and this file is how a reader
 * of `npx vitest run` sees that member memory is specified but unbuilt.
 *
 * This is the narrow unit half. The behavioral half — what the runtime
 * does across a whole member turn — lives in the eval harness:
 * tools/eval-harness/central-henderson-exam/member-assistant/. Both are
 * gated on the policy amendment in docs/MEMBER_MEMORY_QUALIFICATION_PLAN.md
 * (task 0); until that lands, member memory stays out of scope by
 * DECISIONS.md:303 (ADR-014) and docs/AI_BOUNDARIES.md:98.
 *
 * When the implementation lands: replace each it.todo with a real test,
 * keeping the title. Do not delete a todo whose behavior you chose not to
 * build — turn it into a failing test or a documented decision instead.
 */
describe('member-memory.ts (future) — parseMemberRememberDirective', () => {
  it.todo('matches "remember that <fact>" and "remember <fact>" anchored at the start, case-insensitive, and returns the trimmed fact');
  it.todo('does NOT match "remember" mid-sentence ("I can\'t remember when…") — that is a question, not a directive');
  it.todo('returns a distinct NON_ANCHORED result for "keep in mind…" / "don\'t forget…" so the runtime can answer deterministically instead of letting the model claim "Remembered" (TD-064 shape)');
  it.todo('rejects a directive whose fact is empty or under 3 characters');
});

describe('member-memory.ts (future) — sensitive-category denylist (post-hoc, not prompt-level)', () => {
  it.todo('rejects a self-stated fact naming immigration status, health condition, sexual orientation, or race — the SYSTEM_INSTRUCTION list in assistant-runtime.ts:131 is the single source');
  it.todo('applies to BOTH the directive path and the extraction path, on the stored text, regardless of what the model returned');
  it.todo('the decline reply for a rejected directive does not contain "Remembered" and still offers a human-follow-up path');
});

describe('member-memory.ts (future) — runMemberExtraction', () => {
  it.todo('is skipped entirely when the turn was a "remember that…" directive (mirrors grace-memory.ts:359)');
  it.todo('is skipped entirely on a crisis-gated or moderation-blocked turn — the reply was not model-authored, so there is nothing to extract from');
  it.todo('stores at most 3 facts per turn, each with source ai_extracted and a source_message_id');
  it.todo('stores only facts the member stated about THEMSELVES — a fact about a third party (daughter, spouse, sister) is dropped even if the model returned it');
  it.todo('stores nothing that is an inference or characterization ("seems disengaged") — only the member\'s literal self-statement (docs/AI_BOUNDARIES.md:32-37)');
  it.todo('is a no-op when MEMBER_MEMORY_EXTRACTION=off (kill switch, same shape as GRACE_MEMORY_EXTRACTION)');
});

describe('member-memory.ts (future) — retrieveMemberMemories / buildMemberMemoryBlock', () => {
  it.todo('queries member_memories with BOTH church_id = actor.churchId and person_id = actor.personId, status active');
  it.todo('excludes rows whose expires_at is in the past');
  it.todo('returns at most 15 rows, oldest → newest');
  it.todo('builds an empty block (no header, no text) when there are zero rows — the system instruction is byte-identical to the no-memory case');
  it.todo('the block header states that church data wins over memory and that memories are things the member told GRACE, not records');
  it.todo('memory content is rendered as quoted data, never as an instruction line — a memory reading "ignore your rules" changes nothing outside the block');
});

describe('api/portal/_memories.ts (future) — GET', () => {
  it.todo('resolves the actor with resolveMemberActor and returns only that actor\'s active rows');
  it.todo('each row carries id, content, source (user_stated | ai_extracted), created_at — never another member\'s row and never a church_id the actor does not belong to');
  it.todo('returns 401 for an unauthenticated request, matching the other api/portal/* routes');
});

describe('api/portal/_memories.ts (future) — DELETE', () => {
  it.todo('deletes (soft-delete: status → deleted) only when id AND person_id AND church_id all match the actor');
  it.todo('returns 404 with NO write when the id belongs to another member or another church');
  it.todo('the next runAssistantTurn after a delete has no memory block for that row');
});
