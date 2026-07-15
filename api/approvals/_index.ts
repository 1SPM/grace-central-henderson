/**
 * /api/approvals
 *
 *   GET   ?id=<uuid>       — fetch a single approval
 *   GET   (filters)        — list approvals (?status=pending, ?work_order_id=)
 *   PATCH ?id=<uuid>       — decide an approval
 *
 * Auth: Clerk Bearer. GET requires approvals.view; PATCH (deciding)
 * requires approvals.decide — a strictly narrower grant than approvals.view
 * (see migration 032: e.g. Ministry Leader is not seeded with either;
 * Senior Pastor and Executive Leadership hold both).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DECISIONS = ['approve', 'approve_with_changes', 'return_for_revision', 'reject', 'escalate'] as const;

const DECIDE_SCHEMA = {
  decision: str({ required: true, pattern: new RegExp(`^(${DECISIONS.join('|')})$`) }),
  decision_notes: str({ max: 5000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'approvals.view');
    if (!actor) return;

    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    if (id) {
      const { data: approval, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', id)
        .eq('church_id', actor.churchId)
        .maybeSingle();
      if (error) return res.status(500).json({ error: 'read_failed' });
      if (!approval) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json({ approval });
    }

    let query = supabase
      .from('approvals')
      .select('*')
      .eq('church_id', actor.churchId)
      .order('requested_at', { ascending: false })
      .limit(200);
    if (typeof req.query.status === 'string') query = query.eq('status', req.query.status);
    if (typeof req.query.work_order_id === 'string') query = query.eq('work_order_id', req.query.work_order_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ approvals: data ?? [] });
  }

  if (req.method === 'PATCH') {
    const actor = await requirePermission(req, res, supabase, 'approvals.decide');
    if (!actor) return;

    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    const body = readBody(req, res, DECIDE_SCHEMA);
    if (!body) return;

    const { data: existing, error: fetchErr } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', id)
      .eq('church_id', actor.churchId)
      .maybeSingle();
    if (fetchErr) return res.status(500).json({ error: 'read_failed' });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.status !== 'pending') {
      return res.status(409).json({ error: 'already_decided', status: existing.status });
    }

    const decidedAt = new Date().toISOString();
    const { data: approval, error } = await supabase
      .from('approvals')
      .update({
        decision: body.decision,
        decision_notes: body.decision_notes ?? null,
        approver_user_id: actor.userId,
        status: 'decided',
        decided_at: decidedAt,
      })
      .eq('id', id)
      .eq('church_id', actor.churchId)
      .select()
      .single();
    if (error || !approval) return res.status(500).json({ error: 'update_failed' });

    // A favorable decision on a Work-Order-linked approval resumes work;
    // anything else returns it to planning so it can be revised.
    if (approval.work_order_id) {
      const nextStatus = ['approve', 'approve_with_changes'].includes(body.decision) ? 'in_progress' : 'planning';
      await supabase
        .from('work_orders')
        .update({ status: nextStatus })
        .eq('id', approval.work_order_id)
        .eq('church_id', actor.churchId)
        .eq('status', 'awaiting_approval'); // no-op if it moved out-of-band
    }

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'approval.decided',
      sourceApp: 'admin_dashboard',
      actorUserId: actor.userId,
      subjectType: 'approval',
      subjectId: id,
      payload: { decision: body.decision, work_order_id: approval.work_order_id },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'decide',
      entityType: 'approval',
      entityId: id,
      before: existing,
      after: approval,
      correlationId,
      route: '/api/approvals',
      method: 'PATCH',
    });

    return res.status(200).json({ approval });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
