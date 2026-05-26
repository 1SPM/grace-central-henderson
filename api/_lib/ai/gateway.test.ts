import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generate } from './gateway';
import { buildUsageRow } from './usage';

/**
 * Simulates Supabase with in-memory mutable state:
 *   - church_ai_budgets holds one row keyed by church_id
 *   - token_usage is an append-only array
 * checkBudget reads both; recordUsage pushes to token_usage.
 *
 * Returned object exposes `.usage` for assertions and `.budget` for
 * mutation between calls.
 */
function makeStatefulSupabase(opts: { cap: number; multiplier: number; usage?: Array<{ cost_micro_usd: number; created_at: string }> }) {
  const state = {
    budget: { monthly_cap_micro_usd: opts.cap, hard_cutoff_multiplier: opts.multiplier },
    usage: [...(opts.usage ?? [])],
  };

  const client = {
    from(table: string) {
      if (table === 'church_ai_budgets') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.budget, error: null }),
            }),
          }),
        };
      }
      if (table === 'token_usage') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({
                data: state.usage,
                error: null,
              }),
            }),
          }),
          insert: async (row: { cost_micro_usd: number }) => {
            state.usage.push({ cost_micro_usd: row.cost_micro_usd, created_at: new Date().toISOString() });
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

describe('ai/gateway — happy path', () => {
  it('calls the provider and records usage when budget allows', async () => {
    const { client, state } = makeStatefulSupabase({ cap: 100_000_000, multiplier: 1.10 });

    const callProvider = vi.fn().mockResolvedValue({
      success: true,
      text: 'hi',
      promptTokens: 1000,
      completionTokens: 500,
    });

    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    }, callProvider);

    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.provider.success).toBe(true);
      expect(r.provider.text).toBe('hi');
    }
    expect(callProvider).toHaveBeenCalledTimes(1);

    // Wait for the fire-and-forget usage write
    await new Promise((res) => setImmediate(res));
    expect(state.usage).toHaveLength(1);
    expect(state.usage[0].cost_micro_usd).toBe(225); // see pricing.test.ts
  });

  it('catches provider exceptions and records them as a failed call', async () => {
    const { client, state } = makeStatefulSupabase({ cap: 100_000_000, multiplier: 1.10 });
    const callProvider = vi.fn().mockRejectedValue(new Error('upstream 500'));
    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    }, callProvider);
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.provider.success).toBe(false);
      expect(r.provider.errorCode).toBe('provider_exception');
    }
    await new Promise((res) => setImmediate(res));
    expect(state.usage).toHaveLength(1);
  });
});

describe('ai/gateway — budget refusals', () => {
  it('refuses with over_cap and never calls provider when at cap', async () => {
    const { client } = makeStatefulSupabase({
      cap: 1000,
      multiplier: 1.10,
      usage: [{ cost_micro_usd: 1000, created_at: '2026-05-15T00:00:00Z' }],
    });
    const callProvider = vi.fn();
    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    }, callProvider);
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toBe('over_cap');
      expect(r.budget.spentMicroUsd).toBe(1000);
    }
    expect(callProvider).not.toHaveBeenCalled();
  });

  it('refuses with hard_cut when past cap × multiplier', async () => {
    const { client } = makeStatefulSupabase({
      cap: 1000,
      multiplier: 1.10,
      usage: [{ cost_micro_usd: 1200, created_at: '2026-05-15T00:00:00Z' }],
    });
    const callProvider = vi.fn();
    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    }, callProvider);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('hard_cut');
    expect(callProvider).not.toHaveBeenCalled();
  });
});

