/**
 * Standalone, narrowly-scoped vitest config for the live-judgment tier —
 * deliberately separate from the repo's main vitest.config.ts, whose
 * `include` glob (tools/**\/*.{test,spec}.ts) never matches anything in
 * this directory. This file's `include` is the ONLY thing that can ever
 * run live-judge.runner.ts, and it is only ever invoked explicitly via
 * `npx tsx tools/eval-harness/live-judge/run.ts` — never by `npm run
 * test:run`, never by any CI job. See live-judge.runner.ts's header
 * comment for the full reasoning.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tools/eval-harness/live-judge/live-judge.runner.ts'],
  },
});
