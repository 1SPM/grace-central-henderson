/**
 * The evaluation engine. Zero fixture-specific or church-specific logic —
 * this file only ever consumes EvalCase[]. A future fixture is a new
 * fixtures/*.cases.ts file; this file never changes for that.
 */
import type { EvalCase, EvalResult, KnowledgeDomain } from './types.js';
import { ALL_DOMAINS, ALL_LEVELS, gridClassification } from './framework-grid.js';

export async function runCases(cases: EvalCase[]): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const c of cases) {
    const base = {
      id: c.id,
      fixture: c.fixture,
      domain: c.domain,
      level: c.level,
      classification: c.classification,
      requiresLiveJudgment: c.requiresLiveJudgment,
      proofBoundary: c.proofBoundary,
      isSafetyCritical: c.isSafetyCritical ?? false,
      isArchitecturalFinding: c.isArchitecturalFinding ?? false,
    };

    if (!c.run) {
      // Deliberate, not a gap to paper over: a case with no run() — most
      // often because requiresLiveJudgment is true and no live-judgment
      // harness exists yet — must never be silently counted as passing.
      results.push({
        ...base,
        outcome: {
          grade: 'NOT_RUN',
          reason: c.requiresLiveJudgment
            ? 'requires live-model judgment — no live-judgment harness built yet'
            : 'no run() provided',
        },
      });
      continue;
    }

    try {
      const outcome = await c.run();
      results.push({ ...base, outcome });
    } catch (err) {
      results.push({
        ...base,
        outcome: {
          grade: 'FAIL',
          score: 0,
          evidence: [],
          failureReason: `harness error: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  }
  return results;
}

function isProven(r: EvalResult): boolean {
  return (
    r.outcome.grade === 'PASS' &&
    !r.requiresLiveJudgment &&
    !r.isArchitecturalFinding
  );
}

export function renderHumanReport(results: EvalResult[]): string {
  const lines: string[] = [];
  const byFixture = new Map<string, EvalResult[]>();
  for (const r of results) {
    if (!byFixture.has(r.fixture)) byFixture.set(r.fixture, []);
    byFixture.get(r.fixture)!.push(r);
  }

  for (const [fixture, rows] of byFixture) {
    lines.push(`\n== ${fixture} ==`);
    for (const r of rows) {
      const grade = r.outcome.grade;
      const tag = grade === 'FAIL' && 'safetyViolation' in r.outcome && r.outcome.safetyViolation
        ? 'SAFETY FAIL'
        : grade;
      const score = 'score' in r.outcome && r.outcome.score !== undefined ? ` (score ${r.outcome.score})` : '';
      const finding = r.isArchitecturalFinding ? ' [architectural finding — not a capability proof]' : '';
      lines.push(`  [${tag}]${score} ${r.id} — ${r.domain}/${r.level}${finding}`);
      if ('evidence' in r.outcome) {
        for (const e of r.outcome.evidence) lines.push(`      evidence: ${e}`);
      }
      if ('failureReason' in r.outcome && r.outcome.failureReason) {
        lines.push(`      reason: ${r.outcome.failureReason}`);
      }
      if (grade === 'NOT_RUN') {
        lines.push(`      not run: ${r.outcome.reason}`);
      }
    }
  }

  const failCount = results.filter(r => r.outcome.grade === 'FAIL').length;
  const safetyFailCount = results.filter(r => r.outcome.grade === 'FAIL' && 'safetyViolation' in r.outcome && r.outcome.safetyViolation).length;
  const notRunCount = results.filter(r => r.outcome.grade === 'NOT_RUN').length;
  lines.push(`\n${results.length} case(s): ${results.filter(r => r.outcome.grade === 'PASS').length} PASS, ${results.filter(r => r.outcome.grade === 'PARTIAL').length} PARTIAL, ${failCount} FAIL (${safetyFailCount} safety), ${notRunCount} NOT_RUN`);
  return lines.join('\n');
}

/**
 * PROVEN / PARTIAL / NOT YET PROVEN / FUTURE for every one of the 70
 * domain×level cells, cross-referenced against framework-grid.ts — not
 * just whatever cases happen to exist. Architectural existence (a case
 * that runs) is never presented as demonstrated intelligence on its own:
 * PROVEN requires a case that actually ran, graded PASS, does not require
 * live judgment, and is not merely documenting a known finding.
 */
export function renderCapabilityBaseline(results: EvalResult[]): string {
  const byCell = new Map<string, EvalResult[]>();
  for (const r of results) {
    const key = `${r.domain}::${r.level}`;
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key)!.push(r);
  }

  const lines: string[] = ['\n== Capability Baseline (cross-referenced against framework-grid.ts) =='];
  for (const domain of ALL_DOMAINS) {
    for (const level of ALL_LEVELS) {
      const gridClass = gridClassification(domain, level);
      const cellResults = byCell.get(`${domain}::${level}`) ?? [];

      let status: 'PROVEN' | 'PARTIAL' | 'NOT YET PROVEN' | 'FUTURE';
      if (gridClass === 'future') {
        status = 'FUTURE';
      } else if (cellResults.length === 0) {
        status = 'NOT YET PROVEN';
      } else if (cellResults.some(isProven)) {
        status = cellResults.every(isProven) ? 'PROVEN' : 'PARTIAL';
      } else if (cellResults.some(r => r.outcome.grade === 'PARTIAL')) {
        status = 'PARTIAL';
      } else {
        status = 'NOT YET PROVEN';
      }

      // Only print cells with something to say — a case exists, or the
      // grid itself doesn't call this cell future (i.e. it's an
      // acknowledged gap worth naming). Silently omitting a testable/
      // partial cell with zero cases would read as coverage that isn't
      // there — print it as NOT YET PROVEN instead.
      if (cellResults.length > 0 || gridClass !== 'future') {
        lines.push(`  ${domain} / ${level}: ${status}${cellResults.length ? ` (${cellResults.length} case(s))` : ''}`);
      }
    }
  }
  return lines.join('\n');
}

export function toJSON(results: EvalResult[]): string {
  return JSON.stringify(results, null, 2);
}

export function hasBlockingFailure(results: EvalResult[]): boolean {
  return results.some(r =>
    (r.outcome.grade === 'FAIL' && r.classification === 'testable') ||
    (r.outcome.grade === 'FAIL' && 'safetyViolation' in r.outcome && r.outcome.safetyViolation),
  );
}

// Exported for tests that want the raw domain list without importing framework-grid directly.
export type { KnowledgeDomain };
