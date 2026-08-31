#!/usr/bin/env tsx
/**
 * Standalone CLI for the Central Henderson GRACE Qualification Exam.
 *
 *   npx tsx tools/eval-harness/central-henderson-exam/run-exam.ts          human report
 *   npx tsx tools/eval-harness/central-henderson-exam/run-exam.ts --json    machine-readable
 *
 * Deliberately separate from tools/eval-harness/run-all.ts — this exam's
 * results are never blended into that 6-fixture combined report (see
 * scorecard.ts's header comment for why). Same shell-to-vitest technique
 * as run-all.ts, for the same reason (several cases need vitest's `vi`
 * mocking runtime, only available inside an actual vitest worker).
 *
 * Exits non-zero on the same conditions run-all.ts does: a 'testable'
 * case FAILs, or any outcome carries safetyViolation:true.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHumanReport, renderCapabilityBaseline, hasBlockingFailure } from '../runner.js';
import { buildChurchScorecard, renderScorecardMarkdown } from './scorecard.js';
import { CENTRAL_HENDERSON_GAP_MAP, renderGapMapMarkdown } from './knowledge-gap-map.js';
import { CENTRAL_HENDERSON_PILOT_PRIORITY_RANKING } from './pilot-priority-ranking.js';
import type { EvalResult } from '../types.js';

const OUT_DIR = join(process.cwd(), 'tools/eval-harness/.output');
const RESULTS_FILE = 'central-henderson-exam.json';
const TEST_FILE = 'tools/eval-harness/central-henderson-exam/central-henderson-exam.test.ts';

function regenerateResults() {
  try {
    execFileSync('npx', ['vitest', 'run', TEST_FILE], { stdio: 'pipe' });
  } catch {
    // Same reasoning as run-all.ts: a testable-case FAIL makes the wrapper
    // test's own assertion throw, which makes vitest exit non-zero —
    // expected, not a script bug. The JSON was still written via
    // beforeAll; this script's own exit code below is authoritative.
  }
}

function loadResults(): EvalResult[] {
  const path = join(OUT_DIR, RESULTS_FILE);
  if (!existsSync(path)) {
    console.error(`✗ central-henderson-exam: expected output file missing: ${path} — the vitest run may have failed before beforeAll ran.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as EvalResult[];
}

function writeArtifacts(results: EvalResult[]) {
  mkdirSync(OUT_DIR, { recursive: true });
  const scorecard = buildChurchScorecard(results);
  writeFileSync(join(OUT_DIR, 'central-henderson-scorecard.json'), JSON.stringify(scorecard, null, 2));
  writeFileSync(join(OUT_DIR, 'central-henderson-scorecard.md'), renderScorecardMarkdown(scorecard));
  writeFileSync(join(OUT_DIR, 'central-henderson-gap-map.json'), JSON.stringify(CENTRAL_HENDERSON_GAP_MAP, null, 2));
  writeFileSync(join(OUT_DIR, 'central-henderson-gap-map.md'), renderGapMapMarkdown(CENTRAL_HENDERSON_GAP_MAP));
  writeFileSync(join(OUT_DIR, 'central-henderson-pilot-priority-ranking.json'), JSON.stringify(CENTRAL_HENDERSON_PILOT_PRIORITY_RANKING, null, 2));
  return scorecard;
}

function main() {
  regenerateResults();
  const results = loadResults();
  const scorecard = writeArtifacts(results);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ results, scorecard, gapMap: CENTRAL_HENDERSON_GAP_MAP, ranking: CENTRAL_HENDERSON_PILOT_PRIORITY_RANKING }, null, 2));
  } else {
    console.log(renderScorecardMarkdown(scorecard));
    console.log(renderHumanReport(results));
    console.log(renderCapabilityBaseline(results));
    console.log(`\nWrote scorecard/gap-map/ranking to ${OUT_DIR}/central-henderson-*.{json,md}`);
  }

  if (hasBlockingFailure(results)) {
    console.error('\n✗ central-henderson-exam: at least one testable case failed, or a safety violation was graded.');
    process.exit(1);
  }
  if (!process.argv.includes('--json')) {
    console.log('\n✓ central-henderson-exam: no blocking failures.');
  }
}

main();
