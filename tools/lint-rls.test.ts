import { describe, it, expect } from 'vitest';
import {
  findCreateTables,
  findEnableRls,
  findCreatePolicies,
  lintMigrations,
} from './lint-rls';

describe('RLS lint — parsers', () => {
  it('finds CREATE TABLE with and without IF NOT EXISTS', () => {
    const sql = `
      CREATE TABLE foo (id uuid);
      CREATE TABLE IF NOT EXISTS bar (id uuid);
    `;
    const names = findCreateTables(sql).map((t) => t.name);
    expect(names).toEqual(['foo', 'bar']);
  });

  it('strips schema qualifier and quotes', () => {
    const sql = `CREATE TABLE public.foo (id uuid); CREATE TABLE "BarBaz" (id uuid);`;
    const names = findCreateTables(sql).map((t) => t.name);
    expect(names).toEqual(['foo', 'barbaz']);
  });

  it('ignores CREATE TABLE inside line comments', () => {
    const sql = `-- CREATE TABLE ignored_me ();\nCREATE TABLE real_one (id uuid);`;
    expect(findCreateTables(sql).map((t) => t.name)).toEqual(['real_one']);
  });

  it('ignores CREATE TABLE inside block comments', () => {
    const sql = `/* CREATE TABLE ignored_me (); */ CREATE TABLE real_one (id uuid);`;
    expect(findCreateTables(sql).map((t) => t.name)).toEqual(['real_one']);
  });

  it('finds ENABLE ROW LEVEL SECURITY (case insensitive)', () => {
    const sql = `ALTER TABLE foo ENABLE ROW LEVEL SECURITY; ALTER TABLE bar enable row level security;`;
    expect(findEnableRls(sql)).toEqual(['foo', 'bar']);
  });

  it('finds CREATE POLICY ON <table> (kept available for future strict mode)', () => {
    const sql = `
      CREATE POLICY "anyone reads" ON foo FOR SELECT USING (true);
      CREATE POLICY tenant_isolation ON public.bar FOR ALL USING (church_id = public.get_church_id());
    `;
    expect(findCreatePolicies(sql)).toEqual(['foo', 'bar']);
  });

  it('records the line where CREATE TABLE appears', () => {
    const sql = `\n\nCREATE TABLE foo (id uuid);`;
    expect(findCreateTables(sql)).toEqual([{ name: 'foo', line: 3 }]);
  });
});

describe('RLS lint — analyzer (only ENABLE RLS is required)', () => {
  it('passes when every table has RLS enabled in the same file', () => {
    const v = lintMigrations([
      {
        path: '001.sql',
        content: `
          CREATE TABLE foo (id uuid);
          ALTER TABLE foo ENABLE ROW LEVEL SECURITY;
        `,
      },
    ]);
    expect(v).toEqual([]);
  });

  it('passes when RLS is enabled in a LATER migration', () => {
    const v = lintMigrations([
      { path: '001.sql', content: `CREATE TABLE foo (id uuid);` },
      { path: '005_rls.sql', content: `ALTER TABLE foo ENABLE ROW LEVEL SECURITY;` },
    ]);
    expect(v).toEqual([]);
  });

  it('passes when RLS is enabled with NO policy (service-role-only pattern)', () => {
    // This mirrors migrations 007 / 008 in the real codebase.
    const v = lintMigrations([
      {
        path: '007_anchor_leader_applications.sql',
        content: `
          CREATE TABLE anchor_leader_applications (id uuid);
          ALTER TABLE anchor_leader_applications ENABLE ROW LEVEL SECURITY;
          -- intentionally no policy — service role only
        `,
      },
    ]);
    expect(v).toEqual([]);
  });

  it('flags a table that never enables RLS', () => {
    const v = lintMigrations([
      { path: '099_bad.sql', content: `CREATE TABLE foo (id uuid);` },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].table).toBe('foo');
    expect(v[0].missing).toEqual(['ENABLE ROW LEVEL SECURITY']);
  });

  it('records file + line where the offending table was declared', () => {
    const v = lintMigrations([
      { path: 'supabase/migrations/099_bad.sql', content: `\n\nCREATE TABLE oops (id uuid);` },
    ]);
    expect(v[0]).toMatchObject({
      table: 'oops',
      declaredIn: 'supabase/migrations/099_bad.sql',
      declaredLine: 3,
    });
  });

  it('does NOT flag a table that has only a policy but never enables RLS — the policy is ineffective', () => {
    // Even with a policy, RLS-off means the policy is bypassed.
    // The linter still flags this because the structural fix is to enable RLS.
    const v = lintMigrations([
      {
        path: '001.sql',
        content: `
          CREATE TABLE foo (id uuid);
          CREATE POLICY p ON foo FOR ALL USING (true);
        `,
      },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].missing).toEqual(['ENABLE ROW LEVEL SECURITY']);
  });
});
