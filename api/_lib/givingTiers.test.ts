import { describe, it, expect } from 'vitest';
import { computeGivingTier } from './givingTiers.js';

const TIERS = [
  { label: 'Supporter', weeklyThreshold: 10 },
  { label: 'Champion', weeklyThreshold: 50 },
];

describe('computeGivingTier', () => {
  it('returns null when the church has not configured any tiers', () => {
    expect(computeGivingTier([{ amount: 1000, frequency: 'monthly', status: 'active' }], [])).toBeNull();
  });

  it('normalizes monthly/quarterly/annual gifts to a weekly-equivalent before comparing', () => {
    // $50/month ≈ $11.54/week — qualifies for Supporter ($10) but not Champion ($50)
    const result = computeGivingTier([{ amount: 50, frequency: 'monthly', status: 'active' }], TIERS);
    expect(result?.label).toBe('Supporter');
  });

  it('sums multiple active recurring gifts before picking a tier', () => {
    const result = computeGivingTier(
      [
        { amount: 30, frequency: 'weekly', status: 'active' },
        { amount: 30, frequency: 'weekly', status: 'active' },
      ],
      TIERS,
    );
    expect(result?.label).toBe('Champion');
  });

  it('ignores paused/cancelled gifts', () => {
    const result = computeGivingTier(
      [{ amount: 1000, frequency: 'weekly', status: 'cancelled' }],
      TIERS,
    );
    expect(result).toBeNull();
  });

  it('ignores an unrecognized frequency rather than guessing', () => {
    const result = computeGivingTier(
      [{ amount: 1000, frequency: 'biweekly', status: 'active' }],
      TIERS,
    );
    expect(result).toBeNull();
  });

  it('picks the highest tier the giver qualifies for', () => {
    const result = computeGivingTier([{ amount: 100, frequency: 'weekly', status: 'active' }], TIERS);
    expect(result?.label).toBe('Champion');
  });
});
