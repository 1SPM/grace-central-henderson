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
 * exact thing "advisory, never CI-gating" exists to prevent. Runs each
 * case LIVE_JUDGE_SAMPLES times (default 3, set by run.ts's --samples
 * flag) and aggregates — a single run is not a statistical claim; see
 * Fixtures #001/#002's scenarios, both of which showed real run-to-run
 * variance once actually sampled.
 */
import { describe, it, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLiveJudgeCaseSampled } from './judge.js';
import { PC_CONNECT_PRAYER_GIVING } from './scenarios/pc-connect-prayer-giving.js';
import { GOV_INTERPRET_AMBIGUOUS_DELETION_RISK } from './scenarios/gov-interpret-ambiguous-deletion-risk.js';
import { CHN_CONNECT_EVENT_MISSION } from './scenarios/chn-connect-event-mission.js';
import type { LiveJudgeCase, LiveJudgeSampledResult } from './types.js';

const CASES: LiveJudgeCase[] = [PC_CONNECT_PRAYER_GIVING, GOV_INTERPRET_AMBIGUOUS_DELETION_RISK, CHN_CONNECT_EVENT_MISSION];
const SAMPLES = Math.max(1, Number(process.env.LIVE_JUDGE_SAMPLES) || 3);

let results: LiveJudgeSampledResult[];

beforeAll(async () => {
  results = [];
  for (const c of CASES) {
    results.push(await runLiveJudgeCaseSampled(c, SAMPLES));
  }
  const outDir = join(process.cwd(), 'tools/eval-harness/.output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'live-judge-results.json'), JSON.stringify(results, null, 2));
}, 60_000 * SAMPLES * CASES.length); // real network calls, N samples each — scale the budget, don't guess a fixed one

describe('Live-judgment tier (advisory only — see header comment)', () => {
  it('every case produced its full sample set, whatever the verdicts', () => {
    if (results.length !== CASES.length) {
      throw new Error(`expected ${CASES.length} case result(s), got ${results.length}`);
    }
    for (const r of results) {
      if (r.samples.length !== SAMPLES) {
        throw new Error(`${r.id}: expected ${SAMPLES} sample(s), got ${r.samples.length}`);
      }
    }
  });
});
