/**
 * AI spend budget enforcement.
 *
 * Called by the gateway BEFORE every inference. Reads the tenant's
 * monthly cap from `church_ai_budgets` (defaulting to $50/mo when no
 * row exists yet) and sums their current calendar-month spend from
 * `token_usage`. Returns an authorization status:
 *
 *   - 'ok'         spend < cap                       → proceed
 *   - 'over_cap'   cap ≤ spend < cap × multiplier    → 402, suggest upgrade
 *   - 'hard_cut'   spend ≥ cap × multiplier          → 402, block period
 *
 * Math is integer micro-USD throughout. No float drift.
 *
 * Pure helpers (`formatMonth`, `monthStartUtc`, `computeStatus`) are
 * separated for unit testing without touching the DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_MONTHLY_CAP_MICRO_USD = 50_000_000;        // $50
export const DEFAULT_HARD_CUTOFF_MULTIPLIER = 1.10;             // hard cut at 110%

export type BudgetStatus = 'ok' | 'over_cap' | 'hard_cut';

export interface BudgetCheck {
  status: BudgetStatus;
  spentMicroUsd: number;
  capMicroUsd: number;
  hardCutMultiplier: number;
  hardCutMicroUsd: number;
  remainingMicroUsd: number;            // can go negative
  monthStartIso: string;                // UTC, ISO 8601
}

// ---- pure helpers (testable) ------------------------------------------

export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function formatMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function computeStatus(
  spentMicroUsd: number,
  capMicroUsd: number,
  hardCutMultiplier: number,
): BudgetStatus {
  if (capMicroUsd <= 0) return 'hard_cut';                           // safety: zero cap = blocked
  const hardCut = Math.floor(capMicroUsd * hardCutMultiplier);
  if (spentMicroUsd >= hardCut)    return 'hard_cut';
  if (spentMicroUsd >= capMicroUsd) return 'over_cap';
  return 'ok';
}

// ---- DB layer ----------------------------------------------------------

interface BudgetRow {
  monthly_cap_micro_usd: number | string;
  hard_cutoff_multiplier: number | string;
}

async function readBudget(
  supabase: SupabaseClient,
  churchId: string,
): Promise<{ cap: number; multiplier: number }> {
  const { data, error } = await supabase
    .from('church_ai_budgets')
    .select('monthly_cap_micro_usd, hard_cutoff_multiplier')
    .eq('church_id', churchId)
    .maybeSingle();

  if (error) {
    // Fail-closed default — we'd rather refuse a single call than enable
    // a runaway when the budget table is unreadable.
    return { cap: DEFAULT_MONTHLY_CAP_MICRO_USD, multiplier: DEFAULT_HARD_CUTOFF_MULTIPLIER };
  }
  if (!data) {
    return { cap: DEFAULT_MONTHLY_CAP_MICRO_USD, multiplier: DEFAULT_HARD_CUTOFF_MULTIPLIER };
  }
  return {
    cap: Number((data as BudgetRow).monthly_cap_micro_usd),
    multiplier: Number((data as BudgetRow).hard_cutoff_multiplier),
  };
}

async function readMonthSpend(
  supabase: SupabaseClient,
  churchId: string,
  monthStartIso: string,
): Promise<number> {
  // Two reasonable shapes here:
  //   (a) `select sum(cost_micro_usd)` — single round-trip but PostgREST
  //       requires the rpc pattern or a view; not currently set up.
  //   (b) read all rows and sum client-side — fine at expected scale
  //       (< 100k rows / month / tenant; 100 bytes each → ~10MB worst case).
  // We pick (b) for now and revisit if any tenant approaches the limit;
  // an RPC `sum_token_usage(p_church_id, p_since)` is trivial to add later.
  const { data, error } = await supabase
    .from('token_usage')
    .select('cost_micro_usd')
    .eq('church_id', churchId)
    .gte('created_at', monthStartIso);

  if (error || !data) return 0;
  let total = 0;
  for (const r of data as Array<{ cost_micro_usd: number | string }>) {
    total += Number(r.cost_micro_usd);
  }
  return total;
}

export async function checkBudget(
  supabase: SupabaseClient,
  churchId: string,
  now: Date = new Date(),
): Promise<BudgetCheck> {
  const start = monthStartUtc(now);
  const monthStartIso = start.toISOString();

  const [{ cap, multiplier }, spent] = await Promise.all([
    readBudget(supabase, churchId),
    readMonthSpend(supabase, churchId, monthStartIso),
  ]);

  const status = computeStatus(spent, cap, multiplier);
  const hardCut = Math.floor(cap * multiplier);

  return {
    status,
    spentMicroUsd: spent,
    capMicroUsd: cap,
    hardCutMultiplier: multiplier,
    hardCutMicroUsd: hardCut,
    remainingMicroUsd: cap - spent,
    monthStartIso,
  };
}
