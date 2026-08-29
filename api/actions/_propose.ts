/**
 * POST /api/actions/propose
 *
 * The chat door's entrance to the approvals lifecycle.
 *
 * WHY THIS EXISTS (TD-061)
 *
 * Ask GRACE executed every action straight from the browser: no server-side
 * permission check, no approval, no audit row. Assigning a Work Order owner
 * needed a pastor's decision; deleting a person did not. Same product,
 * opposite rules.
 *
 * This does not build a second approvals system. It writes into the one that
 * already exists — `agent_actions` + `approvals` — so a chat proposal and an
 * agent proposal land in the same Decision Queue, are decided by the same
 * endpoint, and are carried out by the same executor registry. That shared
 * ledger is the point: one vocabulary, one lifecycle, whichever door it came
 * from.
 *
 * WHAT THIS ENDPOINT DELIBERATELY DOES NOT DO
 *
 * It never performs the action. It records a request and stops. Execution
 * happens only in api/approvals (PATCH) after a human with `approvals.decide`
 * decides it — which is the entire property being bought here.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { findAction } from '../_lib/actionCatalog.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROPOSE_SCHEMA = {
  action_type: str({ required: true, max: 64 }),
  target_entity_id: uuid_({ required: true }),
};

/** Human-readable summary shown in the Decision Queue. */
function describeProposal(actionType: string, payload: Record<string, unknown>): string {
  const who = typeof payload.person_name === 'string' && payload.person_name
    ? payload.person_name
    : 'this person';
  switch (actionType) {
    case 'delete_person':
      return `Delete ${who} and their history`;
    case 'send_sms':
      return `Text ${who}`;
    default:
      return `Run ${actionType}`;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const parsed = readBody(req, res, PROPOSE_SCHEMA);
  if (!parsed) return;  // 400 already sent
  const actionType = parsed.action_type as string;
  const targetEntityId = parsed.target_entity_id as string;

  // The catalog decides what is proposable and under whose permission — not
  // the caller, and not a list maintained separately in this file.
  const definition = findAction(actionType);
  if (!definition) return res.status(400).json({ error: 'unknown_action_type' });
  if (!definition.requiresApproval) {
    // An action the catalog says runs immediately must not be smuggled
    // through the approvals queue, where it would sit unexecuted forever.
    return res.status(400).json({ error: 'action_does_not_require_approval' });
  }
  if (!definition.permission) return res.status(500).json({ error: 'action_has_no_permission' });

  // The permission gate the chat door never had.
  const actor = await requirePermission(req, res, supabase, definition.permission);
  if (!actor) return;

  // payload is free-form per action type, so it is read directly rather than
  // schema-validated here; each executor validates the fields it needs at
  // execution time, which is when they actually have to be right.
  const rawPayload = (req.body as Record<string, unknown> | undefined)?.payload;
  const payload = (rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload))
    ? rawPayload as Record<string, unknown>
    : {};

  // Refuse a duplicate rather than stacking identical decisions on one
  // pastor. 'failed' is deliberately absent from the settled set so a
  // genuine retry after a failure is still possible.
  const { data: existing, error: dupErr } = await supabase
    .from('agent_actions')
    .select('id, approval_id')
    .eq('church_id', actor.churchId)
    .eq('action_type', actionType)
    .eq('target_entity_id', targetEntityId)
    .in('status', ['proposed', 'approved'])
    .limit(1)
    .maybeSingle();
  if (dupErr) return res.status(500).json({ error: 'duplicate_check_failed' });
  if (existing) {
    return res.status(200).json({
      status: 'already_pending',
      action_id: existing.id,
      approval_id: existing.approval_id,
    });
  }

  // Approval first, then the action pointing at it. The reverse order can
  // leave an action row that is proposed but un-decidable if the second
  // write fails — same ordering the agent runner uses for the same reason.
  const { data: approval, error: approvalErr } = await supabase
    .from('approvals')
    .insert({
      church_id: actor.churchId,
      entity_type: 'agent_action',
      proposed_action: describeProposal(actionType, payload),
      requested_by_user_id: actor.userId,
      // Names the surface, not a person: "who asked" is the user above.
      requested_by_agent: 'grace_chat',
      risk_level: definition.consequence === 'external' ? 'high' : 'medium',
      status: 'pending',
    })
    .select('id')
    .single();
  if (approvalErr || !approval) return res.status(500).json({ error: 'approval_create_failed' });

  const { data: action, error: actionErr } = await supabase
    .from('agent_actions')
    .insert({
      church_id: actor.churchId,
      origin_surface: 'chat',      // migration 071
      agent_run_id: null,          // no run — a person asked for this
      proposed_by_user_id: actor.userId,
      action_type: actionType,
      // Both gated actions target a person today; when that stops being
      // true this must come from the catalog, not a constant.
      target_entity_type: 'person',
      target_entity_id: targetEntityId,
      payload,
      requires_approval: true,
      approval_id: approval.id,
      status: 'proposed',
    })
    .select('id')
    .single();
  if (actionErr || !action) {
    // Leave no un-decidable approval behind pointing at nothing.
    await supabase.from('approvals').delete().eq('id', approval.id);
    return res.status(500).json({ error: 'action_create_failed' });
  }

  await supabase.from('approvals').update({ entity_id: action.id }).eq('id', approval.id);

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'agent_action.proposed',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'agent_action',
    subjectId: action.id,
    payload: { action_type: actionType, origin_surface: 'chat', approval_id: approval.id },
  });

  // The REQUEST is audited even though nothing has changed yet. Asking to
  // delete someone is itself worth a record — and if the request is later
  // rejected, this is the only place that asking survives.
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'propose',
    entityType: 'agent_action',
    entityId: action.id,
    before: null,
    after: { action_type: actionType, target_entity_id: targetEntityId, approval_id: approval.id },
    reason: 'Proposed via Ask GRACE',
    correlationId,
    route: '/api/actions/propose',
    method: 'POST',
  });

  return res.status(201).json({
    status: 'pending_approval',
    action_id: action.id,
    approval_id: approval.id,
    summary: describeProposal(actionType, payload),
  });
}
