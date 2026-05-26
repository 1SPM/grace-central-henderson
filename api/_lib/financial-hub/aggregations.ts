/**
 * Financial Hub aggregations.
 *
 * Pure functions operating on raw ledger_entries rows. The API
 * endpoints in api/financial-hub/* fetch rows from Supabase then
 * call these. No IO here — everything is testable in-process.
 *
 * Money convention: ledger amounts are micro-USD integers (per
 * migration 013). Aggregations stay in micro-USD; the API layer
 * converts to dollars at the boundary using microUsdToUsd from
 * api/_lib/ai/pricing.ts.
 *
 * Date convention: all dates are UTC YYYY-MM-DD strings derived
 * from occurred_at. We do NOT do per-tenant timezone conversion at
 * this layer; that's a UI concern. A church in California viewing
 * their dashboard at 11pm Pacific will see donations from 11pm-12am
 * grouped into "tomorrow" UTC. Acceptable for an MVP demo; flagged
 * as TD-035 if it becomes a complaint.
 */

export type LedgerSource = 'stripe' | 'i2c' | 'manual' | 'reconciliation';
export type LedgerKind = 'donation' | 'refund' | 'fee' | 'payout' | 'transfer' | 'adjustment' | 'correction';
export type LedgerDirection = 'credit' | 'debit';

