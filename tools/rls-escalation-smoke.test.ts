/**
 * Privilege-escalation smoke test — the empirical proof that migration
 * 056_rls_role_gating_identity.sql actually blocks self-escalation.
 *
 * Runs against a real Supabase project (STAGING) with migration 056
 * applied. Skips automatically when the required env vars are absent, so
 * CI and local dev pass without staging credentials.
 *
 * Required env (mirrors cross-tenant-smoke.test.ts):
 *   SUPABASE_TEST_URL
 *   SUPABASE_TEST_ANON_KEY
 *   SUPABASE_TEST_TENANT_A_ID               # church UUID
 *   SUPABASE_TEST_TENANT_A_TOKEN            # a user WITH admin.manage_roles
 *   SUPABASE_TEST_TENANT_A_MEMBER_TOKEN     # a NON-admin principal (member/low-priv staff)
 *
 * Security properties asserted (deny-by-default):
 *   1. A non-admin cannot escalate — INSERT into user_roles is denied.
 *   2. A non-admin cannot reactivate/relabel accounts — UPDATE users
 *      (role / account_status) affects zero rows.
 *   3. Reads are preserved — a non-admin can still SELECT within its
 *      own church (the direct-read admin app must keep working).
 *   4. Positive control — an admin (manage_roles) can still SELECT
 *      user_roles (the legit management path is not broken).
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const CHURCH = process.env.SUPABASE_TEST_TENANT_A_ID;
const ADMIN_TOK = process.env.SUPABASE_TEST_TENANT_A_TOKEN;
const MEMBER_TOK = process.env.SUPABASE_TEST_TENANT_A_MEMBER_TOKEN;

const HAS_ENV = Boolean(URL && ANON && CHURCH && ADMIN_TOK && MEMBER_TOK);
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

describe('privilege-escalation (staging, migration 056)', () => {
  if (!HAS_ENV) {
    it.skip('skipped — set SUPABASE_TEST_URL / _ANON_KEY / _TENANT_A_ID / _TENANT_A_TOKEN / _TENANT_A_MEMBER_TOKEN (staging, migration 056 applied)', () => {});
  }

  it_('non-admin cannot INSERT user_roles (self-escalation blocked)', async () => {
    const member = client(MEMBER_TOK!);
    // Resolve the system_administrator role id (roles are readable).
    const { data: role } = await member
      .from('roles')
      .select('id')
      .eq('key', 'system_administrator')
      .is('church_id', null)
      .maybeSingle();

    const { data, error } = await member
      .from('user_roles')
      .insert({
        church_id: CHURCH,
        user_id: '00000000-0000-0000-0000-000000000000',
        role_id: role?.id ?? '00000000-0000-0000-0000-000000000000',
      })
      .select();

    // WITH CHECK (requires admin.manage_roles) must reject the write.
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it_('non-admin cannot UPDATE users (role / account_status) — zero rows affected', async () => {
    const member = client(MEMBER_TOK!);
    const { data, error } = await member
      .from('users')
      .update({ account_status: 'active', role: 'admin' })
      .eq('church_id', CHURCH)
      .select();

    // UPDATE USING (requires admin.manage_roles) matches no rows for a
    // non-admin, so PostgREST returns an empty set (no rows mutated).
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it_('reads are preserved — a non-admin can still SELECT its own church users', async () => {
    const member = client(MEMBER_TOK!);
    const { error } = await member.from('users').select('id, church_id').limit(1);
    expect(error).toBeNull(); // read policy unchanged; may be 0+ rows, must not error
  });

  it_('positive control — an admin (manage_roles) can still SELECT user_roles', async () => {
    const admin = client(ADMIN_TOK!);
    const { error } = await admin.from('user_roles').select('id').limit(1);
    expect(error).toBeNull();
  });
});
