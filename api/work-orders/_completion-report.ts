/**
 * GET /api/work-orders/completion-report?id=<uuid>
 *
 * Generates (and persists as an `artifacts` row, kind='report') a
 * completion report for a Work Order: task progress, evidence count,
 * approval status, and a plain-language narrative. Template-generated
 * from real rows — not an LLM call, not simulated.
 *
 * Auth: Clerk Bearer (or demo bootstrap), work_orders.view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { buildCompletionReport } from '../_lib/completionReport.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'work_orders.view');
  if (!actor) return;

  const id = typeof req.query.id === 'string' ? req.query.id : undefined;
  if (!id) return res.status(400).json({ error: 'missing_id' });

  const [{ data: workOrder }, { data: tasks }, { data: evidence }, { data: approvals }] = await Promise.all([
    supabase.from('work_orders').select('*').eq('id', id).eq('church_id', actor.churchId).maybeSingle(),
    supabase.from('work_order_tasks').select('*').eq('work_order_id', id).order('position'),
    supabase.from('work_order_evidence').select('*').eq('work_order_id', id),
    supabase.from('approvals').select('*').eq('work_order_id', id).order('requested_at', { ascending: false }),
  ]);
  if (!workOrder) return res.status(404).json({ error: 'not_found' });

  const report = buildCompletionReport({
    workOrder,
    tasks: tasks ?? [],
    evidence: evidence ?? [],
    approvals: approvals ?? [],
    generatedAt: new Date().toISOString(),
  });

  const { data: artifact, error: artifactErr } = await supabase
    .from('artifacts')
    .insert({
      church_id: actor.churchId,
      work_order_id: id,
      kind: 'report',
      title: `${workOrder.title} — Completion Report`,
      content: JSON.stringify(report, null, 2),
      sensitivity: workOrder.sensitivity,
      created_by_user_id: actor.userId,
    })
    .select()
    .single();
  if (artifactErr) {
    console.error('[work-orders/completion-report] artifact persist failed', artifactErr);
    // The report itself is still valid even if persistence failed —
    // return it, but flag that it wasn't saved.
    return res.status(200).json({ report, artifact: null, persisted: false });
  }

  return res.status(200).json({ report, artifact, persisted: true });
}
