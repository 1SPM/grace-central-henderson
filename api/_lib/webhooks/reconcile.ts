/**
 * Ledger reconciliation primitives.
 *
 * The cron at api/cron/reconcile-stripe.ts runs nightly and:
 *   1. Sums yesterday's ledger entries per tenant per source.
 *   2. Compares to the prior 7-day daily average.
 *   3. Flags anomalies (>5× the trailing average OR a giving-day with
 *      $0 of credits but >$10 of fees/refunds).
 *
 * Full Stripe Balance API comparison (compare ledger sum to the actual
 * Stripe payouts) is TD-034 — needs Stripe API access wired through
 * the cron's env, plus per-tenant Stripe account-id mapping. The math
 * function below is the substrate for that future work.
 *
 * Pure-function design: cron handler hands in pre-fetched data, this
 * module returns analysis. No IO. Testable.
 */

export interface DailyLedgerBucket {
  churchId: string;
  date: string;                          // YYYY-MM-DD (UTC)
  source: string;                        // 'stripe' | 'i2c' | ...
  creditMicroUsd: number;                // total credits that day
  debitMicroUsd: number;                 // total debits (refunds + fees) that day
  feeMicroUsd: number;                   // subset of debits where kind='fee'
  entryCount: number;
}

export interface ReconciliationAnomaly {
  churchId: string;
  date: string;
  source: string;
  kind: 'volume_spike' | 'volume_drop' | 'fee_without_credit' | 'no_history_spike';
  detail: string;
  todayMicroUsd: number;
  trailingAvgMicroUsd: number;
}

export interface ReconciliationConfig {
  /** Trigger volume_spike when today's credits ≥ this multiple of the trailing daily average. */
  spikeRatio: number;                    // default 5.0
  /** Minimum absolute volume below which spike alerts are suppressed (noise filter). */
  minAbsoluteMicroUsd: number;           // default 1_000_000 ($1)
}

export const DEFAULT_RECONCILE_CONFIG: ReconciliationConfig = {
  spikeRatio: 5.0,
  minAbsoluteMicroUsd: 1_000_000,
};

interface RawLedgerRow {
  church_id: string;
  source: string;
  kind: string;
  direction: 'credit' | 'debit';
  amount_micro_usd: number;
  occurred_at: string;
}

/**
 * Group rows into per-day-per-source-per-church buckets. UTC dates.
 */
export function bucketLedgerRows(rows: RawLedgerRow[]): DailyLedgerBucket[] {
  const map = new Map<string, DailyLedgerBucket>();
  for (const r of rows) {
    const date = (r.occurred_at || '').slice(0, 10);
    if (!date) continue;
    const key = `${r.church_id}|${date}|${r.source}`;
    const b = map.get(key) ?? {
      churchId: r.church_id,
      date,
      source: r.source,
      creditMicroUsd: 0,
      debitMicroUsd: 0,
      feeMicroUsd: 0,
      entryCount: 0,
    };
    const amt = Number(r.amount_micro_usd) || 0;
    if (r.direction === 'credit') b.creditMicroUsd += amt;
    else b.debitMicroUsd += amt;
    if (r.kind === 'fee') b.feeMicroUsd += amt;
    b.entryCount += 1;
    map.set(key, b);
  }
  return Array.from(map.values());
}

/**
 * Compare yesterday's bucket to the trailing 7-day average for the
 * same (church, source). Returns one anomaly per (church, source)
 * that fires.
 */
export function detectReconciliationAnomalies(
  yesterday: DailyLedgerBucket[],
  trailing: DailyLedgerBucket[],          // 7 prior days, multiple buckets per (church, source)
  cfg: ReconciliationConfig = DEFAULT_RECONCILE_CONFIG,
): ReconciliationAnomaly[] {
  // Aggregate trailing by (church, source)
  const trailingByKey = new Map<string, { creditSum: number; days: number }>();
  for (const t of trailing) {
    const key = `${t.churchId}|${t.source}`;
    const cur = trailingByKey.get(key) ?? { creditSum: 0, days: 0 };
    cur.creditSum += t.creditMicroUsd;
    cur.days += 1;
    trailingByKey.set(key, cur);
  }

  const out: ReconciliationAnomaly[] = [];
  for (const today of yesterday) {
    const key = `${today.churchId}|${today.source}`;
    const trail = trailingByKey.get(key);
    const avg = trail && trail.days > 0 ? trail.creditSum / trail.days : 0;

    // Rule 1: fees/refunds without any credits → likely a partial outage.
    if (today.creditMicroUsd === 0 && today.debitMicroUsd >= 10 * cfg.minAbsoluteMicroUsd) {
      out.push({
        churchId: today.churchId,
        date: today.date,
        source: today.source,
        kind: 'fee_without_credit',
        detail: `$${(today.debitMicroUsd / 1_000_000).toFixed(2)} of debits with $0 credits`,
        todayMicroUsd: today.creditMicroUsd,
        trailingAvgMicroUsd: avg,
      });
      continue;
    }

    // Rule 2: spike vs trailing.
    if (today.creditMicroUsd >= cfg.minAbsoluteMicroUsd) {
      if (avg <= 0) {
        out.push({
          churchId: today.churchId,
          date: today.date,
          source: today.source,
          kind: 'no_history_spike',
          detail: `first-credit day with $${(today.creditMicroUsd / 1_000_000).toFixed(2)}`,
          todayMicroUsd: today.creditMicroUsd,
          trailingAvgMicroUsd: 0,
        });
      } else if (today.creditMicroUsd / avg >= cfg.spikeRatio) {
        out.push({
          churchId: today.churchId,
          date: today.date,
          source: today.source,
          kind: 'volume_spike',
          detail: `${(today.creditMicroUsd / avg).toFixed(1)}× trailing average`,
          todayMicroUsd: today.creditMicroUsd,
          trailingAvgMicroUsd: avg,
        });
      }
    }

    // Rule 3: drop. Trailing was healthy, today is materially below.
    if (avg >= cfg.minAbsoluteMicroUsd && today.creditMicroUsd <= avg / cfg.spikeRatio) {
      out.push({
        churchId: today.churchId,
        date: today.date,
        source: today.source,
        kind: 'volume_drop',
        detail: `today $${(today.creditMicroUsd / 1_000_000).toFixed(2)} vs avg $${(avg / 1_000_000).toFixed(2)}`,
        todayMicroUsd: today.creditMicroUsd,
        trailingAvgMicroUsd: avg,
      });
    }
  }
  return out;
}
