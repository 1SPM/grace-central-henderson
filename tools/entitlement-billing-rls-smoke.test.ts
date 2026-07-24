/**
 * Entitlement / balance RLS negative smoke tests.
 *
 * The last two negative scenarios from the payment audit are RLS
 * properties — a signed-in user hitting Supabase directly (bypassing the
 * server routes) must NOT be able to:
 *   - change their church's entitlement (churches.subscription_*), or
 *   - increase a token / card balance (token_usage, card_accounts, ledger).
 *
 * These tables carry SELECT-only policies today (verified 2026-07-23), so
 * every direct write must fail or affect zero rows. Runs against a real
 * Supabase project; skips automatically without the env below (so CI/local
 * pass without credentials). Mirrors tools/rls-escalation-smoke.test.ts.
 *
 * Required env:
 *   SUPABASE_TEST_URL
 *   SUPABASE_TEST_ANON_KEY
 *   SUPABASE_TEST_TENANT_A_ID            # church UUID
 *   SUPABASE_TEST_TENANT_A_MEMBER_TOKEN  # any signed-in NON-privileged user
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

describe('entitlement / balance direct-write is denied by RLS', () => {
  if (!HAS_ENV) {
    it.skip('skipped — set SUPABASE_TEST_URL / _ANON_KEY / _TENANT_A_ID / _TENANT_A_MEMBER_TOKEN', () => {});
  }

  // ── User directly updating their entitlement ───────────────────────
  it_('a member cannot upgrade their own church entitlement (churches.subscription_*)', async () => {
    const member = client(MEMBER_TOK!);
    const { data, error } = await member
      .from('churches')
      .update({ subscription_plan: 'enterprise', subscription_status: 'active' })
      .eq('id', CHURCH)
      .select();
    // No UPDATE policy on churches → zero rows mutated (PostgREST returns []).
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // ── User directly changing their token balance ─────────────────────
  it_('a member cannot INSERT a token_usage row (fabricate/inflate credit)', async () => {
    const member = client(MEMBER_TOK!);
    const { data, error } = await member
      .from('token_usage')
      .insert({ church_id: CHURCH, provider: 'audit', model: 'audit-negative-test', feature: 'audit', total_tokens: 1_000_000, cost_micro_usd: 0 })
      .select();
    // SELECT-only table → WITH CHECK has no INSERT policy → denied.
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it_('a member cannot UPDATE a card_accounts balance', async () => {
    const member = client(MEMBER_TOK!);
    const { data, error } = await member
      .from('card_accounts')
      .update({ available_balance_micro_usd: 999_000_000 })
      .eq('church_id', CHURCH)
      .select();
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // no UPDATE policy → zero rows
  });

  it_('a member cannot INSERT a ledger_entries row (forge a credit)', async () => {
    const member = client(MEMBER_TOK!);
    const { data, error } = await member
      .from('ledger_entries')
      .insert({
        church_id: CHURCH, source: 'manual', source_event_id: `audit-neg-${Date.now()}`,
        kind: 'donation', direction: 'credit', amount_micro_usd: 5_000_000, currency: 'USD',
        occurred_at: new Date().toISOString(),
      })
      .select();
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // ── Positive control: reads still work ─────────────────────────────
  it_('a member CAN still read their own church row (read policy intact)', async () => {
    const member = client(MEMBER_TOK!);
    const { error } = await member.from('churches').select('id, subscription_plan').eq('id', CHURCH).limit(1);
    expect(error).toBeNull();
  });
});
