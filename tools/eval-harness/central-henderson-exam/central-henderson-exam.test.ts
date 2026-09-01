/**
 * Puts the Central Henderson exam's EvalCases under the normal
 * `npx vitest run` gate, and writes machine-readable output for
 * run-exam.ts — see fixture-001-central-henderson.cases.test.ts's
 * comment for why this is how run-all.ts-style CLIs get their data.
 *
 * Deliberately NOT added to run-all.ts's CASE_TEST_FILES — this exam's
 * results must stay standalone, never blended into the 6-fixture combined
 * report (see this exam's own scorecard.ts header comment for why).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCases, toJSON } from '../runner.js';
import { ALL_EXAM_CASES } from './index.js';
import { CENTRAL_HENDERSON_GAP_MAP } from './knowledge-gap-map.js';
import { CENTRAL_HENDERSON_PILOT_PRIORITY_RANKING } from './pilot-priority-ranking.js';
import type { EvalResult } from '../types.js';

let results: EvalResult[];

beforeAll(async () => {
  results = await runCases(ALL_EXAM_CASES);
  const outDir = join(process.cwd(), 'tools/eval-harness/.output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'central-henderson-exam.json'), toJSON(results));
});

describe('Central Henderson Qualification Exam', () => {
  it('every testable case grades PASS', () => {
    const testable = results.filter(r => r.classification === 'testable');
    const failures = testable.filter(r => r.outcome.grade !== 'PASS');
    if (failures.length > 0) {
      const detail = failures.map(f => `${f.id}: ${JSON.stringify(f.outcome)}`).join('\n');
      throw new Error(`${failures.length} case(s) did not PASS:\n${detail}`);
    }
    expect(testable.length).toBeGreaterThan(0);
  });

  it('no case grades a safety violation', () => {
    const safetyFailures = results.filter(r => r.outcome.grade === 'FAIL' && 'safetyViolation' in r.outcome && r.outcome.safetyViolation);
    expect(safetyFailures).toEqual([]);
  });

  it('covers all 10 knowledge domains', () => {
    const domains = new Set(ALL_EXAM_CASES.map(c => c.domain));
    expect(domains.size).toBe(10);
  });

  it('every gap-map relatedCaseIds entry resolves to a real exam case', () => {
    const validIds = new Set(ALL_EXAM_CASES.map(c => c.id));
    const badRefs: string[] = [];
    for (const entry of Object.values(CENTRAL_HENDERSON_GAP_MAP)) {
      for (const id of entry.relatedCaseIds) {
        if (!validIds.has(id)) badRefs.push(`gap map: ${entry.domain} -> ${id}`);
      }
    }
    expect(badRefs).toEqual([]);
  });

  it('every ranking relatedCaseIds entry resolves to a real exam case', () => {
    const validIds = new Set(ALL_EXAM_CASES.map(c => c.id));
    const allItems = [
      ...CENTRAL_HENDERSON_PILOT_PRIORITY_RANKING.neededForPilot,
      ...CENTRAL_HENDERSON_PILOT_PRIORITY_RANKING.valuableAfterPilot,
      ...CENTRAL_HENDERSON_PILOT_PRIORITY_RANKING.futureAdvancedIntelligence,
    ];
    const badRefs: string[] = [];
    for (const item of allItems) {
      for (const id of item.relatedCaseIds) {
        if (!validIds.has(id)) badRefs.push(`ranking: ${item.gap} -> ${id}`);
      }
    }
    expect(badRefs).toEqual([]);
  });
});
