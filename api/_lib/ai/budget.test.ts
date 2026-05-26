import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  monthStartUtc,
  formatMonth,
  computeStatus,
  checkBudget,
  DEFAULT_MONTHLY_CAP_MICRO_USD,
  DEFAULT_HARD_CUTOFF_MULTIPLIER,
} from './budget';

describe('ai/budget — pure helpers', () => {
  it('monthStartUtc snaps to first day of month at midnight UTC', () => {
    const start = monthStartUtc(new Date('2026-05-25T18:30:00Z'));
    expect(start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('formatMonth produces YYYY-MM', () => {
    expect(formatMonth(new Date('2026-05-25T00:00:00Z'))).toBe('2026-05');
    expect(formatMonth(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });

  it('computeStatus: under cap → ok', () => {
    expect(computeStatus(10, 100, 1.10)).toBe('ok');
  });

  it('computeStatus: at cap → over_cap', () => {
    expect(computeStatus(100, 100, 1.10)).toBe('over_cap');
  });

  it('computeStatus: between cap and hard-cut → over_cap', () => {
    expect(computeStatus(105, 100, 1.10)).toBe('over_cap');
  });

  it('computeStatus: at hard-cut → hard_cut', () => {
    expect(computeStatus(110, 100, 1.10)).toBe('hard_cut');
  });

  it('computeStatus: past hard-cut → hard_cut', () => {
    expect(computeStatus(150, 100, 1.10)).toBe('hard_cut');
  });

  it('computeStatus: zero cap is always hard_cut (safety)', () => {
    expect(computeStatus(0, 0, 1.10)).toBe('hard_cut');
    expect(computeStatus(0, -1, 1.10)).toBe('hard_cut');
  });
});

// ---- DB-layer mocks ----------------------------------------------------

function mockSupabase(opts: {
  budgetRow?: { monthly_cap_micro_usd: number; hard_cutoff_multiplier: number } | null;
  budgetError?: { message: string } | null;
  usageRows?: Array<{ cost_micro_usd: number }>;
}): SupabaseClient {
  const calls = {
    budget: { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() },
    usage: { select: vi.fn(), eq: vi.fn(), gte: vi.fn() },
  };

  const budgetChain = {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.budgetRow ?? null, error: opts.budgetError ?? null }) }) }),
  };
  const usageChain = {
    select: () => ({ eq: () => ({ gte: async () => ({ data: opts.usageRows ?? [], error: null }) }) }),
  };

  return {
    from: (table: string) => (table === 'church_ai_budgets' ? budgetChain : usageChain),
    _calls: calls,
  } as unknown as SupabaseClient;
}

describe('ai/budget — checkBudget', () => {
  it('uses defaults when no row exists for the church', async () => {
    const sb = mockSupabase({ budgetRow: null, usageRows: [{ cost_micro_usd: 100 }] });
    const r = await checkBudget(sb, 'church-1', new Date('2026-05-25T18:30:00Z'));
    expect(r.capMicroUsd).toBe(DEFAULT_MONTHLY_CAP_MICRO_USD);
    expect(r.hardCutMultiplier).toBe(DEFAULT_HARD_CUTOFF_MULTIPLIER);
    expect(r.spentMicroUsd).toBe(100);
    expect(r.status).toBe('ok');
  });

  it('returns status=ok when spent < cap', async () => {
    const sb = mockSupabase({
      budgetRow: { monthly_cap_micro_usd: 1000, hard_cutoff_multiplier: 1.10 },
      usageRows: [{ cost_micro_usd: 100 }, { cost_micro_usd: 200 }],
    });
    const r = await checkBudget(sb, 'church-1');
    expect(r.spentMicroUsd).toBe(300);
    expect(r.status).toBe('ok');
    expect(r.remainingMicroUsd).toBe(700);
    expect(r.hardCutMicroUsd).toBe(1100);
  });

  it('returns status=over_cap when spent ≥ cap and < hard-cut', async () => {
    const sb = mockSupabase({
      budgetRow: { monthly_cap_micro_usd: 1000, hard_cutoff_multiplier: 1.10 },
      usageRows: [{ cost_micro_usd: 1050 }],
    });
    const r = await checkBudget(sb, 'church-1');
    expect(r.status).toBe('over_cap');
    expect(r.remainingMicroUsd).toBe(-50);
  });

  it('returns status=hard_cut when spent ≥ cap × multiplier', async () => {
    const sb = mockSupabase({
      budgetRow: { monthly_cap_micro_usd: 1000, hard_cutoff_multiplier: 1.10 },
      usageRows: [{ cost_micro_usd: 1100 }],
    });
    const r = await checkBudget(sb, 'church-1');
    expect(r.status).toBe('hard_cut');
  });

  it('fails closed (uses defaults) when budget read errors', async () => {
    const sb = mockSupabase({
      budgetError: { message: 'pg down' },
      usageRows: [],
    });
    const r = await checkBudget(sb, 'church-1');
    expect(r.capMicroUsd).toBe(DEFAULT_MONTHLY_CAP_MICRO_USD);
  });

  it('monthStartIso is the first of the current UTC month', async () => {
    const sb = mockSupabase({ budgetRow: null, usageRows: [] });
    const r = await checkBudget(sb, 'church-1', new Date('2026-05-25T18:30:00Z'));
    expect(r.monthStartIso).toBe('2026-05-01T00:00:00.000Z');
  });
});
