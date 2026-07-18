/**
 * GET /api/impact/health
 *
 * Congregational Health scorecard: computes the current north-star
 * metrics live (never stale), reads the last 120 days of daily
 * snapshots for trend sparklines, and returns the at-risk member list
 * (real people, real last-activity dates — never fabricated).
 *
 * Auth: analytics.view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { fetchHealthMetricsInput } from '../_lib/healthSnapshot.js';
import { computeHealthMetrics, computeAtRiskMembers } from '../_lib/healthMetrics.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SNAPSHOT_WINDOW_DAYS = 120;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'analytics.view');
  if (!actor) return;

  const now = new Date();
  const input = await fetchHealthMetricsInput(supabase, actor.churchId, now);
  const current = computeHealthMetrics(input);
  const atRisk = computeAtRiskMembers(input.events, input.people, now);

  const since = new Date(now.getTime() - SNAPSHOT_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data: snapshotRows, error: snapshotError } = await supabase
    .from('health_snapshots')
    .select('snapshot_date, metrics')
    .eq('church_id', actor.churchId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })
    .limit(SNAPSHOT_WINDOW_DAYS);
  if (snapshotError) return res.status(500).json({ error: 'read_failed' });

  return res.status(200).json({
    current,
    snapshots: snapshotRows ?? [],
    at_risk: atRisk,
  });
}
