#!/usr/bin/env tsx
/**
 * Rollback lint — fails the build when a migration numbered after the
 * baseline has no documented rollback.
 *
 * Rule:
 *   Every migration numbered > ROLLBACK_LINT_BASELINE must contain a
 *   comment line that is a rollback marker: either the
 *   `-- ═══ ROLLBACK ═══` heading style (migrations 056-061) or a
 *   `-- Rollback:` label (migrations 063-064). RUNBOOK.md RB-057
 *   describes this as the standard migration procedure; this lint is
 *   what actually enforces it going forward.
 *
 * Why a baseline instead of scanning every migration ever written:
 *   Only 9 of the 74 migrations that predate this lint document a
 *   rollback. Scanning all of history would fail CI on day one over a
 *   backlog nobody asked this PR to clear. ROLLBACK_LINT_BASELINE is the
 *   number of the last migration written before this convention was
 *   enforced (071_chat_originated_agent_actions.sql — not authored in
 *   this session, so not retrofitted here); everything after it is new
 *   ground and gets the rule from the start. Raise the baseline only if
 *   you are deliberately grandfathering something in — never lower it.
 *
 * This does NOT check that the rollback SQL is correct, only that one is
 * documented — the same posture as lint-rls.ts checking RLS is enabled,
 * not that the policies are right.
 *
 * Usage:
 *   npx tsx tools/lint-rollback.ts                            # migrations > baseline
 *   npx tsx tools/lint-rollback.ts supabase/migrations/foo.sql # explicit files, baseline ignored
 *
 * Exits 0 on clean, 1 on violations.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROLLBACK_LINT_BASELINE = 71;

// A rollback marker is a comment line that, once the leading `--` and any
// box-drawing/whitespace filler is stripped, starts with the word
// "rollback" — either as its own heading or as a "Rollback:" label.
// Anchored to the start of the line so prose that merely mentions
// "the rollback" mid-sentence (see migration 070) does not count.
const ROLLBACK_MARKER = /^--[\s│═]*rollback\b/im;

export function hasRollbackMarker(sql: string): boolean {
  return ROLLBACK_MARKER.test(sql);
}

/** Extracts the leading migration number from a filename, e.g.
 * "072_agent_findings_staff_flag_source.sql" -> 72. Files that don't
 * start with digits (a handful of legacy names, e.g. "neobank_accounts.sql")
 * return null and are left out of the baseline comparison entirely — they
 * predate the numbering convention itself. */
export function migrationNumber(filename: string): number | null {
  const match = basename(filename).match(/^(\d+)_/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export interface MigrationInput {
  path: string;
  content: string;
}

export interface Violation {
  path: string;
  number: number;
}

/** `respectBaseline: false` checks every given file regardless of number —
 * used when the caller explicitly named files on the command line. */
export function lintMigrations(files: MigrationInput[], respectBaseline: boolean): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const number = migrationNumber(file.path);
    if (number === null) continue;
    if (respectBaseline && number <= ROLLBACK_LINT_BASELINE) continue;
    if (!hasRollbackMarker(file.content)) {
      violations.push({ path: file.path, number });
    }
  }
  return violations;
}

// ---------- CLI shell ---------------------------------------------------

function loadMigrations(args: string[]): { files: MigrationInput[]; respectBaseline: boolean } {
  if (args.length > 0) {
    return {
      files: args.map((p) => ({ path: p, content: readFileSync(p, 'utf8') })),
      respectBaseline: false,
    };
  }
  const dir = resolve('supabase/migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return {
    files: files.map((f) => ({ path: join(dir, f), content: readFileSync(join(dir, f), 'utf8') })),
    respectBaseline: true,
  };
}

function formatViolations(violations: Violation[]): string {
  const lines: string[] = [];
  lines.push(`\nRollback lint: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    lines.push(`  ${basename(v.path)}  has no documented rollback`);
  }
  lines.push('');
  lines.push(`Every migration numbered above ${ROLLBACK_LINT_BASELINE} must document its rollback —`);
  lines.push('either a "-- ═══ ROLLBACK ═══" heading or a "-- Rollback:" label, containing');
  lines.push('the inverse SQL (or an explanation of why none exists / is safe). See RUNBOOK.md');
  lines.push('RB-057 and any of migrations 056-064 for the established style.');
  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const { files, respectBaseline } = loadMigrations(args);
  const violations = lintMigrations(files, respectBaseline);
  if (violations.length === 0) {
    console.log(`Rollback lint: OK (${files.length} migration(s) scanned)`);
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
