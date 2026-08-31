#!/usr/bin/env tsx
/**
 * Manual, on-demand CLI for the live-judgment tier. NOT wired into CI —
 * see live-judge.runner.ts's header comment for why. Every result printed
 * here is ADVISORY: a real model call graded by a second real model call,
 * never a deterministic pass/fail, never a gate for anything.
 *
 * Usage (needs a real ANTHROPIC_API_KEY — .env.local already has one for
 * local dev, so run via tsx's --env-file flag):
 *
 *   npx tsx --env-file=.env.local tools/eval-harness/live-judge/run.ts
 *
 * Costs real API usage per run (one chat call + one judge call per case).
 * Run it deliberately, not in a loop.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LiveJudgeResult } from './types.js';

const OUT_PATH = join(process.cwd(), 'tools/eval-harness/.output/live-judge-results.json');
const CONFIG_PATH = 'tools/eval-harness/live-judge/vitest.livejudge.config.ts';
const RUNNER_PATH = 'tools/eval-harness/live-judge/live-judge.runner.ts';

function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('✗ ANTHROPIC_API_KEY is not set in this process.');
    console.error('  Run with: npx tsx --env-file=.env.local tools/eval-harness/live-judge/run.ts');
    process.exit(1);
  }

  console.log('Running live-judgment cases — this makes real, paid Claude API calls...\n');
  try {
    execFileSync('npx', ['vitest', 'run', '--config', CONFIG_PATH, RUNNER_PATH], {
      stdio: 'inherit',
      env: process.env,
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

  const results = JSON.parse(readFileSync(OUT_PATH, 'utf8')) as LiveJudgeResult[];
  console.log('\n== Live-judgment results (ADVISORY — never a deterministic pass/fail) ==');
  for (const r of results) {
    console.log(`\n[${r.verdict.toUpperCase()}] ${r.id} — ${r.domain}/${r.level}`);
    if (r.judgeReasoning) console.log(`  judge reasoning: ${r.judgeReasoning}`);
    if (r.detail) console.log(`  detail: ${r.detail}`);
    if (r.modelAnswer) console.log(`  model answer: ${r.modelAnswer.slice(0, 300)}${r.modelAnswer.length > 300 ? '…' : ''}`);
  }
  console.log(`\n${results.length} case(s) — this never gates a build. See docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md's "Evaluation harness" section.`);
}

main();