export interface LedgerRow {
  id?: string;
  church_id?: string;
  source: LedgerSource;
  kind: LedgerKind;
  direction: LedgerDirection;
  amount_micro_usd: number;
  occurred_at: string;                   // ISO 8601
  related_person_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ============================================
// SUMMARY — totals for the window
// ============================================

export interface SummaryTotals {
  /** Sum of credits minus refunds and fees; "what the church actually received". */
  netMicroUsd: number;
  /** Raw credit total (donations + recurring) before deductions. */
  grossMicroUsd: number;
  /** Refunds applied in the window. */
  refundMicroUsd: number;
  /** Processor fees in the window. */
  feeMicroUsd: number;
  /** Count of credit entries (gifts received). */
  donationCount: number;
  /** Distinct people who gave at least once. */
  uniqueDonors: number;
  /** Per-source breakdown. */
  bySource: Record<string, { creditMicroUsd: number; debitMicroUsd: number; count: number }>;
}

export function summarize(rows: LedgerRow[]): SummaryTotals {
  const totals: SummaryTotals = {
    netMicroUsd: 0,
    grossMicroUsd: 0,
    refundMicroUsd: 0,
    feeMicroUsd: 0,
    donationCount: 0,
    uniqueDonors: 0,
    bySource: {},
  };

  const donorSet = new Set<string>();

  for (const r of rows) {
    const amt = Number(r.amount_micro_usd) || 0;
    const bucket = totals.bySource[r.source] ??= { creditMicroUsd: 0, debitMicroUsd: 0, count: 0 };
    bucket.count += 1;
    if (r.direction === 'credit') {
      bucket.creditMicroUsd += amt;
      totals.grossMicroUsd += amt;
      if (r.kind === 'donation') {
        totals.donationCount += 1;
        if (r.related_person_id) donorSet.add(r.related_person_id);
      }
    } else {
      bucket.debitMicroUsd += amt;
      if (r.kind === 'refund') totals.refundMicroUsd += amt;
      if (r.kind === 'fee') totals.feeMicroUsd += amt;
    }
  }

  totals.uniqueDonors = donorSet.size;
  totals.netMicroUsd = totals.grossMicroUsd - totals.refundMicroUsd - totals.feeMicroUsd;
  return totals;
}

// ============================================
// DAILY TIMELINE — for the trend chart
// ============================================

export interface DailySeriesPoint {
  date: string;                          // YYYY-MM-DD (UTC)
  creditMicroUsd: number;
  refundMicroUsd: number;
  feeMicroUsd: number;
  netMicroUsd: number;
  donationCount: number;
}

/**
 * Bucket rows by UTC day. Fills missing days with zeros across the
 * inclusive `startDate..endDate` range so a 30-day chart renders 30
 * x-axis ticks even when most days had no activity.
 */
export function dailyTimeline(
  rows: LedgerRow[],
  startDate: string,                    // YYYY-MM-DD inclusive
  endDate: string,                      // YYYY-MM-DD inclusive
): DailySeriesPoint[] {
  const byDay = new Map<string, DailySeriesPoint>();
  for (const r of rows) {
    const day = (r.occurred_at ?? '').slice(0, 10);
    if (!day) continue;
    const point = byDay.get(day) ?? { date: day, creditMicroUsd: 0, refundMicroUsd: 0, feeMicroUsd: 0, netMicroUsd: 0, donationCount: 0 };
    const amt = Number(r.amount_micro_usd) || 0;
    if (r.direction === 'credit') {
      point.creditMicroUsd += amt;
      if (r.kind === 'donation') point.donationCount += 1;
    } else if (r.kind === 'refund') {
      point.refundMicroUsd += amt;
    } else if (r.kind === 'fee') {
      point.feeMicroUsd += amt;
    }
    point.netMicroUsd = point.creditMicroUsd - point.refundMicroUsd - point.feeMicroUsd;
    byDay.set(day, point);
  }

  return enumerateDates(startDate, endDate).map((date) =>
    byDay.get(date) ?? { date, creditMicroUsd: 0, refundMicroUsd: 0, feeMicroUsd: 0, netMicroUsd: 0, donationCount: 0 },
  );
}

export function enumerateDates(startDate: string, endDate: string): string[] {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const out: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ============================================
// BY FUND — breakdown for the pie / table view
// ============================================

export interface FundBucket {
  fund: string;
  creditMicroUsd: number;
  count: number;
  percentOfTotal: number;                // 0-1
}

/**
 * Stripe metadata.fund is the source of truth ("tithe", "missions",
 * "building", "general"). Unknown / missing → 'general'.
 */
export function fundBreakdown(rows: LedgerRow[]): FundBucket[] {
  const map = new Map<string, { creditMicroUsd: number; count: number }>();
  let total = 0;
  for (const r of rows) {
    if (r.direction !== 'credit' || r.kind !== 'donation') continue;
    const fund = (r.metadata as Record<string, unknown> | null)?.fund as string | undefined;
    const key = (fund && fund.trim()) || 'general';
    const amt = Number(r.amount_micro_usd) || 0;
    const b = map.get(key) ?? { creditMicroUsd: 0, count: 0 };
    b.creditMicroUsd += amt;
    b.count += 1;
    map.set(key, b);
    total += amt;
  }
  const buckets = Array.from(map.entries()).map(([fund, v]) => ({
    fund,
    creditMicroUsd: v.creditMicroUsd,
    count: v.count,
    percentOfTotal: total > 0 ? v.creditMicroUsd / total : 0,
  }));
  buckets.sort((a, b) => b.creditMicroUsd - a.creditMicroUsd);
  return buckets;
}

// ============================================
// TOP GIVERS — leaderboard
// ============================================

export interface GiverBucket {
  personId: string;
  totalMicroUsd: number;
  giftCount: number;
  firstGiftAt: string;
  lastGiftAt: string;
}

export function topGivers(rows: LedgerRow[], limit = 10): GiverBucket[] {
  const map = new Map<string, GiverBucket>();
  for (const r of rows) {
    if (r.direction !== 'credit' || r.kind !== 'donation' || !r.related_person_id) continue;
    const key = r.related_person_id;
    const amt = Number(r.amount_micro_usd) || 0;
    const b = map.get(key) ?? {
      personId: key,
      totalMicroUsd: 0,
      giftCount: 0,
      firstGiftAt: r.occurred_at,
      lastGiftAt: r.occurred_at,
    };
    b.totalMicroUsd += amt;
    b.giftCount += 1;
    if (r.occurred_at < b.firstGiftAt) b.firstGiftAt = r.occurred_at;
    if (r.occurred_at > b.lastGiftAt) b.lastGiftAt = r.occurred_at;
    map.set(key, b);
  }
  return Array.from(map.values())
    .sort((a, b) => b.totalMicroUsd - a.totalMicroUsd)
    .slice(0, Math.max(0, limit));
}

// ============================================
// PERIOD COMPARISON — for YoY / MoM deltas
// ============================================

export interface PeriodComparison {
  current: SummaryTotals;
  prior: SummaryTotals;
  deltaNetMicroUsd: number;
  deltaPercent: number;                  // -1 to +Infinity; Infinity if prior was 0 and current > 0
  deltaDonationCount: number;
}

export function comparePeriods(currentRows: LedgerRow[], priorRows: LedgerRow[]): PeriodComparison {
  const current = summarize(currentRows);
  const prior = summarize(priorRows);
  const delta = current.netMicroUsd - prior.netMicroUsd;
  const deltaPercent =
    prior.netMicroUsd > 0 ? delta / prior.netMicroUsd
    : current.netMicroUsd > 0 ? Infinity
    : 0;
  return {
    current,
    prior,
    deltaNetMicroUsd: delta,
    deltaPercent,
    deltaDonationCount: current.donationCount - prior.donationCount,
  };
}
