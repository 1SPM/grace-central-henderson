/**
 * Daily ledger reconciliation cron.
 *
 * Scheduled in vercel.json: `0 6 * * *` (06:00 UTC daily, after most
 * timezones have closed yesterday's giving).
 *
 * Per-tenant per-source anomaly detection. Pure math lives in
 * api/_lib/webhooks/reconcile.ts; this handler is the IO shell.
 *
 * NOT YET WIRED: actual Stripe Balance API comparison. That's TD-034 —
 * needs per-tenant Stripe account_id mapping (Stripe Connect) and an
 * authenticated retrieval. Today's MVP catches the high-value signals
 * (volume spike/drop, fees without credits) from the ledger alone.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { bucketLedgerRows, detectReconciliationAnomalies } from '../_lib/webhooks/reconcile.js';
import { recordCronRun } from '../_lib/cron-runs.js';
import { requireCronAuth } from '../_lib/cronAuth.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TRAILING_DAYS = 7;

interface RawRow {
  church_id: string;
  source: string;
  kind: string;
  direction: 'credit' | 'debit';
  amount_micro_usd: number;
  occurred_at: string;
}

async function fetchLedgerRows(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<RawRow[]> {
  const PAGE = 1000;
  let all: RawRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('church_id, source, kind, direction, amount_micro_usd, occurred_at')
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`ledger read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data as RawRow[]);
    if (data.length < PAGE) break;
  }
  return all;
}

async function reportAnomaly(detail: {
  churchId: string; date: string; source: string; kind: string;
  description: string; todayUsd: number; trailingAvgUsd: number;
}): Promise<void> {
  try {
    const { Sentry, sentryEnabled } = await import('../instrument.js');
    if (!sentryEnabled) return;
    Sentry.withScope((scope) => {
      scope.setTag('alert_kind', 'ledger_reconciliation_anomaly');
      scope.setTag('reconcile_kind', detail.kind);
      scope.setTag('church_id', detail.churchId);
      scope.setTag('source', detail.source);
      scope.setContext('reconciliation', detail);
      Sentry.captureMessage(
        `Ledger anomaly [${detail.kind}]: church=${detail.churchId} src=${detail.source} date=${detail.date} ${detail.description}`,
        'warning',
      );
    });
  } catch {
    /* Sentry not configured */
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (requireCronAuth(req, res) !== null) return;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Window: yesterday (UTC) + 7 days trailing.
  const now = new Date();
  const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0));
  const yesterdayEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),     0, 0, 0));
  const trailingStart  = new Date(yesterdayStart.getTime() - TRAILING_DAYS * 86_400_000);

  let rows: RawRow[];
  try {
    rows = await fetchLedgerRows(supabase, trailingStart.toISOString());
  } catch (err) {
    console.error('[reconcile-stripe]', err);
    await recordCronRun(supabase, 'reconcile-stripe', {
      ok: false,
      durationMs: Date.now() - now.getTime(),
      summary: { error: 'ledger_read_failed' },
    });
    return res.status(500).json({ error: 'ledger_read_failed' });
  }

  const yesterdayIso = yesterdayStart.toISOString();
  const yesterdayEndIso = yesterdayEnd.toISOString();
  const yesterdayRows = rows.filter((r) => r.occurred_at >= yesterdayIso && r.occurred_at < yesterdayEndIso);
  const trailingRows  = rows.filter((r) => r.occurred_at < yesterdayIso);

  const yesterdayBuckets = bucketLedgerRows(yesterdayRows);
  const trailingBuckets  = bucketLedgerRows(trailingRows);

  const anomalies = detectReconciliationAnomalies(yesterdayBuckets, trailingBuckets);

  for (const a of anomalies) {
    await reportAnomaly({
      churchId: a.churchId,
      date: a.date,
      source: a.source,
      kind: a.kind,
      description: a.detail,
      todayUsd: a.todayMicroUsd / 1_000_000,
      trailingAvgUsd: a.trailingAvgMicroUsd / 1_000_000,
    });
  }

  await recordCronRun(supabase, 'reconcile-stripe', {
    ok: true,
    durationMs: Date.now() - now.getTime(),
    summary: { anomalies_detected: anomalies.length, yesterday_buckets: yesterdayBuckets.length },
  });

  return res.status(200).json({
    ok: true,
    window: { yesterday: yesterdayIso, trailing_since: trailingStart.toISOString() },
    yesterday_buckets: yesterdayBuckets.length,
    trailing_buckets: trailingBuckets.length,
    anomalies_detected: anomalies.length,
    anomalies,
  });
}
