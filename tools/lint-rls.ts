#!/usr/bin/env tsx
/**
 * RLS lint — fails the build when a Supabase migration creates a
 * table without enabling Row-Level Security.
 *
 * Rule:
 *   Every `CREATE TABLE` must have a corresponding
 *   `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the migration set.
 *
 * Policies are NOT required by this lint. Postgres defaults to deny
 * when RLS is enabled with no policies — that is the most restrictive
 * (service-role-only) state and is a valid, documented pattern in
 * this codebase (see migrations 007 and 008). Whether a particular
 * table needs a tenant-scoped policy is a design decision, not a lint
 * rule. The fatal bug we are gating against is RLS being OFF.
 *
 * Background: see DECISIONS.md ADR-003 and TECH_DEBT.md TD-001.
 *
 * Usage:
 *   npx tsx tools/lint-rls.ts                            # all migrations
 *   npx tsx tools/lint-rls.ts supabase/migrations/foo.sql other.sql
 *
 * Exits 0 on clean, 1 on violations.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------- Pure parsers (testable, no I/O) -----------------------------

function normalizeIdentifier(raw: string): string {
  // Strip schema qualifier (public.foo → foo) and surrounding quotes.
  const noSchema = raw.includes('.') ? raw.split('.').pop()! : raw;
  return noSchema.replace(/^"|"$/g, '').toLowerCase();
}

function stripComments(sql: string): string {
  // Remove line comments (-- ...) and block comments (/* ... */).
  // Naïve, sufficient for our migration style.
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');
}

export interface FoundTable {
  name: string;
  line: number;
}

// Identifier: either a quoted name ("FooBar") OR a schema-qualified or bare
// snake_case name (public.foo, foo). Quotes preserved here; stripped by
// normalizeIdentifier.
const IDENT = `(?:"[^"]+"|[A-Za-z_][\\w]*(?:\\.[A-Za-z_"][\\w."]*)?)`;
const CREATE_TABLE = new RegExp(`\\bCREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(${IDENT})`, 'gi');
const ENABLE_RLS = new RegExp(`\\bALTER\\s+TABLE\\s+(${IDENT})\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\b`, 'gi');
const CREATE_POLICY = new RegExp(`\\bCREATE\\s+POLICY\\b[^;]*?\\bON\\s+(${IDENT})`, 'gi');

export function findCreateTables(sql: string): FoundTable[] {
  const cleaned = stripComments(sql);
  const out: FoundTable[] = [];
  for (const match of cleaned.matchAll(CREATE_TABLE)) {
    const name = normalizeIdentifier(match[1]);
    const line = (cleaned.slice(0, match.index ?? 0).match(/\n/g)?.length ?? 0) + 1;
    out.push({ name, line });
  }
  return out;
}

export function findEnableRls(sql: string): string[] {
  const cleaned = stripComments(sql);
  return [...cleaned.matchAll(ENABLE_RLS)].map((m) => normalizeIdentifier(m[1]));
}

export function findCreatePolicies(sql: string): string[] {
  const cleaned = stripComments(sql);
  return [...cleaned.matchAll(CREATE_POLICY)].map((m) => normalizeIdentifier(m[1]));
}

// ---------- Analysis ----------------------------------------------------

export interface Violation {
  table: string;
  declaredIn: string;
  declaredLine: number;
  missing: ['ENABLE ROW LEVEL SECURITY'];
}

export interface MigrationInput {
  path: string;
  content: string;
}

export function lintMigrations(files: MigrationInput[]): Violation[] {
  const declared = new Map<string, { path: string; line: number }>();
  const rlsEnabled = new Set<string>();

  for (const file of files) {
    for (const t of findCreateTables(file.content)) {
      if (!declared.has(t.name)) {
        declared.set(t.name, { path: file.path, line: t.line });
      }
    }
    for (const name of findEnableRls(file.content)) {
      rlsEnabled.add(name);
    }
  }

  const violations: Violation[] = [];
  for (const [name, where] of declared.entries()) {
    if (!rlsEnabled.has(name)) {
      violations.push({
        table: name,
        declaredIn: where.path,
        declaredLine: where.line,
        missing: ['ENABLE ROW LEVEL SECURITY'],
      });
    }
  }
  return violations;
}

// ---------- CLI shell ---------------------------------------------------

function loadMigrations(args: string[]): MigrationInput[] {
  if (args.length > 0) {
    return args.map((p) => ({ path: p, content: readFileSync(p, 'utf8') }));
  }
  const dir = resolve('supabase/migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((f) => ({ path: join(dir, f), content: readFileSync(join(dir, f), 'utf8') }));
}

function formatViolations(violations: Violation[]): string {
  const lines: string[] = [];
  lines.push(`\nRLS lint: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    lines.push(`  ${basename(v.declaredIn)}:${v.declaredLine}  table "${v.table}" is missing:`);
    for (const m of v.missing) {
      lines.push(`    - ALTER TABLE ${v.table} ENABLE ROW LEVEL SECURITY;`);
      void m;
    }
  }
  lines.push('');
  lines.push('Every new table MUST enable RLS. Policies are optional — RLS-enabled');
  lines.push('with no policy is a valid "service-role-only" pattern (Postgres defaults');
  lines.push('to deny). See DECISIONS.md ADR-003 and TECH_DEBT.md TD-001.');
  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const migrations = loadMigrations(args);
  const violations = lintMigrations(migrations);
  if (violations.length === 0) {
    console.log(`RLS lint: OK (${migrations.length} migrations scanned)`);
    process.exit(0);
  }
  console.error(formatViolations(violations));
  process.exit(1);
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
