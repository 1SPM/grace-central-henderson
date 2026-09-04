/**
 * Puts Fixture #005's EvalCases under the normal `npx vitest run` gate,
 * and writes machine-readable output for run-all.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCases, toJSON } from '../runner.js';
import { FIXTURE_005_CASES } from './fixture-005-events-calendar.cases.js';
import type { EvalResult } from '../types.js';

let results: EvalResult[];

beforeAll(async () => {
  results = await runCases(FIXTURE_005_CASES);
  const outDir = join(process.cwd(), 'tools/eval-harness/.output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'fixture-005-events-calendar.json'), toJSON(results));
});

describe('Fixture #005 (events/calendar) via the eval harness', () => {
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

  it('the no-server-action case is flagged as an architectural finding, not a plain pass', () => {
    const finding = results.find(r => r.id === 'ec-act-no-server-routed-action-exists');
    expect(finding?.isArchitecturalFinding).toBe(true);
  });
});
