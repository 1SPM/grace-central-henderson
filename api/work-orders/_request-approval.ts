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
import { checkRelatedParty } from '../_lib/relatedPartyCheck.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LEADERSHIP_ROLE_KEYS = ['senior_pastor', 'executive_leadership', 'system_administrator'];

const SCHEMA = {
  work_order_id: uuid_({ required: true }),
  proposed_action: str({ required: true, min: 1, max: 2000 }),
  risk_level: str({ pattern: /^(low|medium|high|critical)$/ }),
  approver_user_id: uuid_(),
  notes: str({ max: 5000 }),
  /** Free-text name of an external vendor/grantee/contribution recipient, if any — used only for the related-party heuristic below. */
  counterparty_name: str({ max: 200 }),
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
      affected_resources: body.counterparty_name ? [{ counterparty_name: body.counterparty_name }] : [],
    })
    .select()
    .single();
  if (approvalErr || !approval) return res.status(500).json({ error: 'create_failed' });

  // Related-party heuristic: does the named counterparty share a last
  // name with any current leadership user? Flag-only, never blocking —
  // see api/_lib/relatedPartyCheck.ts.
  let flaggedApproval = approval;
  if (body.counterparty_name) {
    // Fetch all active role grants for the church and filter to leadership
    // roles in JS — PostgREST's dot-notation filter on an embedded
    // resource column (`.in('roles.key', ...)`) is not reliable across
    // supabase-js versions, so this avoids depending on it. user_roles has
    // two FKs to users (user_id, granted_by), so the embed must name the
    // constraint explicitly or PostgREST rejects the query as ambiguous.
    const { data: activeGrants, error: grantsErr } = await supabase
      .from('user_roles')
      .select('users!user_roles_user_id_fkey(last_name), roles(key)')
      .eq('church_id', actor.churchId)
      .is('revoked_at', null);
    if (grantsErr) console.error('[related-party check] failed to load leadership grants', grantsErr.message);

    const leadershipLastNames = (activeGrants ?? [])
      .filter(g => LEADERSHIP_ROLE_KEYS.includes((g.roles as unknown as { key: string } | null)?.key ?? ''))
      .map(g => (g.users as unknown as { last_name: string } | null)?.last_name)
      .filter((n): n is string => !!n);

    const check = checkRelatedParty(body.counterparty_name, leadershipLastNames);
    if (check.flagged) {
      const { data: updated } = await supabase
        .from('approvals')
        .update({
          related_party_flagged: true,
          affected_resources: [{ counterparty_name: body.counterparty_name, matched_staff_last_name: check.matchedName }],
        })
        .eq('id', approval.id)
        .eq('church_id', actor.churchId)
        .select()
        .single();
      if (updated) flaggedApproval = updated;

      const { correlationId: flagCorrelationId } = await emitPlatformEvent(supabase, {
        churchId: actor.churchId,
        eventType: 'approval.related_party_flagged',
        sourceApp: 'admin_dashboard',
        actorUserId: actor.userId,
        subjectType: 'approval',
        subjectId: approval.id,
        payload: { counterparty_name: body.counterparty_name, matched_staff_last_name: check.matchedName },
      });
      await recordAudit(supabase, {
        churchId: actor.churchId,
        actorUserId: actor.userId,
        actorClerkId: actor.clerkUserId,
        action: 'flag',
        entityType: 'approval',
        entityId: approval.id,
        after: { related_party_flagged: true, matched_staff_last_name: check.matchedName },
        correlationId: flagCorrelationId,
        route: '/api/work-orders/request-approval',
        method: 'POST',
      });
    }
  }

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
    payload: { approval_id: flaggedApproval.id, risk_level: flaggedApproval.risk_level },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'create',
    entityType: 'approval',
    entityId: flaggedApproval.id,
    after: flaggedApproval,
    correlationId,
    route: '/api/work-orders/request-approval',
    method: 'POST',
  });

  return res.status(201).json({ approval: flaggedApproval, work_order: updatedWorkOrder });
}
