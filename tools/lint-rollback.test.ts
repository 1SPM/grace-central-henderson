import { describe, it, expect } from 'vitest';
import { hasRollbackMarker, migrationNumber, lintMigrations, ROLLBACK_LINT_BASELINE } from './lint-rollback';

describe('hasRollbackMarker', () => {
  it('recognizes the box-heading style (migrations 056-061)', () => {
    const sql = `select 1;\n-- ══════════════════════════════ ROLLBACK ══════════════════════════════\n-- begin;\n--   drop table foo;\n-- commit;`;
    expect(hasRollbackMarker(sql)).toBe(true);
  });

  it('recognizes the "(per table)" heading variant', () => {
    const sql = `-- ══════════════════════════════ ROLLBACK (per table) ══════════════════════════════`;
    expect(hasRollbackMarker(sql)).toBe(true);
  });

  it('recognizes the plain label style (migrations 063-064)', () => {
    const sql = `-- Rollback: drop the column.`;
    expect(hasRollbackMarker(sql)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(hasRollbackMarker('-- rollback: see above')).toBe(true);
  });

  it('does NOT match "rollback" mentioned mid-sentence — the migration-070 false-positive case', () => {
    const sql = [
      '-- Deliberately NOT wrapped in an exception handler: catching here would',
      '-- swallow the rollback and reintroduce exactly the problem this solves.',
    ].join('\n');
    expect(hasRollbackMarker(sql)).toBe(false);
  });

  it('does NOT match a box-drawing line that is not the rollback heading itself', () => {
    const sql = '-- │ for a 403 / empty-result spike, then roll to prod. Rollback SQL is │';
    expect(hasRollbackMarker(sql)).toBe(false);
  });

  it('returns false when there is no mention at all', () => {
    expect(hasRollbackMarker('create table foo (id uuid);')).toBe(false);
  });
});

describe('migrationNumber', () => {
  it('parses the leading number off a standard filename', () => {
    expect(migrationNumber('072_agent_findings_staff_flag_source.sql')).toBe(72);
    expect(migrationNumber('/abs/path/supabase/migrations/005_row_level_security.sql')).toBe(5);
  });

  it('returns null for legacy filenames with no leading number', () => {
    expect(migrationNumber('neobank_accounts.sql')).toBeNull();
  });
});

describe('lintMigrations', () => {
  const withMarker: import('./lint-rollback').MigrationInput = {
    path: `supabase/migrations/${ROLLBACK_LINT_BASELINE + 1}_has_one.sql`,
    content: '-- Rollback: drop table foo;',
  };
  const withoutMarker: import('./lint-rollback').MigrationInput = {
    path: `supabase/migrations/${ROLLBACK_LINT_BASELINE + 2}_missing_one.sql`,
    content: 'alter table foo add column bar text;',
  };
  const oldWithoutMarker: import('./lint-rollback').MigrationInput = {
    path: `supabase/migrations/${ROLLBACK_LINT_BASELINE - 5}_predates_the_rule.sql`,
    content: 'create table foo (id uuid);',
  };

  it('flags a post-baseline migration with no rollback marker', () => {
    const violations = lintMigrations([withoutMarker], true);
    expect(violations).toEqual([{ path: withoutMarker.path, number: ROLLBACK_LINT_BASELINE + 2 }]);
  });

  it('does not flag a post-baseline migration that documents its rollback', () => {
    expect(lintMigrations([withMarker], true)).toEqual([]);
  });

  it('grandfathers migrations at or below the baseline, even with no marker', () => {
    expect(lintMigrations([oldWithoutMarker], true)).toEqual([]);
  });

  it('ignores the baseline entirely when respectBaseline is false — explicit files always checked', () => {
    const violations = lintMigrations([oldWithoutMarker], false);
    expect(violations).toEqual([{ path: oldWithoutMarker.path, number: ROLLBACK_LINT_BASELINE - 5 }]);
  });

  it('skips files with no parseable migration number regardless of content', () => {
    expect(lintMigrations([{ path: 'neobank_accounts.sql', content: 'create table x (id uuid);' }], true)).toEqual([]);
  });
});
