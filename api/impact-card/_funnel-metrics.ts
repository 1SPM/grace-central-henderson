/**
 * GET /api/impact-card/funnel-metrics
 *
 * Admin Dashboard: Impact Card adoption-funnel metrics. Every figure is
 * computed live from real rows (kyc_verifications, cards,
 * interchange_events, impact_allocations, work_orders, cron_runs) by the
 * pure calculation in api/_lib/impactCardFunnelMetrics.ts — nothing here
 * is hard-coded or sandbox/mock data represented as live.
 *
 * Access is split by sensitivity, not all-or-nothing:
 *   - impact_card.view: funnel/participation figures (application,
 *     completion, activation, active participation, onboarding drop-off,
 *     support cases, campaign performance).
 *   - giving_financial.view: financially-sensitive figures (approved
 *     aggregate value, reconciliation status, program benefit).
 * A caller with only one of the two permissions gets that half of the
 * response; the other half's fields are replaced with a
 * permission_required marker rather than withheld silently.
 *
 * Query: ?period_start=<ISO>&period_end=<ISO> (defaults to the current
 * UTC calendar month).
 *
 * Auth: Clerk Bearer (or demo bootstrap). Requires impact_card.view OR
 * giving_financial.view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';
import {
  computeImpactCardFunnelMetrics,
  applyFieldPermissions,
  type CronRunRow,
} from '../_lib/impactCardFunnelMetrics.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function currentUtcMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  const hasFunnelAccess = actor.permissions.has('impact_card.view');
  const hasFinancialAccess = actor.permissions.has('giving_financial.view');
  if (!hasFunnelAccess && !hasFinancialAccess) {
    return res.status(403).json({ error: 'insufficient_permission', required: 'impact_card.view or giving_financial.view' });
  }

  const defaults = currentUtcMonth();
  const periodStart = typeof req.query.period_start === 'string' ? req.query.period_start : defaults.start;
  const periodEnd = typeof req.query.period_end === 'string' ? req.query.period_end : defaults.end;

  const [
    kycRes, cardsRes, interchangeRes, allocationsRes,
    supportWoRes, reconcileWoRes, campaignWoRes, cronRes,
  ] = await Promise.all([
    supabase.from('kyc_verifications').select('status, submitted_at').eq('church_id', actor.churchId),
    supabase.from('cards').select('status, activated_at, issued_at').eq('church_id', actor.churchId),
    supabase.from('interchange_events').select('card_id, event_type, direction, occurred_at').eq('church_id', actor.churchId),
    supabase.from('impact_allocations').select('amount_micro_usd, period_month').eq('church_id', actor.churchId),
    supabase.from('work_orders').select('status, created_at')
      .eq('church_id', actor.churchId).eq('ministry', 'Member Support').contains('metadata', { program: 'impact_card' }),
    supabase.from('work_orders').select('status, created_at')
      .eq('church_id', actor.churchId).eq('ministry', 'Finance').contains('metadata', { program: 'impact_card' }),
    supabase.from('work_orders').select('status, created_at')
      .eq('church_id', actor.churchId).eq('ministry', 'Impact Card Operations').contains('metadata', { program: 'impact_card' })
      .ilike('title', '%Onboarding Campaign%'),
    supabase.from('cron_runs').select('ok, created_at, summary')
      .eq('job', 'reconcile-stripe').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const firstError = [kycRes, cardsRes, interchangeRes, allocationsRes, supportWoRes, reconcileWoRes, campaignWoRes]
    .find(r => r.error);
  if (firstError?.error) {
    console.error('[impact-card/funnel-metrics] read failed', firstError.error);
    return res.status(500).json({ error: 'read_failed' });
  }

  const metrics = computeImpactCardFunnelMetrics({
    periodStart,
    periodEnd,
    asOf: new Date().toISOString(),
    kyc: kycRes.data ?? [],
    cards: cardsRes.data ?? [],
    interchangeEvents: interchangeRes.data ?? [],
    impactAllocations: allocationsRes.data ?? [],
    supportWorkOrders: supportWoRes.data ?? [],
    reconciliationWorkOrders: reconcileWoRes.data ?? [],
    campaignWorkOrders: campaignWoRes.data ?? [],
    latestReconcileCronRun: (cronRes.data as CronRunRow | null) ?? null,
  });

  const response = applyFieldPermissions(metrics, { hasFunnelAccess, hasFinancialAccess });

  return res.status(200).json({
    reporting_period: { start: periodStart, end: periodEnd },
    metrics: response,
  });
}
