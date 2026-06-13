/**
 * Neo-banking account helpers — card_accounts, transfers, impact routes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { I2cAdapter } from '../i2c/types.js';

type Db = SupabaseClient;

export async function ensureCardAccount(
  supabase: Db,
  churchId: string,
  personId: string,
  accountName: string,
  adapter: I2cAdapter,
) {
  const { data: existing } = await supabase
    .from('card_accounts')
    .select('*')
    .eq('church_id', churchId)
    .eq('person_id', personId)
    .maybeSingle();

  if (existing) return existing;

  const i2cAccountId = `mock_acct_${personId.slice(0, 8)}_${churchId.slice(0, 8)}`;
  const deposit = await adapter.getDepositInstructions({
    i2cAccountId,
    churchId,
    accountName,
  });
  const balance = await adapter.getBalance({ i2cAccountId, churchId });

  const { data: account, error } = await supabase
    .from('card_accounts')
    .insert({
      church_id: churchId,
      person_id: personId,
      i2c_account_id: i2cAccountId,
      account_name: deposit.accountName,
      account_number_last4: deposit.accountNumberLast4,
      routing_number: deposit.routingNumber,
      available_balance_micro_usd: balance.availableBalanceMicroUsd,
      status: 'active',
      last_synced_at: new Date().toISOString(),
      metadata: { adapter_mode: adapter.mode },
    })
    .select()
    .single();

  if (error) throw error;
  return account;
}

export async function syncAccountBalance(
  supabase: Db,
  account: { id: string; i2c_account_id: string; church_id: string },
  adapter: I2cAdapter,
) {
  const balance = await adapter.getBalance({
    i2cAccountId: account.i2c_account_id,
    churchId: account.church_id,
  });
  const { data: updated } = await supabase
    .from('card_accounts')
    .update({
      available_balance_micro_usd: balance.availableBalanceMicroUsd,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', account.id)
    .select()
    .single();
  return updated;
}

export async function loadAdminAccountData(supabase: Db, churchId: string) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const periodMonth = monthStart.toISOString().slice(0, 10);

  const [{ data: accounts }, { data: transfers }, { data: routes }, { data: allocations }] = await Promise.all([
    supabase.from('card_accounts').select('*').eq('church_id', churchId).limit(500),
    supabase
      .from('card_transfers')
      .select('*')
      .eq('church_id', churchId)
      .order('initiated_at', { ascending: false })
      .limit(500),
    supabase.from('impact_routes').select('*').eq('church_id', churchId).limit(500),
    supabase
      .from('impact_allocations')
      .select('*')
      .eq('church_id', churchId)
      .eq('period_month', periodMonth)
      .limit(500),
  ]);

  return {
    accounts: accounts ?? [],
    transfers: transfers ?? [],
    impact_routes: routes ?? [],
    impact_allocations: allocations ?? [],
  };
}

export function computeMemberImpactMtd(
  personId: string,
  cardIds: Set<string>,
  events: { card_id: string | null; event_type: string; direction: string; amount_micro_usd: number }[],
  allocations: { person_id: string; amount_micro_usd: number }[],
): number {
  const fromFees = events
    .filter(e => e.event_type === 'fee' && e.direction === 'credit' && e.card_id && cardIds.has(e.card_id))
    .reduce((sum, e) => sum + Number(e.amount_micro_usd), 0);
  if (fromFees > 0) return fromFees;
  const alloc = allocations.find(a => a.person_id === personId);
  return alloc ? Number(alloc.amount_micro_usd) : 0;
}
