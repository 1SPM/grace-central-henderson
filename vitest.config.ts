import { defineConfig } from 'vitest/config';

// Backend + tooling tests only. Frontend tests live with their own app now
// (apps/admin-web/vitest.config.ts, apps/member-web/vitest.config.ts) —
// api/ and tools/ stay shared at the repo root (Phase 1 plan: one api/,
// shared by both Vercel projects), so they keep their own root-level config.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tools/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      'api/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
});
