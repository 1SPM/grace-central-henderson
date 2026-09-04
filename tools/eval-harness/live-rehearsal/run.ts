#!/usr/bin/env tsx
/**
 * Manual CLI for the live-tenant workshop rehearsal. NOT in CI.
 * Writes and then removes a clearly-labelled TEST person; writes one
 * grace_memories row for the demo account (left in place on purpose —
 * demo leg 3 needs a pre-existing memory to recall).
 *
 *   npx tsx --env-file=.env.local tools/eval-harness/live-rehearsal/run.ts
 */
import { execFileSync } from 'node:child_process';

if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing ANTHROPIC_API_KEY / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local');
  process.exit(1);
}
console.log('Rehearsing demo legs 3 + 4 against the LIVE Central Henderson tenant.\n');
try {
  execFileSync('npx', ['vitest', 'run', '--config', 'tools/eval-harness/live-rehearsal/vitest.rehearsal.config.ts'],
    { stdio: 'inherit', env: process.env });
} catch {
  process.exitCode = 1;
}
