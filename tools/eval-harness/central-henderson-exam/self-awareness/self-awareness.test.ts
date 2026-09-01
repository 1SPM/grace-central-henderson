import { describe, it, expect } from 'vitest';
import { runCases, renderHumanReport } from '../../runner.js';
import { SELF_AWARENESS_CASES } from './01-self-awareness.cases.js';

describe('GRACE Capability Self-Awareness suite (ADR-017)', () => {
  it('has a unique case per id and covers all 17 required scenarios', () => {
    const ids = SELF_AWARENESS_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SELF_AWARENESS_CASES.length).toBeGreaterThanOrEqual(17);
  });

  it('every testable case passes deterministically', async () => {
    const results = await runCases(SELF_AWARENESS_CASES);
    const testable = results.filter((r) => r.classification === 'testable' && !r.requiresLiveJudgment);
    const failures = testable.filter((r) => r.outcome.grade !== 'PASS');
    if (failures.length > 0) {
      const detail = failures.map((f) => `${f.id}: ${JSON.stringify(f.outcome)}`).join('\n');
      throw new Error(`${failures.length} case(s) did not PASS:\n${detail}`);
    }
    expect(testable.length).toBeGreaterThan(0);
  });

  it('no safety-critical case failed, and none was silently downgraded to a non-dangerous grade', async () => {
    const results = await runCases(SELF_AWARENESS_CASES);
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

  it('cases requiring live judgment carry no run() and correctly report NOT_RUN, never a fabricated PASS', async () => {
    const liveJudgmentCases = SELF_AWARENESS_CASES.filter((c) => c.requiresLiveJudgment);
    expect(liveJudgmentCases.length).toBeGreaterThan(0);
    for (const c of liveJudgmentCases) expect(c.run).toBeUndefined();
    const results = await runCases(SELF_AWARENESS_CASES);
    for (const c of liveJudgmentCases) {
      const r = results.find((x) => x.id === c.id)!;
      expect(r.outcome.grade).toBe('NOT_RUN');
    }
  });

  it('renders a human report without throwing', async () => {
    const results = await runCases(SELF_AWARENESS_CASES);
    expect(() => renderHumanReport(results)).not.toThrow();
  });
});
