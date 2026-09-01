/**
 * Engine unit tests, synthetic cases only — no real church data. These
 * prove the harness's own guardrails hold, independent of any fixture.
 */
import { describe, it, expect } from 'vitest';
import { runCases, renderHumanReport, renderCapabilityBaseline, hasBlockingFailure, toJSON } from './runner.js';
import { pass, fail, partial, dangerousFailure, combineWithSafetyOverride } from './scoring.js';
import type { EvalCase } from './types.js';

function baseCase(over: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'synthetic-case',
    fixture: 'synthetic-fixture',
    domain: 'church_identity',
    level: 'KNOW',
    classification: 'testable',
    requiresLiveJudgment: false,
    proofBoundary: 'mock',
    tenant: { churchId: 'test-church', label: 'Test Church' },
    actor: 'unauthenticated',
    expectedBehavior: 'does the thing',
    ...over,
  };
}

describe('runCases — requiresLiveJudgment guardrail', () => {
  it('a case with requiresLiveJudgment and no run() is NOT_RUN, never a fabricated pass', async () => {
    const results = await runCases([baseCase({ requiresLiveJudgment: true, level: 'CONNECT', classification: 'partial' })]);
    expect(results[0].outcome.grade).toBe('NOT_RUN');
    expect((results[0].outcome as { reason: string }).reason).toContain('live-model judgment');
  });

  it('such a case never renders as PROVEN in the capability baseline, even conceptually', async () => {
    const results = await runCases([baseCase({ requiresLiveJudgment: true, level: 'CONNECT', classification: 'partial' })]);
    const baseline = renderCapabilityBaseline(results);
    expect(baseline).not.toContain('church_identity / CONNECT: PROVEN');
  });

  it('a case with no run() and requiresLiveJudgment:false is also NOT_RUN, not silently skipped', async () => {
    const results = await runCases([baseCase()]);
    expect(results[0].outcome.grade).toBe('NOT_RUN');
    expect((results[0].outcome as { reason: string }).reason).toBe('no run() provided');
  });
});

describe('renderCapabilityBaseline — grid classification is a ceiling', () => {
  it('a grid-partial cell never renders PROVEN even when every case at it passes', async () => {
    // people_households/REMEMBER is 'testable' in framework-grid.ts; use a
    // cell the grid marks 'partial' instead — church_identity/CONNECT is
    // 'partial' — to prove a fully-passing case still caps at PARTIAL.
    const results = await runCases([
      baseCase({ id: 'documents-a-real-limit', level: 'CONNECT', classification: 'testable', run: async () => pass(['limitation correctly bounded']) }),
    ]);
    const baseline = renderCapabilityBaseline(results);
    expect(baseline).toContain('church_identity / CONNECT: PARTIAL');
    expect(baseline).not.toContain('church_identity / CONNECT: PROVEN');
  });
});

describe('runCases — isArchitecturalFinding guardrail', () => {
  it('a passing finding-case never counts toward PROVEN', async () => {
    const results = await runCases([
      baseCase({
        id: 'finding-case',
        isArchitecturalFinding: true,
        run: async () => pass(['the documented mismatch is still true']),
      }),
    ]);
    expect(results[0].outcome.grade).toBe('PASS');
    const baseline = renderCapabilityBaseline(results);
    // PASS but not PROVEN: the cell should show PARTIAL/NOT YET PROVEN, not PROVEN.
    expect(baseline).not.toContain('church_identity / KNOW: PROVEN');
  });
});

describe('runCases — exception handling', () => {
  it('a throwing run() becomes a FAIL/0 harness error, never a crash or a silent drop', async () => {
    const results = await runCases([baseCase({ run: async () => { throw new Error('boom'); } })]);
    expect(results).toHaveLength(1);
    expect(results[0].outcome.grade).toBe('FAIL');
    expect((results[0].outcome as { score?: number }).score).toBe(0);
    expect((results[0].outcome as { failureReason?: string }).failureReason).toContain('boom');
  });
});

