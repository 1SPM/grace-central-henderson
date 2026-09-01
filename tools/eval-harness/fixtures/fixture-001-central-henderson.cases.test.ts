/**
 * Puts Fixture #001's EvalCases under the normal `npx vitest run` gate.
 * api/grace/_chat.central-henderson-fixture.test.ts remains the
 * authoritative regression test — this asserts the harness's classified
 * representation of the same behavior also passes.
 *
 * Also writes results to tools/eval-harness/.output/ as a side effect
 * (regardless of whether the assertions below pass) — this is how
 * run-all.ts's CLI gets machine-readable data: the case run()s call real
 * HTTP handlers that need vitest's mocking runtime (vi.fn/doMock), which
 * only exists inside an actual vitest worker, so run-all.ts shells out to
 * `vitest run` rather than calling runCases() from plain tsx.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCases, toJSON } from '../runner.js';
import { FIXTURE_001_CASES } from './fixture-001-central-henderson.cases.js';
import type { EvalResult } from '../types.js';

let results: EvalResult[];

beforeAll(async () => {
  results = await runCases(FIXTURE_001_CASES);
  const outDir = join(process.cwd(), 'tools/eval-harness/.output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'fixture-001-central-henderson.json'), toJSON(results));
});

describe('Fixture #001 (Central Henderson) via the eval harness', () => {
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
});
