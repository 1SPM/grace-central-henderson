import { describe, it, expect } from 'vitest';
import { runCases, renderHumanReport } from '../../runner.js';
import { MEMBER_MEMORY_CASES, MEMBER_MEMORY_FIXTURE } from './01-member-memory.cases.js';
import { MEMBER_MEMORY_SCENARIOS } from './02-member-memory.scenarios.js';

/**
 * Member-portal GRACE memory — qualification gate.
 *
 * Deliberately a sibling of epistemic/ and self-awareness/: these cases are
 * NOT in ALL_EXAM_CASES, so the 10-domain main exam is untouched. The gate
 * has two halves — what must hold TODAY (the four "Two Front Doors" member
 * cases + the non-persistence baseline) and what the future implementation
 * must clear (every memory case, graded NOT_RUN until it exists, never a
 * fabricated PASS). See docs/MEMBER_MEMORY_QUALIFICATION_PLAN.md.
 */
describe('GRACE member-assistant memory qualification gate', () => {
  it('has a unique case per id, all under the member-assistant-memory fixture with the ma- prefix', () => {
    const ids = MEMBER_MEMORY_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of MEMBER_MEMORY_CASES) {
      expect(c.fixture, c.id).toBe(MEMBER_MEMORY_FIXTURE);
      expect(c.id.startsWith('ma-'), c.id).toBe(true);
    }
    expect(MEMBER_MEMORY_CASES.length).toBeGreaterThanOrEqual(31);
  });

  it('every testable case passes deterministically, and there is at least one', async () => {
    const results = await runCases(MEMBER_MEMORY_CASES);
    const testable = results.filter((r) => r.classification === 'testable' && !r.requiresLiveJudgment);
    const failures = testable.filter((r) => r.outcome.grade !== 'PASS');
    if (failures.length > 0) {
      const detail = failures.map((f) => `${f.id}: ${JSON.stringify(f.outcome)}`).join('\n');
      throw new Error(`${failures.length} case(s) did not PASS:\n${detail}`);
    }
    expect(testable.length).toBeGreaterThan(0);
  });

  it('no testable case is missing a run() — "testable" means runnable today, nothing else', () => {
    for (const c of MEMBER_MEMORY_CASES.filter((c) => c.classification === 'testable')) {
      expect(typeof c.run, c.id).toBe('function');
    }
  });

  it('no safety-critical case failed, and none was silently downgraded to a non-dangerous grade', async () => {
    const results = await runCases(MEMBER_MEMORY_CASES);
    const safetyCritical = results.filter((r) => r.isSafetyCritical);
    expect(safetyCritical.length).toBeGreaterThan(0);
    for (const r of safetyCritical) {
      if (r.outcome.grade === 'FAIL') {
        expect((r.outcome as { safetyViolation?: boolean }).safetyViolation, r.id).toBe(true);
      }
    }
    const anyDangerous = safetyCritical.some((r) => (r.outcome as { safetyViolation?: boolean }).safetyViolation);
    expect(anyDangerous).toBe(false);
  });

  it('cases requiring live judgment carry no run() and report NOT_RUN, never a fabricated PASS', async () => {
    const liveJudgmentCases = MEMBER_MEMORY_CASES.filter((c) => c.requiresLiveJudgment);
    expect(liveJudgmentCases.length).toBeGreaterThan(0);
    for (const c of liveJudgmentCases) {
      expect(c.run, c.id).toBeUndefined();
      expect(c.classification, c.id).toBe('not_yet_testable');
    }
    const results = await runCases(MEMBER_MEMORY_CASES);
    for (const c of liveJudgmentCases) {
      const r = results.find((x) => x.id === c.id)!;
      expect(r.outcome.grade).toBe('NOT_RUN');
      expect((r.outcome as { reason?: string }).reason).toMatch(/live-model judgment/);
    }
  });

  it('memory cases are `future`, carry no run(), and grade NOT_RUN with "no run() provided" — the implementation does not exist yet', async () => {
    const future = MEMBER_MEMORY_CASES.filter((c) => c.classification === 'future');
    expect(future.length).toBeGreaterThan(0);
    for (const c of future) expect(c.run, c.id).toBeUndefined();
    const results = await runCases(MEMBER_MEMORY_CASES);
    for (const c of future) {
      const r = results.find((x) => x.id === c.id)!;
      expect(r.outcome.grade, c.id).toBe('NOT_RUN');
      expect((r.outcome as { reason?: string }).reason, c.id).toBe('no run() provided');
    }
    // Every memory-family id (remember / control / memory-safety) is future until task 0 lands.
    const memoryFamily = MEMBER_MEMORY_CASES.filter((c) => /^ma-(remember|control|know)-|^ma-safety-(?!baseline)/.test(c.id) && !c.requiresLiveJudgment);
    for (const c of memoryFamily) expect(c.classification, c.id).toBe('future');
  });

  it('the non-persistence baseline is a testable architectural finding that PASSES today (AI_BOUNDARIES.md:98 checked, not asserted)', async () => {
    const c = MEMBER_MEMORY_CASES.find((x) => x.id === 'ma-safety-baseline-non-persistence-today')!;
    expect(c).toBeDefined();
    expect(c.isArchitecturalFinding).toBe(true);
    expect(c.isSafetyCritical).toBe(true);
    expect(c.classification).toBe('testable');
    const results = await runCases([c]);
    expect(results[0].outcome.grade).toBe('PASS');
  });

  it('the uncued-crisis tracking case exists and is honestly NOT_RUN — the keyword detector does not cover it', async () => {
    const results = await runCases(MEMBER_MEMORY_CASES);
    const r = results.find((x) => x.id === 'ma-crisis-register-uncued-tracking')!;
    expect(r).toBeDefined();
    expect(r.outcome.grade).toBe('NOT_RUN');
  });

  it('scenario ↔ case links are intact in both directions', () => {
    const caseIds = new Set(MEMBER_MEMORY_CASES.map((c) => c.id));
    const scenarioIds = MEMBER_MEMORY_SCENARIOS.map((s) => s.id);
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);
    const referenced = new Set<string>();
    for (const s of MEMBER_MEMORY_SCENARIOS) {
      expect(s.caseIds.length, s.id).toBeGreaterThan(0);
      expect(s.sessions.length, s.id).toBeGreaterThan(0);
      for (const id of s.caseIds) {
        expect(caseIds.has(id), `${s.id} → ${id}`).toBe(true);
        referenced.add(id);
      }
      for (const session of s.sessions) {
        expect(session[0]?.role, `${s.id}: sessions start with the member`).toBe('user');
      }
    }
    // Every memory-family case is exercised by at least one dialogue scenario.
    const memoryFamily = MEMBER_MEMORY_CASES.filter((c) => c.classification === 'future');
    const orphaned = memoryFamily.filter((c) => !referenced.has(c.id)).map((c) => c.id);
    // Cases that pin mechanics with no natural dialogue (cap/order, expiry, DB-wins,
    // extraction-skip, inference filter, cross-church) are allowed to be unreferenced.
    const mechanicsOnly = new Set([
      'ma-remember-cap-and-ordering',
      'ma-remember-expired-excluded',
      'ma-remember-extraction-skipped-on-directive-turn',
      'ma-know-db-facts-win-over-memory',
      'ma-safety-never-remembers-inference',
    ]);
    expect(orphaned.filter((id) => !mechanicsOnly.has(id))).toEqual([]);
  });

  it('renders a human report without throwing', async () => {
    const results = await runCases(MEMBER_MEMORY_CASES);
    expect(() => renderHumanReport(results)).not.toThrow();
  });
});
