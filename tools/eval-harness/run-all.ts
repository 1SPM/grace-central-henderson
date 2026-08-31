#!/usr/bin/env tsx
/**
 * Standalone CLI entry point for the GRACE Intelligence Qualification
 * Framework's deterministic evaluation tier.
 *
 *   npx tsx tools/eval-harness/run-all.ts          human report + baseline
 *   npx tsx tools/eval-harness/run-all.ts --json    machine-readable JSON
 *
 * WHY THIS SHELLS OUT TO VITEST rather than importing the fixture case
 * files and calling runCases() directly: several cases' run() bodies
 * invoke real HTTP handlers (api/grace/_chat.ts, api/actions/_execute.ts,
 * api/actions/_propose.ts) mocked via vitest's `vi.fn()`/`vi.doMock()`.
 * That mocking runtime only exists inside an actual vitest worker process
 * — importing the same case files under plain `tsx` fails with "Vitest
 * failed to access its internal state." So this script runs the real
 * `vitest run` (which is what actually executes runCases(), inside
 * fixtures/*.cases.test.ts's beforeAll) and then reads back the
 * machine-readable JSON those test files write as a side effect.
 *
 * Exits non-zero if any 'testable'-classified case FAILs, or if any
 * outcome carries safetyViolation:true (defense in depth, in case a
 * future safety-critical case is ever misclassified as non-testable).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHumanReport, renderCapabilityBaseline, hasBlockingFailure } from './runner.js';
import type { EvalResult } from './types.js';

const OUT_DIR = join(process.cwd(), 'tools/eval-harness/.output');
const CASE_TEST_FILES = [
  'tools/eval-harness/fixtures/fixture-001-central-henderson.cases.test.ts',
  'tools/eval-harness/fixtures/fixture-002-governance-authority.cases.test.ts',
  'tools/eval-harness/fixtures/fixture-003-people-households.cases.test.ts',
  'tools/eval-harness/fixtures/fixture-004-pastoral-care.cases.test.ts',
];
const OUTPUT_FILES = ['fixture-001-central-henderson.json', 'fixture-002-governance-authority.json', 'fixture-003-people-households.json', 'fixture-004-pastoral-care.json'];

function regenerateResults() {
  try {
    execFileSync('npx', ['vitest', 'run', ...CASE_TEST_FILES], { stdio: 'pipe' });
  } catch {
    // vitest exits non-zero when a case-test wrapper's own assertion
    // failed (a testable case didn't PASS) — expected, not a script bug.
    // The JSON was still written via beforeAll regardless of that
    // assertion's outcome; this script's own exit code below is the
    // authoritative one, based on the actual EvalOutcome data, not
    // vitest's exit code.
  }
}

function loadResults(): EvalResult[] {
  const all: EvalResult[] = [];
  for (const file of OUTPUT_FILES) {
    const path = join(OUT_DIR, file);
    if (!existsSync(path)) {
      console.error(`✗ eval-harness: expected output file missing: ${path} — the vitest run may have failed before beforeAll ran.`);
      process.exit(1);
    }
    all.push(...(JSON.parse(readFileSync(path, 'utf8')) as EvalResult[]));
  }
  return all;
}

function main() {
  regenerateResults();
  const results = loadResults();

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(renderHumanReport(results));
    console.log(renderCapabilityBaseline(results));
  }

  if (hasBlockingFailure(results)) {
    console.error('\n✗ eval-harness: at least one testable case failed, or a safety violation was graded.');
    process.exit(1);
  }
  if (!process.argv.includes('--json')) {
    console.log('\n✓ eval-harness: no blocking failures.');
  }
}

main();