// ============================================
// SYNTHETIC BURN TEST — Sprint 2 exit gate
// ============================================
//
// "Synthetic burn test triggers cutoff at $0.01 over budget."
//
// Simulates a tenant making repeated calls until the gateway refuses.
// Asserts that:
//   - The cutoff fires BEFORE the tenant exceeds (cap + meaningful epsilon)
//   - Once cut, subsequent calls are refused (never call the provider)
//   - Hard-cut transition happens at cap × multiplier
describe('ai/gateway — synthetic burn test (Sprint 2 gate)', () => {
  it('cuts off the loop within $0.01 of the cap (over_cap), and the provider stops being called', async () => {
    const CAP = 1_000_000;             // $1
    const MULTIPLIER = 1.10;
    const { client } = makeStatefulSupabase({ cap: CAP, multiplier: MULTIPLIER });

    // Provider call costs ~225 micro-USD (~Gemini Flash 1k+500 tokens).
    const callProvider = vi.fn().mockResolvedValue({
      success: true,
      promptTokens: 1000,
      completionTokens: 500,
    });

    let refusedAt = -1;
    let refusedStatus: string | null = null;

    for (let i = 0; i < 100_000; i++) {
      const r = await generate({
        supabase: client,
        churchId: 'c-1',
        feature: 'burn-test',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
      }, callProvider);
      // Drain the fire-and-forget usage write so the next iteration sees it
      await new Promise((res) => setImmediate(res));
      if (!r.allowed) {
        refusedAt = i;
        refusedStatus = r.reason;
        break;
      }
    }

    expect(refusedAt).toBeGreaterThan(0);
    expect(refusedAt).toBeLessThan(10_000);   // sanity: we hit the cap quickly with $1 budget
    expect(refusedStatus).toBe('over_cap');

    // Verify the provider was called exactly `refusedAt` times — no extra calls slipped past the gate
    expect(callProvider).toHaveBeenCalledTimes(refusedAt);

    // Subsequent calls remain refused
    const after = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'burn-test',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    }, callProvider);
    expect(after.allowed).toBe(false);
    expect(callProvider).toHaveBeenCalledTimes(refusedAt);  // still no new call
  });

  it('escalates from over_cap to hard_cut once cap × multiplier crossed', async () => {
    const CAP = 1000;
    const MULTIPLIER = 1.10;            // hard cut at 1100
    const { client } = makeStatefulSupabase({
      cap: CAP,
      multiplier: MULTIPLIER,
      usage: [{ cost_micro_usd: 1099, created_at: '2026-05-15T00:00:00Z' }],
    });

    // Each call adds 225 micro — first call inserts 1099+225=1324 > 1100
    const callProvider = vi.fn();
    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'burn-test',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    }, callProvider);

    // Current spent is 1099 (over cap, not yet hard cut), so this call is refused as over_cap.
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('over_cap');

    // Inject a hard-cut-level spend and re-check
    const { client: client2 } = makeStatefulSupabase({
      cap: CAP,
      multiplier: MULTIPLIER,
      usage: [{ cost_micro_usd: 1100, created_at: '2026-05-15T00:00:00Z' }],
    });
    const r2 = await generate({
      supabase: client2,
      churchId: 'c-1',
      feature: 'burn-test',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    }, callProvider);
    expect(r2.allowed).toBe(false);
    if (!r2.allowed) expect(r2.reason).toBe('hard_cut');
  });
});

