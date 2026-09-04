/**
 * Every API route runs under Node ESM on Vercel, which compiles each traced
 * .ts file to .js one-for-one and resolves relative specifiers literally:
 * `./actionCatalog` is ERR_MODULE_NOT_FOUND at runtime even though Vite,
 * vitest and tsc all resolve it. Nothing in the test suite exercises that
 * loader, so an offending import ships green and fails on first invocation —
 * which is exactly how api/grace/_entity-memory.ts went down in production on
 * 2026-09-04 by reaching src/lib/grace-actions.ts.
 *
 * This walks the runtime import graph from every API module (following into
 * src/ when a route reaches across) and fails on any relative specifier
 * without an extension. Type-only imports are erased and skipped.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const API_DIR = join(ROOT, 'api');

function apiModules(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) apiModules(full, out);
    else if (/\.ts$/.test(entry) && !/\.(test|spec)\.ts$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

// `import x from '…'`, `export … from '…'`, `import('…')` — not `import type`.
const SPECIFIER = /(?:^|\n)\s*(?:import(?!\s+type\b)[^'"]*?from\s*|export[^'"]*?from\s*|import\s*\()\s*['"]([^'"]+)['"]/g;

function relativeSpecifiers(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const m of src.matchAll(SPECIFIER)) if (m[1].startsWith('.')) found.push(m[1]);
  return found;
}

function resolveSpecifier(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base.replace(/\.js$/, '.ts'), base, base.replace(/\.js$/, '.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

describe('API runtime import graph is Node-ESM safe', () => {
  const offenders: string[] = [];
  const seen = new Set<string>();
  const queue = apiModules(API_DIR);
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of relativeSpecifiers(file)) {
      if (!/\.(js|mjs|cjs|json)$/.test(spec)) offenders.push(`${relative(ROOT, file)} -> '${spec}'`);
      const target = resolveSpecifier(file, spec);
      if (target && !seen.has(target)) queue.push(target);
    }
  }

  it('walks a non-trivial graph', () => {
    expect(seen.size).toBeGreaterThan(20);
  });

  it('every relative import reachable from api/ carries an extension', () => {
    expect(offenders).toEqual([]);
  });
});
