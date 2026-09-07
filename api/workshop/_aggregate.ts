/**
 * GET /api/workshop/aggregate
 *
 * The "Us" stage of the Maya -> Me -> Us -> Pastor -> Real Pilot workshop
 * experience: "here's what N participating members could have generated
 * together." Public and unauthenticated by design, same as
 * /api/workshop/simulate — meant to run on a shared screen during the
 * workshop itself. Returns only aggregate numbers, never individual
 * participants' display names or spend (that's the staff-only
 * /api/workshop/participants view, for the Pastor stage).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveChurchIdForHost } from '../_lib/resolveChurchByHost.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'service_not_configured' });

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const churchId = await resolveChurchIdForHost(req.headers.host, supabase);
  if (!churchId) {
    return res.status(404).json({ error: 'Workshop simulation is not available on this domain' });
  }

  const { data, error, count } = await supabase
    .from('workshop_simulations')
    .select('monthly_spend_micro_usd, projected_impact_micro_usd, allocations', { count: 'exact' })
    .eq('church_id', churchId);

  if (error) {
    console.error('[workshop/aggregate] read failed', error);
    return res.status(500).json({ error: 'read_failed' });
  }

  const rows = data ?? [];
  const totalProjectedImpactMicroUsd = rows.reduce((sum, r) => sum + Number(r.projected_impact_micro_usd), 0);
  const totalMonthlySpendMicroUsd = rows.reduce((sum, r) => sum + Number(r.monthly_spend_micro_usd), 0);

  const causeTotals = new Map<string, number>();
  for (const row of rows) {
    const allocations = Array.isArray(row.allocations) ? row.allocations : [];
    for (const a of allocations) {
      if (a && typeof a === 'object' && typeof a.cause === 'string' && typeof a.pct === 'number') {
        const shareMicroUsd = (Number(row.projected_impact_micro_usd) * a.pct) / 100;
        causeTotals.set(a.cause, (causeTotals.get(a.cause) ?? 0) + shareMicroUsd);
      }
    }
  }

  return res.status(200).json({
    participantCount: count ?? 0,
    totalMonthlySpendUsd: totalMonthlySpendMicroUsd / 1_000_000,
    totalProjectedImpactUsd: totalProjectedImpactMicroUsd / 1_000_000,
    byCauseUsd: Object.fromEntries(
      [...causeTotals.entries()].map(([cause, micro]) => [cause, micro / 1_000_000]),
    ),
  });
}
