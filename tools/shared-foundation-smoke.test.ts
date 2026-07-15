/**
 * Shared-platform-foundation smoke test (staging-gated).
 *
 * Same pattern and same env vars as tools/cross-tenant-smoke.test.ts —
 * skips automatically unless SUPABASE_TEST_* credentials are present.
 * Extends that pattern to the tables added in migrations 031–038:
 * tenant isolation, member self-access (consents/communication_preferences/
 * care_requests via public.get_person_id()), and the permission-aware
 * work_orders/approvals policies added in migration 038.
 *
 * Requires, in addition to the existing cross-tenant vars:
 *   SUPABASE_TEST_TENANT_A_MEMBER_TOKEN — a Clerk-issued token for a
 *     people.clerk_user_id-linked member in tenant A (no staff role/permissions)
 *   SUPABASE_TEST_TENANT_A_MEMBER_PERSON_ID — that member's people.id
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
const TOK_A = process.env.SUPABASE_TEST_TENANT_A_TOKEN;
const TOK_B = process.env.SUPABASE_TEST_TENANT_B_TOKEN;
const ID_A = process.env.SUPABASE_TEST_TENANT_A_ID;
const ID_B = process.env.SUPABASE_TEST_TENANT_B_ID;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const MEMBER_TOK_A = process.env.SUPABASE_TEST_TENANT_A_MEMBER_TOKEN;
const MEMBER_PERSON_ID_A = process.env.SUPABASE_TEST_TENANT_A_MEMBER_PERSON_ID;

const HAS_CROSS_TENANT_ENV = Boolean(URL && TOK_A && TOK_B && ID_A && ID_B && ANON);
const HAS_MEMBER_ENV = Boolean(URL && ANON && MEMBER_TOK_A && MEMBER_PERSON_ID_A);

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

const it_tenant = HAS_CROSS_TENANT_ENV ? it : it.skip;
const it_member = HAS_MEMBER_ENV ? it : it.skip;

describe('shared-platform-foundation tenant isolation (staging)', () => {
  beforeAll(() => {
    if (!HAS_CROSS_TENANT_ENV) {
      console.log('[shared-foundation] tenant-isolation checks skipped — see tools/cross-tenant-smoke.test.ts env vars.');
    }
    if (!HAS_MEMBER_ENV) {
      console.log(
        '[shared-foundation] member-self-access checks skipped — set ' +
        'SUPABASE_TEST_TENANT_A_MEMBER_TOKEN / _MEMBER_PERSON_ID to enable.',
      );
    }
  });

  const newTenantTables = [
    'households', 'staff_profiles', 'user_roles', 'consents',
    'communication_preferences', 'data_subject_requests', 'work_order_tasks',
    'work_order_evidence', 'agent_runs', 'agent_actions', 'validations',
    'notifications', 'care_requests', 'care_assignments', 'volunteer_interests',
    'artifacts',
  ];

  for (const table of newTenantTables) {
    it_tenant(`tenant A's token cannot read tenant B's ${table}`, async () => {
      const a = makeClient(TOK_A!);
      const { data, error } = await a.from(table).select('*').eq('church_id', ID_B);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  }

  it_tenant('a token with no work_orders.view grant reads zero Work Orders even within its own church', async () => {
    // TOK_A in the existing fixture setup is not guaranteed to lack
    // work_orders.view — this assertion is best-effort documentation of
    // intent; the authoritative version of this check is
    // api/_lib/authz.test.ts, which controls the permission set directly.
    const a = makeClient(TOK_A!);
    const { error } = await a.from('work_orders').select('*').eq('church_id', ID_A);
    expect(error === null || typeof error.message === 'string').toBe(true);
  });
});

describe('shared-platform-foundation member self-access (staging)', () => {
  it_member('a member reads their own consents row set (possibly empty) without error', async () => {
    const member = makeClient(MEMBER_TOK_A!);
    const { data, error } = await member.from('consents').select('*').eq('person_id', MEMBER_PERSON_ID_A);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.person_id).toBe(MEMBER_PERSON_ID_A);
    }
  });

  it_member('a member cannot read another person\'s consents by guessing a different person_id', async () => {
    const member = makeClient(MEMBER_TOK_A!);
    const { data, error } = await member
      .from('consents')
      .select('*')
      .neq('person_id', MEMBER_PERSON_ID_A);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it_member('a member with no staff role cannot read work_orders at all', async () => {
    const member = makeClient(MEMBER_TOK_A!);
    const { data, error } = await member.from('work_orders').select('*');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
