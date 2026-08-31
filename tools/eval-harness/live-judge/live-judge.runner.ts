/**
 * The actual vitest entry point for the live-judgment tier. Exists only
 * because judge.ts's chat-route call needs vitest's `vi` mocking runtime
 * (same reason the deterministic tier's run-all.ts shells out to vitest
 * rather than running under plain tsx) — this file is what supplies that
 * runtime.
 *
 * DELIBERATELY NOT NAMED *.test.ts or *.spec.ts: vitest.config.ts's main
 * `include` glob only matches those suffixes, so `npm run test:run` / the
 * required CI `test` job / the `eval-harness` CI job never discover or run
 * this file — real, paid Claude API calls stay opt-in only, via
 * `npx tsx tools/eval-harness/live-judge/run.ts`, which invokes THIS file
 * through a separate, narrowly-scoped vitest.livejudge.config.ts. Do not
 * rename this file to end in .test.ts/.spec.ts.
 *
 * No pass/fail assertion is tied to a case's verdict — that would make a
 * non-deterministic, real-API-cost-per-run test flaky by construction, the
 * exact thing "advisory, never CI-gating" exists to prevent.
 */
import { describe, it, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLiveJudgeCase } from './judge.js';
import { PC_CONNECT_PRAYER_GIVING } from './scenarios/pc-connect-prayer-giving.js';
import { GOV_INTERPRET_AMBIGUOUS_DELETION_RISK } from './scenarios/gov-interpret-ambiguous-deletion-risk.js';
import type { LiveJudgeCase, LiveJudgeResult } from './types.js';

const CASES: LiveJudgeCase[] = [PC_CONNECT_PRAYER_GIVING, GOV_INTERPRET_AMBIGUOUS_DELETION_RISK];

let results: LiveJudgeResult[];

beforeAll(async () => {
  results = [];
  for (const c of CASES) {
    results.push(await runLiveJudgeCase(c));
  }
  const outDir = join(process.cwd(), 'tools/eval-harness/.output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'live-judge-results.json'), JSON.stringify(results, null, 2));
}, 120_000); // real network calls — generous timeout, not the usual mocked-test budget

describe('Live-judgment tier (advisory only — see header comment)', () => {
  it('every case produced a result, whatever its verdict', () => {
    if (results.length !== CASES.length) {
      throw new Error(`expected ${CASES.length} result(s), got ${results.length}`);
    }
  });
});
