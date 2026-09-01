/**
 * Standalone vitest config for the LIVE TENANT workshop rehearsal —
 * deliberately separate from the repo's main vitest.config.ts, whose
 * `include` glob (tools/**\/*.{test,spec}.ts) never matches
 * `rehearsal.runner.ts`. This file's `include` is the ONLY thing that can
 * run it, and it is only ever invoked explicitly via
 * `npx tsx --env-file=.env.local tools/eval-harness/live-rehearsal/run.ts`.
 *
 * Never wired into CI. Same discipline as live-judge/vitest.livejudge.config.ts.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    include: ['tools/eval-harness/live-rehearsal/rehearsal.runner.ts'],
  },
});
