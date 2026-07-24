/**
 * Daily AI burn-rate anomaly cron.
 *
 * Scheduled in vercel.json: `0 5 * * *` (05:00 UTC daily).
 *
 * For each tenant with usage in the last 24h:
 *   1. Sum last hour's cost_micro_usd from token_usage.
 *   2. Sum last 168 hours' cost_micro_usd.
 *   3. Call detectAnomaly(). If anomalous → fire Sentry event with
 *      church_id, ratio, last-hour spend, trailing avg.
 *
 * Returns a summary JSON for observability (Vercel logs / dashboards).
 *
 * Auth: Bearer CRON_SECRET only — see api/_lib/cronAuth.ts for why the
 * x-vercel-cron header is not trusted.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { detectAnomaly } from '../_lib/ai/anomaly.js';
import { microUsdToUsd } from '../_lib/ai/pricing.js';
import { recordCronRun } from '../_lib/cron-runs.js';
import { requireCronAuth } from '../_lib/cronAuth.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LOOKBACK_HOURS = 168;             // 7 days

interface SummaryEntry {
  church_id: string;
  last_hour_usd: number;
  trailing_avg_usd: number;
  ratio: number;
  anomalous: boolean;
  reason?: string;
}

interface UsageAggRow {
  church_id: string;
  cost_micro_usd: number | string;
  created_at: string;
}

async function fetchUsageSince(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<UsageAggRow[]> {
  // PostgREST max page is 1000 rows. Iterate until exhausted. At
  // realistic scale (one row per AI call across all tenants) this is
  // fine; if we ever exceed 100k rows/week an RPC `sum_token_usage_per_church`
  // becomes the right move.
  const PAGE = 1000;
  let out: UsageAggRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('token_usage')
      .select('church_id, cost_micro_usd, created_at')
      .gte('created_at', sinceIso)
      .not('church_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`token_usage read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    out = out.concat(data as UsageAggRow[]);
    if (data.length < PAGE) break;
  }
  return out;
}

function bucketByChurch(
  rows: UsageAggRow[],
  lastHourCutoffIso: string,
): Map<string, { lastHour: number; trailingTotal: number }> {
  const m = new Map<string, { lastHour: number; trailingTotal: number }>();
  for (const r of rows) {
    const cost = Number(r.cost_micro_usd) || 0;
    const entry = m.get(r.church_id) ?? { lastHour: 0, trailingTotal: 0 };
    entry.trailingTotal += cost;
    if (r.created_at >= lastHourCutoffIso) {
      entry.lastHour += cost;
    }
    m.set(r.church_id, entry);
  }
  return m;
}

async function reportToSentry(entry: SummaryEntry): Promise<void> {
  try {
    const { Sentry, sentryEnabled } = await import('../instrument.js');
    if (!sentryEnabled) return;
    Sentry.withScope((scope) => {
      scope.setTag('alert_kind', 'ai_burn_anomaly');
      scope.setTag('church_id', entry.church_id);
      scope.setContext('ai_burn_anomaly', {
        church_id: entry.church_id,
        last_hour_usd: entry.last_hour_usd,
        trailing_avg_usd: entry.trailing_avg_usd,
        ratio: entry.ratio,
        reason: entry.reason ?? 'ratio_exceeded',
      });
      Sentry.captureMessage(
        `AI burn anomaly: church=${entry.church_id} ratio=${entry.ratio.toFixed(1)}× last_hour=$${entry.last_hour_usd.toFixed(4)} trailing_avg=$${entry.trailing_avg_usd.toFixed(4)}/hr`,
        'warning',
      );
    });
  } catch {
    /* Sentry not configured — local logs only */
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (requireCronAuth(req, res) !== null) return;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const now = new Date();
  const trailingSince = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const lastHourSince = new Date(now.getTime() - 60 * 60 * 1000);

  let rows: UsageAggRow[];
  try {
    rows = await fetchUsageSince(supabase, trailingSince.toISOString());
  } catch (err) {
    console.error('[ai-anomaly cron]', err);
    await recordCronRun(supabase, 'ai-anomaly', {
      ok: false,
      durationMs: Date.now() - now.getTime(),
      summary: { error: 'usage_read_failed' },
    });
    return res.status(500).json({ error: 'usage_read_failed' });
  }

  const buckets = bucketByChurch(rows, lastHourSince.toISOString());
  const summary: SummaryEntry[] = [];
  let alerted = 0;

  for (const [church_id, agg] of buckets) {
    const r = detectAnomaly({
      lastHourSpendMicroUsd: agg.lastHour,
      trailingTotalMicroUsd: agg.trailingTotal,
      lookbackHours: LOOKBACK_HOURS,
    });
    const entry: SummaryEntry = {
      church_id,
      last_hour_usd: microUsdToUsd(agg.lastHour),
      trailing_avg_usd: microUsdToUsd(r.trailingHourlyAvgMicroUsd),
      ratio: Number.isFinite(r.ratio) ? r.ratio : -1,    // JSON can't carry Infinity
      anomalous: r.anomalous,
      reason: r.reason,
    };
    summary.push(entry);
    if (r.anomalous) {
      alerted++;
      await reportToSentry(entry);
    }
  }

  await recordCronRun(supabase, 'ai-anomaly', {
    ok: true,
    durationMs: Date.now() - now.getTime(),
    summary: { checked: summary.length, alerted },
  });

  return res.status(200).json({
    ok: true,
    checked: summary.length,
    alerted,
    window: { from: trailingSince.toISOString(), to: now.toISOString() },
    summary,
  });
}
