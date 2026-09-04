/**
 * Puts Fixture #003's EvalCases under the normal `npx vitest run` gate,
 * and writes machine-readable output for run-all.ts — see the comment in
 * fixture-001-central-henderson.cases.test.ts for why.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCases, toJSON } from '../runner.js';
import { FIXTURE_003_CASES } from './fixture-003-people-households.cases.js';
import type { EvalResult } from '../types.js';

let results: EvalResult[];

beforeAll(async () => {
  results = await runCases(FIXTURE_003_CASES);
  const outDir = join(process.cwd(), 'tools/eval-harness/.output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'fixture-003-people-households.json'), toJSON(results));
});

describe('Fixture #003 (people/households) via the eval harness', () => {
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

  it('the chat-door-bypass case is flagged as an architectural finding, not a plain pass', () => {
    const finding = results.find(r => r.id === 'ph-act-chat-door-bypasses-server-pipeline');
    expect(finding?.isArchitecturalFinding).toBe(true);
  });
});
