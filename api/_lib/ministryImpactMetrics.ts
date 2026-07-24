/**
 * Ministry impact metrics: "this fiscal year" vs. "all time".
 *
 * GRACE has no dedicated "people served" event log (no pantry-visit /
 * household-served table), so this must not fabricate a households- or
 * individuals-served number. Follows the honesty convention already
 * established in impactCardFunnelMetrics.ts: any figure with no real
 * backing table is returned as `value: null, source: 'not_yet_computed'`
 * rather than invented.
 *
 * What IS real and computable today: gift-in-kind value/quantity
 * distributed (from gift_in_kind_transactions), and the count of care
 * requests handled (any status, as a rough proxy for "people served
 * through pastoral care"). Pure function — no IO, directly unit-testable.
 */

export interface GiftInKindDistributionRow {
  category: string;
  estimated_value: number | null;
  occurred_at: string; // ISO date
}

export interface CareRequestRow {
  created_at: string; // ISO timestamp
}

export interface MinistryImpactMetricsInput {
  fiscalYearStart: string; // ISO date, inclusive
  asOf: string; // ISO timestamp
  giftInKindDistributions: GiftInKindDistributionRow[];
  careRequests: CareRequestRow[];
}

export interface MinistryImpactStat {
  this_year: number | null;
  all_time: number | null;
  source: string;
  definition: string;
}

export interface MinistryImpactMetrics {
  gift_in_kind_value_distributed: MinistryImpactStat;
  care_requests_handled: MinistryImpactStat;
  households_served: MinistryImpactStat;
  individuals_served: MinistryImpactStat;
  data_freshness: string;
}

export function computeMinistryImpactMetrics(input: MinistryImpactMetricsInput): MinistryImpactMetrics {
  const { fiscalYearStart, asOf } = input;
  const freshness = `Computed at ${asOf} from live database rows (not cached).`;

  const distributionsThisYear = input.giftInKindDistributions.filter(d => d.occurred_at >= fiscalYearStart);
  const giftInKindValueThisYear = distributionsThisYear.reduce((sum, d) => sum + (d.estimated_value ?? 0), 0);
  const giftInKindValueAllTime = input.giftInKindDistributions.reduce((sum, d) => sum + (d.estimated_value ?? 0), 0);

  const careRequestsThisYear = input.careRequests.filter(c => c.created_at >= fiscalYearStart).length;
  const careRequestsAllTime = input.careRequests.length;

  return {
    gift_in_kind_value_distributed: {
      this_year: giftInKindValueThisYear,
      all_time: giftInKindValueAllTime,
      source: 'gift_in_kind_transactions',
      definition: "Estimated fair-market value of donated goods (food/clothing/toys/etc.) distributed, transaction_type='distribution'.",
    },
    care_requests_handled: {
      this_year: careRequestsThisYear,
      all_time: careRequestsAllTime,
      source: 'care_requests',
      definition: 'Number of pastoral care requests submitted, any status — a rough proxy for people reached through pastoral care.',
    },
    households_served: {
      this_year: null,
      all_time: null,
      source: 'not_yet_computed',
      definition: 'Distinct households served by outreach programs (e.g. a food pantry). No source table exists yet — GRACE does not currently log individual service events (e.g. pantry visits) distinct from the gift-in-kind ledger, which tracks quantity/value, not who received it.',
    },
    individuals_served: {
      this_year: null,
      all_time: null,
      source: 'not_yet_computed',
      definition: 'Distinct individuals served by outreach programs. Same gap as households_served — do not display as 0, which would imply a real measurement of no one served.',
    },
    data_freshness: freshness,
  };
}
