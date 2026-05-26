/**
 * GET /api/financial-hub/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&compare=prior_period
 *
 * Returns the full Financial Hub page payload in one round-trip:
 *   - summary: SummaryTotals for the window
 *   - timeline: daily series for the window (zero-filled)
 *   - funds: fund breakdown for the window
 *   - comparison: comparePeriods vs the prior equal-length window (optional)
 *
 * Auth: Clerk Bearer, any role. Church scope from JWT's
 * app_metadata.church_id — clients cannot supply church_id explicitly.
 *
 * Money is returned in BOTH micro-USD (for math) and USD (for display).
 * UI should prefer the micro-USD values for any aggregation and only
 * use USD for rendering — float drift accumulates fast.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import {
  summarize,
  dailyTimeline,
  fundBreakdown,
  comparePeriods,
  type LedgerRow,
} from '../_lib/financial-hub/aggregations.js';
import { microUsdToUsd } from '../_lib/ai/pricing.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_RANGE_DAYS = 366;

function parseDateRange(req: VercelRequest): { from: string; to: string } | { error: string } {
  const fromRaw = String(req.query.from ?? '').trim();
  const toRaw = String(req.query.to ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
    return { error: 'from + to required as YYYY-MM-DD' };
  }
  const from = new Date(fromRaw + 'T00:00:00Z');
  const to = new Date(toRaw + 'T23:59:59Z');
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: 'invalid from/to date' };
  }
  if (from > to) return { error: 'from must be ≤ to' };
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (days > MAX_RANGE_DAYS) return { error: `range exceeds ${MAX_RANGE_DAYS} days` };
  return { from: fromRaw, to: toRaw };
}

interface LedgerRowFromDb extends LedgerRow {
  church_id: string;
}

async function fetchRows(
  supabase: ReturnType<typeof createClient>,
  churchId: string,
  fromIso: string,
  toIso: string,
): Promise<LedgerRowFromDb[]> {
  const PAGE = 1000;
  let all: LedgerRowFromDb[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('id, church_id, source, kind, direction, amount_micro_usd, occurred_at, related_person_id, metadata')
      .eq('church_id', churchId)
      .gte('occurred_at', fromIso)
      .lte('occurred_at', toIso)
      .order('occurred_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`ledger read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data as unknown as LedgerRowFromDb[]);
    if (data.length < PAGE) break;
  }
  return all;
}

function withUsd<T extends Record<string, unknown>>(obj: T): T & Record<string, number> {
  const out: Record<string, unknown> = { ...obj };
  for (const [k, v] of Object.entries(obj)) {
    if (k.endsWith('MicroUsd') && typeof v === 'number') {
      const usdKey = k.replace(/MicroUsd$/, 'Usd');
      out[usdKey] = microUsdToUsd(v);
    }
  }
  return out as T & Record<string, number>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const auth = await requireClerkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const range = parseDateRange(req);
  if ('error' in range) return res.status(400).json({ error: range.error });

  const compareWithPrior = req.query.compare === 'prior_period';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const fromIso = `${range.from}T00:00:00.000Z`;
  const toIso = `${range.to}T23:59:59.999Z`;

  let rows: LedgerRowFromDb[];
  try {
    rows = await fetchRows(supabase, auth.churchId, fromIso, toIso);
  } catch (err) {
    console.error('[financial-hub/summary]', err);
    return res.status(500).json({ error: 'ledger read failed' });
  }

  const summary = summarize(rows);
  const timeline = dailyTimeline(rows, range.from, range.to);
  const funds = fundBreakdown(rows);

  let comparison = null;
  if (compareWithPrior) {
    const days = Math.round(
      (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000,
    );
    const priorTo = new Date(new Date(fromIso).getTime() - 1).toISOString();
    const priorFromDate = new Date(new Date(fromIso).getTime() - (days + 1) * 86_400_000);
    const priorFrom = priorFromDate.toISOString();
    let priorRows: LedgerRowFromDb[] = [];
    try {
      priorRows = await fetchRows(supabase, auth.churchId, priorFrom, priorTo);
    } catch (err) {
      console.warn('[financial-hub/summary] prior period read failed; continuing without compare', err);
    }
    comparison = comparePeriods(rows, priorRows);
  }

  return res.status(200).json({
    range: { from: range.from, to: range.to },
    summary: {
      ...withUsd(summary),
      bySource: Object.fromEntries(
        Object.entries(summary.bySource).map(([k, v]) => [k, withUsd(v)]),
      ),
    },
    timeline: timeline.map(withUsd),
    funds: funds.map((f) => ({
      ...withUsd(f),
      percentOfTotal: f.percentOfTotal,
    })),
    comparison: comparison
      ? {
          current: { ...withUsd(comparison.current), bySource: comparison.current.bySource },
          prior:   { ...withUsd(comparison.prior),   bySource: comparison.prior.bySource },
          deltaNetMicroUsd: comparison.deltaNetMicroUsd,
          deltaNetUsd: microUsdToUsd(comparison.deltaNetMicroUsd),
          deltaPercent: Number.isFinite(comparison.deltaPercent) ? comparison.deltaPercent : null,
          deltaDonationCount: comparison.deltaDonationCount,
        }
      : null,
  });
}
