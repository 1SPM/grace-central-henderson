/**
 * GET /api/workos/summary
 *
 * Executive Overview metrics — every value is a live count against a real
 * table, computed at request time (see api/_lib/workosMetrics.ts for the
 * definition/period/source catalog). No metric here is estimated,
 * simulated, or cached from a mock dataset.
 *
 * Auth: Clerk Bearer (or demo bootstrap), analytics.view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { METRIC_CATALOG, type MetricKey } from '../_lib/workosMetrics.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'analytics.view');
  if (!actor) return;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const sevenDaysAgoDate = sevenDaysAgo.slice(0, 10);
  const churchId = actor.churchId;

  const values: Record<MetricKey, number> = {
    active_members: 0,
    households: 0,
    attendance_last_7_days: 0,
    newcomers_last_30_days: 0,
    volunteers_placed: 0,
    open_care_requests: 0,
    unresolved_follow_ups: 0,
    active_work_orders: 0,
    overdue_tasks: 0,
    pending_approvals: 0,
    recent_agent_runs: 0,
    data_quality_unreachable_members: 0,
  };

  const [
    activeMembers,
    households,
    attendance,
    newcomers,
    volunteersPlaced,
    openCare,
    followUps,
    activeWorkOrders,
    overdueTasks,
    pendingApprovals,
    recentAgentRuns,
    unreachable,
  ] = await Promise.all([
    supabase.from('people').select('id', { count: 'exact', head: true }).eq('church_id', churchId).in('status', ['member', 'leader']),
    supabase.from('households').select('id', { count: 'exact', head: true }).eq('church_id', churchId),
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('church_id', churchId).gte('date', sevenDaysAgoDate),
    supabase.from('people').select('id', { count: 'exact', head: true }).eq('church_id', churchId).gte('first_visit', thirtyDaysAgo),
    supabase.from('volunteer_interests').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('status', 'placed'),
    supabase.from('care_requests').select('id', { count: 'exact', head: true }).eq('church_id', churchId).not('status', 'in', '(resolved,closed)'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('category', 'follow-up').eq('completed', false),
    supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('church_id', churchId).not('status', 'in', '(completed,cancelled)'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('completed', false).lt('due_date', today),
    supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('status', 'pending'),
    supabase.from('agent_runs').select('id', { count: 'exact', head: true }).eq('church_id', churchId).gte('created_at', sevenDaysAgo),
    supabase.from('people').select('id', { count: 'exact', head: true }).eq('church_id', churchId).in('status', ['member', 'leader']).is('email', null).is('phone', null),
  ]);

  values.active_members = activeMembers.count ?? 0;
  values.households = households.count ?? 0;
  values.attendance_last_7_days = attendance.count ?? 0;
  values.newcomers_last_30_days = newcomers.count ?? 0;
  values.volunteers_placed = volunteersPlaced.count ?? 0;
  values.open_care_requests = openCare.count ?? 0;
  values.unresolved_follow_ups = followUps.count ?? 0;
  values.active_work_orders = activeWorkOrders.count ?? 0;
  values.overdue_tasks = overdueTasks.count ?? 0;
  values.pending_approvals = pendingApprovals.count ?? 0;
  values.recent_agent_runs = recentAgentRuns.count ?? 0;
  values.data_quality_unreachable_members = unreachable.count ?? 0;

  const generatedAt = now.toISOString();
  const metrics = METRIC_CATALOG.map(m => ({
    ...m,
    value: values[m.key],
    last_updated: generatedAt,
  }));

  return res.status(200).json({ generated_at: generatedAt, metrics });
}
