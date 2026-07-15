/**
 * Configurable recurring-giving tier/badge computation.
 *
 * No new table — a per-church list of tiers lives in
 * churches.settings.givingTiers (see src/hooks/useChurchSettings.ts).
 * The feature is inert (returns null) until a church configures at
 * least one tier. Pure function — no IO, directly unit-testable.
 */

export interface RecurringGiftRow {
  amount: number;
  frequency: string; // 'weekly' | 'monthly' | 'quarterly' | 'annually' (free-text column, not enforced by a DB constraint)
  status: string;
}

export interface GivingTierDefinition {
  label: string;
  /** Minimum weekly-equivalent giving amount required to reach this tier. */
  weeklyThreshold: number;
}

export interface GivingTierResult {
  label: string;
  weeklyThreshold: number;
}

/** monthly/quarterly/annually normalized to a weekly-equivalent divisor. Unrecognized frequencies are excluded rather than guessed. */
const WEEKLY_DIVISOR: Record<string, number> = {
  weekly: 1,
  monthly: 52 / 12, // ≈4.33
  quarterly: 52 / 4, // 13
  annually: 52,
};

export function computeGivingTier(
  activeRecurringGifts: RecurringGiftRow[],
  tiers: GivingTierDefinition[],
): GivingTierResult | null {
  if (tiers.length === 0) return null;

  const weeklyEquivalentTotal = activeRecurringGifts
    .filter(g => g.status === 'active')
    .reduce((sum, g) => {
      const divisor = WEEKLY_DIVISOR[g.frequency];
      if (!divisor) return sum;
      return sum + g.amount / divisor;
    }, 0);

  const qualifying = tiers
    .filter(t => weeklyEquivalentTotal >= t.weeklyThreshold)
    .sort((a, b) => b.weeklyThreshold - a.weeklyThreshold);

  if (qualifying.length === 0) return null;
  return { label: qualifying[0].label, weeklyThreshold: qualifying[0].weeklyThreshold };
}
