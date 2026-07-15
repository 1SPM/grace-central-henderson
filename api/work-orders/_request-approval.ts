/**
 * /api/work-orders/request-approval
 *
 *   POST — create an approval request for a Work Order and move it to
 *          'awaiting_approval'. This is the only path that puts a Work
 *          Order into that status (see api/work-orders/_index.ts
 *          ALLOWED_TRANSITIONS, which permits it from 'planning').
 *
 * Auth: Clerk Bearer, work_orders.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  work_order_id: uuid_({ required: true }),
  proposed_action: str({ required: true, min: 1, max: 2000 }),
  risk_level: str({ pattern: /^(low|medium|high|critical)$/ }),
  approver_user_id: uuid_(),
  notes: str({ max: 5000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'work_orders.manage');
  if (!actor) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const { data: workOrder, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', body.work_order_id)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (fetchErr) return res.status(500).json({ error: 'read_failed' });
  if (!workOrder) return res.status(404).json({ error: 'work_order_not_found' });

  if (!['draft', 'planning'].includes(workOrder.status)) {
    return res.status(409).json({
      error: 'invalid_status_for_approval_request',
      status: workOrder.status,
      allowed_from: ['draft', 'planning'],
    });
  }

  const { data: approval, error: approvalErr } = await supabase
    .from('approvals')
    .insert({
      church_id: actor.churchId,
      work_order_id: workOrder.id,
      entity_type: 'work_order',
      entity_id: workOrder.id,
      proposed_action: body.proposed_action,
      requested_by_user_id: actor.userId,
      risk_level: body.risk_level ?? 'medium',
      approver_user_id: body.approver_user_id ?? null,
      decision_notes: body.notes ?? null,
    })
    .select()
    .single();
  if (approvalErr || !approval) return res.status(500).json({ error: 'create_failed' });

  const { data: updatedWorkOrder, error: updateErr } = await supabase
    .from('work_orders')
    .update({ status: 'awaiting_approval' })
    .eq('id', workOrder.id)
    .eq('church_id', actor.churchId)
    .select()
    .single();
  if (updateErr || !updatedWorkOrder) return res.status(500).json({ error: 'status_update_failed' });

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'work_order.approval_requested',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'work_order',
    subjectId: workOrder.id,
    payload: { approval_id: approval.id, risk_level: approval.risk_level },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'create',
    entityType: 'approval',
    entityId: approval.id,
    after: approval,
    correlationId,
    route: '/api/work-orders/request-approval',
    method: 'POST',
  });

  return res.status(201).json({ approval, work_order: updatedWorkOrder });
}
