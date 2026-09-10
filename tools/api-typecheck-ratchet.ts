#!/usr/bin/env tsx
/**
 * api typecheck ratchet — fails the build when api/ gains type errors.
 *
 * Why a count and not a clean gate:
 *   `npm run typecheck` in api/ aborted for a long time on
 *   `TS5108: Option 'moduleResolution=node10' has been removed`, so it
 *   checked nothing and 126 errors accumulated unseen. Five groups of
 *   those were fixed (#242 #243 #244 #245 #246). The 17 that remain are
 *   all one thing: Stripe 14 code against Stripe 22 types, where fields
 *   moved rather than being renamed. That migration cannot be validated
 *   without live keys, so it is deliberately deferred.
 *
 *   Gating on zero would mean either doing that migration under time
 *   pressure or suppressing the errors. Gating on the count keeps every
 *   error visible while making the number a floor that only falls.
 *
 * Rule:
 *   The error count must never exceed API_TYPECHECK_BASELINE. If it drops,
 *   this fails too, with the new number to write here — that is what makes
 *   it a ratchet rather than a high-water mark nobody lowers.
 *
 * This does NOT check which errors they are, only how many. A fix plus a
 * fresh error of equal count passes. The same posture as lint-rls.ts
 * checking RLS is enabled, not that the policies are right.
 *
 * Usage:
 *   npx tsx tools/api-typecheck-ratchet.ts
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

export const API_TYPECHECK_BASELINE = 17;

/** Every `error TSxxxx` line tsc printed. Exported for the test. */
export function countErrors(output: string): number {
  return output.split('\n').filter((line) => /error TS\d+:/.test(line)).length;
}

export function runApiTypecheck(apiDir: string): { count: number; output: string } {
  // api/ pins its own TypeScript (7.x), which is the compiler whose node10
  // removal started all this — so run api's own typecheck, not the root one.
  const result = spawnSync('npm', ['run', 'typecheck'], {
    cwd: apiDir,
    encoding: 'utf8',
    shell: false,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { count: countErrors(output), output };
}

function main(): void {
  const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'api');
  const { count, output } = runApiTypecheck(apiDir);

  if (count > API_TYPECHECK_BASELINE) {
    console.error(
      `api typecheck: ${count} errors, baseline is ${API_TYPECHECK_BASELINE}.\n` +
      `${count - API_TYPECHECK_BASELINE} new error(s) were introduced. Fix them, or if you are\n` +
      `deliberately grandfathering something in, raise API_TYPECHECK_BASELINE in\n` +
      `tools/api-typecheck-ratchet.ts and say why in the commit message.\n`,
    );
    console.error(output);
    process.exit(1);
  }

  if (count < API_TYPECHECK_BASELINE) {
    console.error(
      `api typecheck: ${count} errors, down from a baseline of ${API_TYPECHECK_BASELINE}.\n` +
      `Lower API_TYPECHECK_BASELINE in tools/api-typecheck-ratchet.ts to ${count} so the\n` +
      `gain is locked in. The ratchet only tightens.\n`,
    );
    process.exit(1);
  }

  console.log(`api typecheck: ${count} errors, matching the baseline of ${API_TYPECHECK_BASELINE}.`);
}

const isMain = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
  } catch {
    return false;
  }
})();

if (isMain) {
  main();
}