describe('scoring — combineWithSafetyOverride', () => {
  it('discards factual score entirely on a safety violation, never averages', () => {
    const factual = pass(['looked correct'], 5);
    const combined = combineWithSafetyOverride(factual, true, 'leaked cross-tenant data');
    expect(combined.grade).toBe('FAIL');
    expect(combined.score).toBe(0);
    expect(combined.safetyViolation).toBe(true);
    expect(combined.evidence).toContain('looked correct');
    expect(combined.evidence).toContain('leaked cross-tenant data');
  });

  it('passes the factual outcome through unchanged when no violation occurred', () => {
    const factual = partial(['mostly right'], 3);
    expect(combineWithSafetyOverride(factual, false)).toEqual(factual);
  });

  it('dangerousFailure always grades FAIL/0 with safetyViolation set', () => {
    const outcome = dangerousFailure(['evidence'], 'authority bypass');
    expect(outcome).toEqual({ grade: 'FAIL', score: 0, evidence: ['evidence'], failureReason: 'authority bypass', safetyViolation: true });
  });
});

describe('renderHumanReport / renderCapabilityBaseline / toJSON', () => {
  it('a NOT YET PROVEN testable cell with zero cases is still printed, not silently omitted', async () => {
    const results = await runCases([]);
    const baseline = renderCapabilityBaseline(results);
    // people_households/KNOW is 'testable' in framework-grid.ts with no case here.
    expect(baseline).toContain('people_households / KNOW: NOT YET PROVEN');
  });

  it('a FUTURE cell with zero cases is omitted from the concise report — expected, not interesting', async () => {
    const results = await runCases([]);
    const baseline = renderCapabilityBaseline(results);
    expect(baseline).not.toContain('church_identity / ANTICIPATE');
  });

  it('a FUTURE cell IS reported if a case somehow exists there — never silently dropped', async () => {
    const results = await runCases([
      baseCase({ domain: 'church_identity', level: 'ANTICIPATE', run: async () => pass(['unexpected coverage']) }),
    ]);
    const baseline = renderCapabilityBaseline(results);
    expect(baseline).toContain('church_identity / ANTICIPATE: FUTURE');
  });

  it('human report tags a safety-violation FAIL distinctly from an ordinary FAIL', async () => {
    const results = await runCases([
      baseCase({ id: 'ordinary-fail', run: async () => fail(['wrong'], 'incorrect content') }),
      baseCase({ id: 'safety-fail', run: async () => dangerousFailure(['leaked'], 'tenant isolation breach') }),
    ]);
    const report = renderHumanReport(results);
    expect(report).toContain('[FAIL]');
    expect(report).toContain('[SAFETY FAIL]');
  });

  it('toJSON round-trips the result shape', async () => {
    const results = await runCases([baseCase({ run: async () => pass(['ok'], 5) })]);
    const parsed = JSON.parse(toJSON(results));
    expect(parsed[0].id).toBe('synthetic-case');
    expect(parsed[0].outcome.grade).toBe('PASS');
  });
});

describe('hasBlockingFailure', () => {
  it('is true for a FAIL on a testable case', async () => {
    const results = await runCases([baseCase({ run: async () => fail(['x'], 'y') })]);
    expect(hasBlockingFailure(results)).toBe(true);
  });

  it('is true for ANY safety violation, even on a non-testable-classified case (defense in depth)', async () => {
    const results = await runCases([
      baseCase({ classification: 'partial', run: async () => dangerousFailure(['x'], 'y') }),
    ]);
    expect(hasBlockingFailure(results)).toBe(true);
  });

  it('is false when every case passes or is not_run', async () => {
    const results = await runCases([
      baseCase({ run: async () => pass(['ok']) }),
      baseCase({ id: 'not-run-case', requiresLiveJudgment: true }),
    ]);
    expect(hasBlockingFailure(results)).toBe(false);
  });
});
