#!/usr/bin/env tsx
/**
 * Security-gate check: frontend safety.
 *
 *   1. No service-role / secret key is READ in bundled client code (src/).
 *      Catches an actual `import.meta.env.*SERVICE_ROLE*` / `process.env.*SERVICE_ROLE*`
 *      read — not a bare string mention (so a user-facing "ask your admin to set
 *      SUPABASE_SERVICE_ROLE_KEY" message does not trip it).
 *
 *   2. No public-prefixed env var (VITE_ / NEXT_PUBLIC_) that is actually
 *      read or declared looks like a secret — those get bundled into the
 *      client and shipped to every browser.
 *
 * Exits non-zero on any finding. Pure helpers are exported for unit tests.
 * Scans only *usage* (reads + .env declarations), never comments/type decls.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// ── (2) public-prefix secret detection ────────────────────────────────
const PUBLIC_PREFIXES = ['VITE_', 'NEXT_PUBLIC_'];
// Names whose shape is inherently public — publishable/anon keys, DSNs, hosts,
// urls, ids, and non-secret config flags.
const STRUCTURAL_PUBLIC =
  /PUBLISHABLE|ANON|_CLIENT_KEY$|_DSN$|_HOST$|_URL$|_ID$|_ADDRESS$|_NAME$|_ENABLED$|_MODE$|_ENVIRONMENT$|_RELEASE$/;
// Explicitly-cleared public keys that end in _KEY but are client-side by design.
const EXPLICIT_PUBLIC_ALLOW = new Set(['VITE_POSTHOG_KEY']);
const SECRETISH = /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)/;
const KEYISH = /_(KEY|TOKEN)$|_API_KEY$/;

export function isExposedPublicSecret(name: string): boolean {
  if (!PUBLIC_PREFIXES.some((p) => name.startsWith(p))) return false;
  if (EXPLICIT_PUBLIC_ALLOW.has(name)) return false;
  if (STRUCTURAL_PUBLIC.test(name)) return false;
  return SECRETISH.test(name) || KEYISH.test(name);
}

// ── (1) service-role usage in frontend ────────────────────────────────
const SERVICE_ROLE_READ =
  /(?:process\.env|import\.meta\.env)\.[A-Z_]*(?:SERVICE_ROLE|SERVICE_KEY)[A-Z_]*/;

export function findServiceRoleUsage(content: string): number[] {
  const out: number[] = [];
  content.split('\n').forEach((line, i) => {
    if (SERVICE_ROLE_READ.test(line)) out.push(i + 1);
  });
  return out;
}

/** Public-prefixed env names actually READ in code (bundled). */
export function extractEnvReads(content: string): string[] {
  const m = content.match(/(?:import\.meta\.env|process\.env)\.((?:VITE_|NEXT_PUBLIC_)[A-Z0-9_]+)/g) ?? [];
  return [...new Set(m.map((s) => s.replace(/^.*\./, '')))];
}

/** Public-prefixed env names DECLARED in a .env file (NAME=...). */
export function extractEnvDeclarations(content: string): string[] {
  const out: string[] = [];
  for (const line of content.split('\n')) {
    const mm = line.match(/^\s*((?:VITE_|NEXT_PUBLIC_)[A-Z0-9_]+)\s*=/);
    if (mm) out.push(mm[1]);
  }
  return [...new Set(out)];
}

// ── file walk + CLI ───────────────────────────────────────────────────
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte']);
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else if (CODE_EXT.has(extname(p))) files.push(p);
  }
  return files;
}

export function runFrontendSafety(srcDir = 'src', envFiles = ['.env.example']): string[] {
  const findings: string[] = [];

  for (const f of walk(srcDir)) {
    const content = readFileSync(f, 'utf8');
    for (const ln of findServiceRoleUsage(content)) {
      findings.push(`[service-role] ${f}:${ln} — reads a service-role/secret key in bundled frontend code`);
    }
  }

  const names = new Set<string>();
  for (const f of walk(srcDir)) for (const n of extractEnvReads(readFileSync(f, 'utf8'))) names.add(n);
  for (const envf of envFiles) if (existsSync(envf)) for (const n of extractEnvDeclarations(readFileSync(envf, 'utf8'))) names.add(n);
  for (const n of [...names].sort()) {
    if (isExposedPublicSecret(n)) {
      findings.push(`[public-secret] ${n} — public (bundled) prefix on a name that looks secret; move it server-side (drop the VITE_/NEXT_PUBLIC_ prefix)`);
    }
  }
  return findings;
}

// Run when invoked directly (tsx tools/check-frontend-safety.ts).
if (process.argv[1] && process.argv[1].endsWith('check-frontend-safety.ts')) {
  const findings = runFrontendSafety();
  if (findings.length > 0) {
    console.error(`✗ frontend-safety: ${findings.length} finding(s)`);
    for (const f of findings) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log('✓ frontend-safety: no service-role usage or exposed secrets in frontend code');
}
