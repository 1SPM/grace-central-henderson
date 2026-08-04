/**
 * GRACE Impact Card — revenue model.
 *
 * The Impact Card is GRACE's primary revenue engine, not a rebate
 * program for the church. This mirrors the company's own planning
 * documents (VR CHURCH/i2c Proposal Letter; i2cinc Faith Organizations
 * Use Cases and Projections pro forma) rather than external interchange
 * benchmarks — an earlier version of this file modeled a share of
 * interchange flowing back to the church, which contradicted that
 * planning and was corrected.
 *
 * The documented model, translated to constants:
 *
 * - CARD_FEE_PCT (1.00%): "Credit/Debit Card Transaction Fees (1% avg)
 *   — Based on average transaction fee per member's monthly spending via
 *   church-issued cards." GRACE charges this on member card spend; it
 *   is GRACE's revenue, collected the way a payments company collects
 *   a take rate, not money the church receives.
 *
 * - I2C_COST_SHARE_OF_REVENUE (20%): "Platform & Transaction Processing
 *   Fees — i2c service fees, estimated at 20% of total revenue." i2c is
 *   modeled as a processing cost GRACE pays out of card-fee revenue,
 *   not a partner splitting interchange with the church.
 *
 * There is no church-side revenue-share line in the source planning —
 * the documented "financial incentive for the church" is non-monetary:
 * donor engagement, community growth, enhanced tax-exempt standing, and
 * (indirectly) a subscription price GRACE can hold down because the
 * card program carries part of the company's costs. Nothing here should
 * be presented to a church as money they receive.
 */

export const IMPACT_CARD_ECONOMICS = {
  /** GRACE's take rate on member card spend, per the documented pro forma. */
  cardFeePct: 1.00,
  /** i2c's processing cost as a share of that fee revenue (not of total volume). */
  i2cCostShareOfRevenue: 0.20,
} as const;

export interface ImpactCardModel {
  cardFeePct: number;
  i2cCostPct: number;
  graceNetRevenuePct: number;
}

/** Computes the modeled split, as a percentage of card spend volume. */
export function impactCardModel(): ImpactCardModel {
  const e = IMPACT_CARD_ECONOMICS;
  const i2cCostPct = e.cardFeePct * e.i2cCostShareOfRevenue;
  const graceNetRevenuePct = e.cardFeePct - i2cCostPct;
  return {
    cardFeePct: e.cardFeePct,
    i2cCostPct,
    graceNetRevenuePct,
  };
}

/**
 * Illustrative monthly GRACE revenue for a given monthly card-spend
 * volume. Not a projection — a worked example, and explicitly GRACE's
 * revenue, not the church's.
 */
export function illustrativeMonthlyGraceRevenue(monthlyCardSpendUsd: number): number {
  return (Math.max(0, monthlyCardSpendUsd) * IMPACT_CARD_ECONOMICS.cardFeePct) / 100;
}
