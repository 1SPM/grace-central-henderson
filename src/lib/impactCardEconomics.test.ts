import { describe, it, expect } from 'vitest';
import { impactCardModel, illustrativeMonthlyGraceRevenue, IMPACT_CARD_ECONOMICS } from './impactCardEconomics';

describe('impactCardModel', () => {
  it('computes i2c cost as a share of fee revenue, not of total volume', () => {
    const m = impactCardModel();
    expect(m.cardFeePct).toBe(IMPACT_CARD_ECONOMICS.cardFeePct);
    expect(m.i2cCostPct).toBeCloseTo(0.20, 5);
  });

  it('leaves GRACE the majority of the card fee as net revenue', () => {
    const m = impactCardModel();
    expect(m.graceNetRevenuePct).toBeCloseTo(0.80, 5);
    expect(m.graceNetRevenuePct).toBeGreaterThan(0);
  });

  it('never lets the i2c cost exceed the gross card fee', () => {
    const m = impactCardModel();
    expect(m.i2cCostPct).toBeLessThanOrEqual(m.cardFeePct);
  });
});

describe('illustrativeMonthlyGraceRevenue', () => {
  it('computes 1% of monthly card spend as GRACE revenue', () => {
    expect(illustrativeMonthlyGraceRevenue(48_000)).toBeCloseTo(480, 5);
  });

  it('floors negative input at zero', () => {
    expect(illustrativeMonthlyGraceRevenue(-500)).toBe(0);
  });
});
