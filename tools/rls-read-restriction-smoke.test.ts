/**
 * Read-restriction smoke test — proves migration
 * 057_rls_gating_sensitive_serveronly.sql keeps the most sensitive
 * server-only tables (pastoral notes, giving sub-ledgers, inbound
 * message content, household PII, staff profiles) out of reach of an
 * ordinary authenticated principal that lacks the domain permission.
 *
 * Runs against STAGING with migration 057 applied. Skips without env
 * (same harness as cross-tenant-smoke / rls-escalation-smoke).
 *
 * Required env:
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_TENANT_A_ID,
 *   SUPABASE_TEST_TENANT_A_MEMBER_TOKEN   # non-admin / no care|finance perms
 *
 * A permission-gated SELECT returns ZERO rows (RLS filters) for a caller
 * without the permission — never an error, never data.
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const CHURCH = process.env.SUPABASE_TEST_TENANT_A_ID;
const MEMBER_TOK = process.env.SUPABASE_TEST_TENANT_A_MEMBER_TOKEN;

const HAS_ENV = Boolean(URL && ANON && CHURCH && MEMBER_TOK);
const it_ = HAS_ENV ? it : it.skip;

function client(token: string) {
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

const RESTRICTED = [
  'pastoral_sessions',
  'pledges',
  'recurring_giving',
  'donation_batches',
  'batch_items',
  'giving_statements',
  'expenses',
  'gift_in_kind_transactions',
  'inbound_messages',
  'households',
  'household_members',
  'staff_profiles',
];

describe('read-restriction on server-only sensitive tables (staging, migration 057)', () => {
  if (!HAS_ENV) {
    it.skip('skipped — set SUPABASE_TEST_URL / _ANON_KEY / _TENANT_A_ID / _TENANT_A_MEMBER_TOKEN (staging, migration 057 applied)', () => {});
  }

  for (const table of RESTRICTED) {
    it_(`a non-privileged member reads ZERO rows from ${table}`, async () => {
      const member = client(MEMBER_TOK!);
      // Scope to the caller's own church so a pass proves the PERMISSION
      // gate filtered them out — not merely tenant isolation.
      const { data, error } = await member.from(table).select('*').eq('church_id', CHURCH).limit(5);
      expect(error).toBeNull();           // permission-gated read filters, never errors
      expect(data ?? []).toHaveLength(0); // and returns nothing
    });
  }
});
