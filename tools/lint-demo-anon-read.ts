#!/usr/bin/env tsx
/**
 * Demo anon-read lint — keeps the Faithful demo's public read carve-out from
 * re-exposing real people.
 *
 * Background: migration 053 granted the `anon` role SELECT across 23 tables in
 * the Faithful demo tenant so the public demo URL would render populated CRM
 * screens. Its safety argument was that the tenant holds only fabricated
 * personas. Migration 081 narrowed that carve-out once real pilot participants
 * began signing up into the same tenant, using `people.self_registered` as the
 * discriminator.
 *
 * Rule: in the LATEST migration that defines a `demo_anon_read` policy for a
 * given table, that policy must reference `self_registered` — unless the table
 * is on the NON_PERSON allowlist below, which holds no participant PII.
 *
 * Why the latest definition rather than every definition: these policies are
 * redefined by successive migrations (053 created them, 081 narrowed them).
 * Scanning every occurrence would flag 053 forever, which is history, not a
 * live problem. What matters is the state the migrations add up to.
 *
 * This does NOT verify the predicate is semantically correct, only that the
 * discriminator is present — the same posture as lint-rls.ts checking that RLS
 * is enabled rather than that the policies are right.
 *
 * Usage:
 *   npx tsx tools/lint-demo-anon-read.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/**
 * Tables that describe the church or its staff rather than a participant.
 * Adding a table here is a deliberate assertion that a real pilot participant
 * can never own a row in it. `users` is deliberately NOT here: it carries a
 * nullable person_id.
 */
const NON_PERSON = new Set([
  'households', 'small_groups', 'calendar_events', 'announcements',
  'donation_batches', 'campaigns', 'staff_profiles',
]);

/** Latest migration that defines demo_anon_read per table -> that statement. */
function collectLatest(): Map<string, { file: string; statement: string }> {
  const latest = new Map<string, { file: string; statement: string }>();
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    // Uncommented lines only: rollback blocks are commented out and must not count.
    const live = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
    if (!live.includes('demo_anon_read')) continue;

    // Both spellings in use: a literal `ON public.people`, and the dynamic
    // `format(... ON public.%I ...)` loops driven by a table-name array.
    for (const m of live.matchAll(/CREATE POLICY demo_anon_read ON public\.([A-Za-z_]\w*)/gi)) {
      latest.set(m[1].toLowerCase(), { file, statement: extractStatement(live, m.index ?? 0) });
    }
    for (const m of live.matchAll(/'([a-z_]+)'\s*,\s*'(?:author_)?person_id'/gi)) {
      latest.set(m[1].toLowerCase(), { file, statement: live });
    }
    for (const m of live.matchAll(/demo_tables\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/gi)) {
      for (const t of m[1].matchAll(/'([a-z_]+)'/g)) {
        latest.set(t[1].toLowerCase(), { file, statement: live });
      }
    }
  }
  return latest;
}

function extractStatement(sql: string, from: number): string {
  const end = sql.indexOf(';', from);
  return sql.slice(from, end === -1 ? undefined : end);
}

function main(): void {
  const latest = collectLatest();
  const violations: string[] = [];

  for (const [table, { file, statement }] of latest) {
    if (NON_PERSON.has(table)) continue;
    if (!/self_registered/i.test(statement)) {
      violations.push(
        `  ${table} — demo_anon_read last defined in ${file} without a self_registered guard.\n` +
        `      Either narrow it (see 081) or add the table to NON_PERSON in this file\n` +
        `      with a reason why a pilot participant can never own a row in it.`,
      );
    }
  }

  if (violations.length === 0) {
    console.log(`Demo anon-read lint: OK (${latest.size} table(s) checked)`);
    process.exit(0);
  }
  console.error('Demo anon-read lint FAILED:\n' + violations.join('\n'));
  process.exit(1);
}

main();
