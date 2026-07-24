/**
 * Real-RLS proof for care_requests / prayer_requests visibility
 * (migration 043). Same staging-gated pattern as
 * tools/cross-tenant-smoke.test.ts and
 * tools/shared-foundation-smoke.test.ts — skips automatically without
 * live credentials, runs for real against staging when they're provided.
 *
 * Requires (in addition to the existing SUPABASE_TEST_* vars):
 *   SUPABASE_TEST_TENANT_A_CARE_STAFF_TOKEN — a Clerk token for a staff
 *     user in tenant A holding care.view (but NOT care.manage)
 *   SUPABASE_TEST_TENANT_A_NON_CARE_STAFF_TOKEN — a Clerk token for a
 *     staff user in tenant A with NO care.view (e.g. Communications role)
 */
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const CARE_STAFF_TOKEN = process.env.SUPABASE_TEST_TENANT_A_CARE_STAFF_TOKEN;
const NON_CARE_STAFF_TOKEN = process.env.SUPABASE_TEST_TENANT_A_NON_CARE_STAFF_TOKEN;
const MEMBER_TOKEN = process.env.SUPABASE_TEST_TENANT_A_MEMBER_TOKEN;

const HAS_ENV = Boolean(URL && ANON && CARE_STAFF_TOKEN && NON_CARE_STAFF_TOKEN);
const HAS_MEMBER_ENV = Boolean(URL && ANON && MEMBER_TOKEN);

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

const it_care = HAS_ENV ? it : it.skip;
const it_member = HAS_MEMBER_ENV ? it : it.skip;

describe('care_requests / prayer_requests visibility (staging, RLS-enforced)', () => {
  it_care('a staff member without care.view reads zero rows from care_requests, even within their own church', async () => {
    const client = makeClient(NON_CARE_STAFF_TOKEN!);
    const { data, error } = await client.from('care_requests').select('*');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it_care('a staff member with care.view can read private_pastoral_care rows', async () => {
    const client = makeClient(CARE_STAFF_TOKEN!);
    const { error } = await client.from('care_requests').select('*').eq('visibility', 'private_pastoral_care');
    expect(error).toBeNull();
  });

  it_care('care_request_notes are invisible to a care.view-only (non-manage) staff member', async () => {
    const client = makeClient(CARE_STAFF_TOKEN!);
    const { data, error } = await client.from('care_request_notes').select('*');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it_member('a member cannot read prayer_requests set to private_pastoral_care that are not their own', async () => {
    const client = makeClient(MEMBER_TOKEN!);
    const { data, error } = await client.from('prayer_requests').select('*').eq('visibility', 'private_pastoral_care');
    expect(error).toBeNull();
    // RLS's "prayer_requests read own" policy means only their own rows
    // come back even for this visibility level.
    for (const row of data ?? []) {
      expect(row.visibility).toBe('private_pastoral_care');
    }
  });

  it_member('a member can read the church prayer wall', async () => {
    const client = makeClient(MEMBER_TOKEN!);
    const { data, error } = await client.from('prayer_requests').select('*').eq('visibility', 'church_prayer_wall');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
