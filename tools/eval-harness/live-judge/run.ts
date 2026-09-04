#!/usr/bin/env tsx
/**
 * Manual, on-demand CLI for the live-judgment tier. NOT wired into CI —
 * see live-judge.runner.ts's header comment for why. Every result printed
 * here is ADVISORY: a real model call graded by a second real model call,
 * never a deterministic pass/fail, never a gate for anything.
 *
 * Each case runs `--samples` independent times (default 3) and reports an
 * aggregate — a single run is not a statistical claim; two of the three
 * scenarios built so far showed real run-to-run variance once actually
 * sampled by hand, which is exactly the gap this flag closes.
 *
 * Usage (needs a real ANTHROPIC_API_KEY — .env.local already has one for
 * local dev, so run via tsx's --env-file flag):
 *
 *   npx tsx --env-file=.env.local tools/eval-harness/live-judge/run.ts
 *   npx tsx --env-file=.env.local tools/eval-harness/live-judge/run.ts --samples=5
 *   npx tsx --env-file=.env.local tools/eval-harness/live-judge/run.ts --json
 *
 * Costs real API usage per run: 2 calls (chat + judge) × samples × cases.
 * Run it deliberately, not in a loop.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LiveJudgeSampledResult } from './types.js';

const OUT_PATH = join(process.cwd(), 'tools/eval-harness/.output/live-judge-results.json');
const CONFIG_PATH = 'tools/eval-harness/live-judge/vitest.livejudge.config.ts';
const RUNNER_PATH = 'tools/eval-harness/live-judge/live-judge.runner.ts';

function parseSamples(): number {
  const arg = process.argv.find(a => a.startsWith('--samples='));
  if (!arg) return 3;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
}

function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('✗ ANTHROPIC_API_KEY is not set in this process.');
    console.error('  Run with: npx tsx --env-file=.env.local tools/eval-harness/live-judge/run.ts');
    process.exit(1);
  }

  const samples = parseSamples();
  console.log(`Running live-judgment cases, ${samples} sample(s) each — this makes real, paid Claude API calls...\n`);
  try {
    execFileSync('npx', ['vitest', 'run', '--config', CONFIG_PATH, RUNNER_PATH], {
      stdio: 'inherit',
      env: { ...process.env, LIVE_JUDGE_SAMPLES: String(samples) },
    });
  } catch {
    // A thrown structural error inside the runner (not a case verdict)
    // surfaces here as a non-zero vitest exit — the JSON may still be
    // partially written; report what's there rather than exiting silently.
  }

  if (!existsSync(OUT_PATH)) {
    console.error(`✗ no results file at ${OUT_PATH} — the runner likely failed before writing anything.`);
    process.exit(1);
  }

  const results = JSON.parse(readFileSync(OUT_PATH, 'utf8')) as LiveJudgeSampledResult[];

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('\n== Live-judgment results (ADVISORY — never a deterministic pass/fail) ==');
  for (const r of results) {
    const rateStr = r.passRate === null ? 'n/a' : `${Math.round(r.passRate * 100)}%`;
    console.log(`\n[${r.passCount}/${r.samples.length} PASS, rate ${rateStr}] ${r.id} — ${r.domain}/${r.level}`);
    if (r.errorCount > 0) console.log(`  ${r.errorCount} error(s), ${r.skippedCount} skipped (excluded from rate)`);
    r.samples.forEach((s, i) => {
      console.log(`  run ${i + 1}: [${s.verdict.toUpperCase()}]${s.judgeReasoning ? ` — ${s.judgeReasoning}` : ''}${s.detail ? ` — ${s.detail}` : ''}`);
    });
  }

  console.log(`\n${results.length} case(s), ${samples} sample(s) each — this never gates a build. See docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md's "Evaluation harness" section.`);
}

main();
