import { describe, it, expect } from 'vitest';
import { impactCardModel, illustrativeMonthlyChurchImpact, IMPACT_CARD_ECONOMICS } from './impactCardEconomics';

describe('impactCardModel', () => {
  it('nets a positive pool after pass-through costs, before the church share', () => {
    const m = impactCardModel();
    expect(m.passThroughCostPct).toBeCloseTo(0.55, 5);
    expect(m.netPoolPct).toBeCloseTo(1.25, 5);
  });

  it('leaves GRACE a thin but non-negative margin after the church share', () => {
    const m = impactCardModel();
    expect(m.churchSharePct).toBe(IMPACT_CARD_ECONOMICS.churchSharePct);
    expect(m.graceMarginPct).toBeCloseTo(0.25, 5);
    expect(m.graceMarginPct).toBeGreaterThanOrEqual(0);
  });

  it('never lets the church share exceed the net pool, even if assumptions change', () => {
    const m = impactCardModel();
    expect(m.churchSharePct).toBeLessThanOrEqual(m.netPoolPct);
  });
});

describe('illustrativeMonthlyChurchImpact', () => {
  it('computes 1% of monthly card spend', () => {
    expect(illustrativeMonthlyChurchImpact(48_000)).toBeCloseTo(480, 5);
  });

  it('floors negative input at zero', () => {
    expect(illustrativeMonthlyChurchImpact(-500)).toBe(0);
  });
});
