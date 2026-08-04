/**
 * GRACE Impact Card — conceptual interchange economics.
 *
 * Modeled, not contracted. The Impact Card program isn't live (no signed
 * sponsor-bank agreement, no BIN sponsorship in place — see api/_lib/i2c,
 * mock adapter only). These constants describe what a defensible split
 * would look like based on published interchange schedules and standard
 * BaaS program-manager economics, so churches can see the shape of the
 * model before it's real instead of a bare "$0, trust us later."
 *
 * Sourcing for each assumption:
 *
 * - GROSS_INTERCHANGE_PCT (1.80%): Visa/Mastercard consumer debit
 *   interchange is Durbin-exempt (uncapped) for issuers under $10B in
 *   assets — i2c's model routes through small/exempt sponsor banks, which
 *   is the entire reason a rebate program is possible at all. Fed 2024
 *   data puts exempt-issuer debit interchange at ~$0.51/transaction
 *   (~1.1% at a ~$46 average debit ticket); published exempt consumer
 *   debit schedules commonly run 1.15%–1.95%+ depending on card-present
 *   status and merchant category. 1.80% is a conservative blended
 *   assumption for everyday-spend categories (grocery, gas, dining), not
 *   GRACE's negotiated rate — no sponsor-bank contract exists yet.
 *
 * - NETWORK_FEE_PCT / ISSUING_BANK_FEE_PCT / PROCESSOR_FEE_PCT: the
 *   pass-through cost stack (card network assessment, sponsor/issuing
 *   bank fee, i2c issuer-processing fee) that every card-issuing program
 *   pays regardless of who the program manager is. Industry commentary on
 *   BaaS program-manager economics (Lithic, Synctera, Galileo) puts the
 *   "standard 70/30" split — ~70% of gross interchange left for the
 *   program manager after the network/bank/processor take their cut —
 *   as a common floor. We model that cut explicitly by line instead of
 *   as one opaque 30% deduction.
 *
 * - FRAUD_RESERVE_PCT: card programs carry real fraud and chargeback
 *   loss, which BaaS marketing pages routinely omit from "you keep 70%"
 *   framing. Modeled as its own line rather than folded into someone
 *   else's fee, on purpose.
 *
 * - CHURCH_SHARE_PCT (1.00%): the target payout to the church, funded
 *   entirely by members' own everyday spending (not the church's money,
 *   not a donation) — set as a round, defensible number rather than
 *   "whatever's left," which is why GRACE's own margin below is thin.
 *
 * GRACE_MARGIN_PCT is a residual (net pool − church share), not an
 * independent assumption — it's what's left after the church's 1% is
 * paid, and it's intentionally thin. The Impact Card isn't meant to be
 * GRACE's profit center; the subscription plans are (see billing/plans).
 * If real sponsor-bank terms land worse than 1.80% gross, CHURCH_SHARE_PCT
 * is the number that should move, not a silent cut into what's disclosed
 * here.
 */

export const IMPACT_CARD_ECONOMICS = {
  grossInterchangePct: 1.80,
  networkFeePct: 0.10,
  issuingBankFeePct: 0.15,
  processorFeePct: 0.20,
  fraudReservePct: 0.10,
  churchSharePct: 1.00,
} as const;

export interface ImpactCardModel {
  grossInterchangePct: number;
  passThroughCostPct: number;
  netPoolPct: number;
  churchSharePct: number;
  graceMarginPct: number;
}

/** Computes the modeled split. Percentages are of card spend volume. */
export function impactCardModel(): ImpactCardModel {
  const e = IMPACT_CARD_ECONOMICS;
  const passThroughCostPct = e.networkFeePct + e.issuingBankFeePct + e.processorFeePct + e.fraudReservePct;
  const netPoolPct = e.grossInterchangePct - passThroughCostPct;
  const graceMarginPct = Math.max(0, netPoolPct - e.churchSharePct);
  return {
    grossInterchangePct: e.grossInterchangePct,
    passThroughCostPct,
    netPoolPct,
    churchSharePct: e.churchSharePct,
    graceMarginPct,
  };
}

/**
 * Illustrative monthly church payout for a given monthly card-spend
 * volume. Not a projection — a worked example so "1%" has a dollar shape.
 */
export function illustrativeMonthlyChurchImpact(monthlyCardSpendUsd: number): number {
  return (Math.max(0, monthlyCardSpendUsd) * IMPACT_CARD_ECONOMICS.churchSharePct) / 100;
}