describe('ai/gateway — moderation', () => {
  function notFlagged() {
    return Promise.resolve({ flagged: false, skipped: false, flaggedCategories: [], raw: null });
  }
  function flagged(categories: string[]) {
    return Promise.resolve({ flagged: true, skipped: false, flaggedCategories: categories, raw: null });
  }

  it('refuses input moderation flag without calling provider', async () => {
    const { client, state } = makeStatefulSupabase({ cap: 100_000_000, multiplier: 1.10 });
    const callProvider = vi.fn();

    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      moderateInput: 'evil prompt',
      moderateImpl: () => flagged(['hate']),
    }, callProvider);

    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toBe('moderation_input');
      if ('moderation' in r) {
        expect(r.moderation.flaggedCategories).toEqual(['hate']);
      }
    }
    expect(callProvider).not.toHaveBeenCalled();
    await new Promise((res) => setImmediate(res));
    expect(state.usage).toHaveLength(1);
    // usage row records the moderation block as a zero-cost failure
    expect(state.usage[0].cost_micro_usd).toBe(0);
  });

  it('proceeds past input moderation when clean', async () => {
    const { client } = makeStatefulSupabase({ cap: 100_000_000, multiplier: 1.10 });
    const callProvider = vi.fn().mockResolvedValue({ success: true, text: 'hi', promptTokens: 100, completionTokens: 50 });

    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      moderateInput: 'clean prompt',
      moderateImpl: notFlagged,
    }, callProvider);

    expect(r.allowed).toBe(true);
    expect(callProvider).toHaveBeenCalledTimes(1);
  });

  it('blocks output when output moderation flags', async () => {
    const { client, state } = makeStatefulSupabase({ cap: 100_000_000, multiplier: 1.10 });
    const callProvider = vi.fn().mockResolvedValue({
      success: true,
      text: 'harmful output',
      promptTokens: 100,
      completionTokens: 50,
    });

    let calls = 0;
    const moderateImpl = () => {
      calls++;
      // First call is input (clean), second is output (flagged)
      return calls === 1
        ? notFlagged()
        : flagged(['violence']);
    };

    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      moderateInput: 'fine prompt',
      moderateOutput: true,
      moderateImpl,
    }, callProvider);

    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.provider.success).toBe(false);
      expect(r.provider.errorCode).toBe('moderation_output');
      expect(r.provider.text).toBeUndefined();
    }
    // Still records token usage — we paid the provider for those tokens
    await new Promise((res) => setImmediate(res));
    expect(state.usage).toHaveLength(1);
    expect(state.usage[0].cost_micro_usd).toBeGreaterThan(0);
  });

  it('does not run moderation when not requested (default off)', async () => {
    const { client } = makeStatefulSupabase({ cap: 100_000_000, multiplier: 1.10 });
    const callProvider = vi.fn().mockResolvedValue({ success: true, text: 'hi', promptTokens: 100, completionTokens: 50 });
    const moderateImpl = vi.fn();

    await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      moderateImpl,
    }, callProvider);

    expect(moderateImpl).not.toHaveBeenCalled();
  });

  it('skipped moderation (no key) does not block', async () => {
    const { client } = makeStatefulSupabase({ cap: 100_000_000, multiplier: 1.10 });
    const callProvider = vi.fn().mockResolvedValue({ success: true, text: 'hi', promptTokens: 100, completionTokens: 50 });

    const r = await generate({
      supabase: client,
      churchId: 'c-1',
      feature: 'ask-grace',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      moderateInput: 'anything',
      moderateImpl: () => Promise.resolve({ flagged: false, skipped: true, skipReason: 'no_api_key', flaggedCategories: [], raw: null }),
    }, callProvider);

    expect(r.allowed).toBe(true);
    expect(callProvider).toHaveBeenCalled();
  });
});

describe('ai/usage — buildUsageRow', () => {
  it('computes cost via the pricing table by default', () => {
    const row = buildUsageRow({
      churchId: 'c-1',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      feature: 'ask-grace',
      promptTokens: 1000,
      completionTokens: 500,
      success: true,
    });
    expect(row.cost_micro_usd).toBe(225);
    expect(row.error_code).toBeNull();
  });

  it('honors costMicroUsdOverride', () => {
    const row = buildUsageRow({
      churchId: 'c-1',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      feature: 'ask-grace',
      promptTokens: 1000,
      completionTokens: 500,
      success: true,
      costMicroUsdOverride: 0,
    });
    expect(row.cost_micro_usd).toBe(0);
  });

  it('records error code on failure', () => {
    const row = buildUsageRow({
      churchId: 'c-1',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      feature: 'ask-grace',
      promptTokens: 0,
      completionTokens: 0,
      success: false,
      errorCode: 'quota_exceeded',
    });
    expect(row.success).toBe(false);
    expect(row.error_code).toBe('quota_exceeded');
  });
});
