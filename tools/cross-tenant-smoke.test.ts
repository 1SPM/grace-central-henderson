/**
 * Cross-tenant isolation smoke test.
 *
 * Runs against a real Supabase project (staging) once Clerk→Supabase
 * third-party auth is configured (see migration 011_rls_church_scoped.sql
 * preamble for the prerequisite checklist).
 *
 * Skips automatically when the required env vars are absent — so CI and
 * local dev pass without the staging credentials. When the operator
 * runs it pointing at staging:
 *
 *   SUPABASE_TEST_URL=...           # staging project URL
 *   SUPABASE_TEST_TENANT_A_TOKEN=... # Clerk-issued token for a user in tenant A
 *   SUPABASE_TEST_TENANT_B_TOKEN=... # same, tenant B
 *   SUPABASE_TEST_TENANT_A_ID=...    # UUID of tenant A's church row
 *   SUPABASE_TEST_TENANT_B_ID=...    # UUID of tenant B's church row
 *
 * The test asserts that tenant A's token returns ZERO rows from tenant B's
 * data across the core tables, and vice versa. This is the empirical proof
 * that migration 011 actually isolates tenants — the structural lint
 * (tools/lint-rls.ts) only catches RLS-off bugs, not policy-logic bugs.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
const TOK_A = process.env.SUPABASE_TEST_TENANT_A_TOKEN;
const TOK_B = process.env.SUPABASE_TEST_TENANT_B_TOKEN;
const ID_A = process.env.SUPABASE_TEST_TENANT_A_ID;
const ID_B = process.env.SUPABASE_TEST_TENANT_B_ID;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;

const HAS_ENV = Boolean(URL && TOK_A && TOK_B && ID_A && ID_B && ANON);

function makeClient(token: string) {
  return createClient(URL!, ANON!, {
    global: {
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers ?? {});
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('apikey', ANON!);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const it_ = HAS_ENV ? it : it.skip;

describe('cross-tenant isolation (staging)', () => {
  beforeAll(() => {
    if (!HAS_ENV) {
      console.log(
        '[cross-tenant] skipped — set SUPABASE_TEST_URL / _ANON_KEY / ' +
        '_TENANT_A_TOKEN / _TENANT_B_TOKEN / _TENANT_A_ID / _TENANT_B_ID ' +
        'to enable. Required after migration 011 is applied to staging.',
      );
    }
  });

  const tables = [
    'people',
    'tasks',
    'prayer_requests',
    'giving',
    'small_groups',
    'calendar_events',
    'audit_logs',
  ];

  for (const table of tables) {
    it_(`tenant A's token cannot read tenant B's ${table}`, async () => {
      const a = makeClient(TOK_A!);
      const { data, error } = await a.from(table).select('*').eq('church_id', ID_B);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it_(`tenant B's token cannot read tenant A's ${table}`, async () => {
      const b = makeClient(TOK_B!);
      const { data, error } = await b.from(table).select('*').eq('church_id', ID_A);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  }

  it_('tenant A reads only its own people, never tenant B rows', async () => {
    const a = makeClient(TOK_A!);
    const { data, error } = await a.from('people').select('id, church_id');
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.church_id).toBe(ID_A);
    }
  });
});
