/**
 * POST /api/actions/execute
 *
 * Runs a catalog action that does NOT require approval — server-side, with a
 * permission check and an audit row.
 *
 * WHY THIS EXISTS (TD-061, second half)
 *
 * `delete_task`, `delete_prayer` and `send_email` stay one-click by product
 * decision: gating them would add the friction of an approval to actions
 * whose worst case is an annoyance, not a loss. What was not defensible was
 * that they left no append-only record.
 *
 * They did leave an Interaction note on the affected person, attributed to
 * Grace. That is real, and it is what a pastor actually reads — but it is
 * ordinary product data: editable, deletable, and gone with the person. It
 * answers "what happened to this member", not "who did this and when", which
 * is the question an audit trail exists for.
 *
 * The mutation had to move here to fix that. A client that performs its own
 * delete and then reports it for auditing is not audited: the report can be
 * skipped, altered, or simply lost when the tab closes, and nothing
 * downstream can tell the difference.
 *
 * RELATIONSHIP TO /api/actions/propose
 *
 * Same catalog, same executor registry, opposite halves of one rule: propose
 * handles `requiresApproval: true`, this handles `false`. Each refuses the
 * other's actions outright rather than quietly doing the wrong thing —
 * executing something that should have waited for a pastor is the failure
 * worth engineering against.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { findAction } from '../_lib/actionCatalog.js';
import { executeAgentAction, isExecutableActionType, auditActionFor } from '../_lib/agentActionExecutors.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXECUTE_SCHEMA = {
  action_type: str({ required: true, max: 64 }),
  target_entity_id: uuid_({ required: true }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const parsed = readBody(req, res, EXECUTE_SCHEMA);
  if (!parsed) return;  // 400 already sent
  const actionType = parsed.action_type as string;
  const targetEntityId = parsed.target_entity_id as string;

  const definition = findAction(actionType);
  if (!definition) return res.status(400).json({ error: 'unknown_action_type' });

  // The gate that matters most in this file. An action the catalog says
  // needs a human decision must never be run here, whatever the caller asks
  // for — that would route straight around the approvals lifecycle.
  if (definition.requiresApproval) {
    return res.status(400).json({ error: 'action_requires_approval', propose_at: '/api/actions/propose' });
  }
  if (!isExecutableActionType(actionType)) {
    // A catalog action with no executor cannot be run server-side. Refusing
    // is better than silently returning success for nothing.
    return res.status(400).json({ error: 'action_not_directly_executable' });
  }
  if (!definition.permission) return res.status(500).json({ error: 'action_has_no_permission' });

  const actor = await requirePermission(req, res, supabase, definition.permission);
  if (!actor) return;

  const rawPayload = (req.body as Record<string, unknown> | undefined)?.payload;
  const payload = (rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload))
    ? rawPayload as Record<string, unknown>
    : {};

  // A synthetic action row. There is no persisted `agent_actions` record for
  // an immediate execution — nothing proposed it — so `id` is generated for
  // correlation only and is never written anywhere.
  //
  // This is why an executor for a non-gated action MUST NOT depend on
  // action.id being a real row (assign_work_order_owner does, which is
  // precisely why it is gated and cannot reach this endpoint).
  const correlationId = randomUUID();
  const outcome = await executeAgentAction(supabase, {
    id: correlationId,
    church_id: actor.churchId,
    action_type: actionType,
    target_entity_type: definition.group === 'send' ? 'person' : null,
    target_entity_id: targetEntityId,
    payload,
  }, {
    approvalId: '',              // no approval — this action does not need one
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    correlationId,
    reason: 'Executed via Ask GRACE',
    sourceApp: 'admin_dashboard',
    route: '/api/actions/execute',
    method: 'POST',
    executedAt: new Date().toISOString(),
  });

  if (!outcome.ok) {
    // A refusal is reported, never swallowed: the chat card must not read as
    // done when the row was already gone or the precondition failed.
    return res.status(409).json({ status: 'failed', reason: outcome.reason });
  }

  await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'action.executed',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: definition.group === 'delete' ? 'deletion' : 'action',
    subjectId: targetEntityId,
    correlationId,
    payload: { action_type: actionType, origin_surface: 'chat' },
  });

  let auditIncomplete = false;
  if (outcome.mutation && !outcome.committedStatusAndAudit) {
    const audit = await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: auditActionFor(outcome.mutation),
      entityType: outcome.mutation.entityType,
      entityId: outcome.mutation.entityId,
      before: outcome.mutation.before,
      after: outcome.mutation.after,
      reason: 'Executed via Ask GRACE',
      correlationId,
      route: '/api/actions/execute',
      method: 'POST',
    });
    // The change is committed; the trail is not. Say so rather than
    // returning a clean success — this endpoint exists to produce that trail,
    // so silence here would defeat its only purpose.
    auditIncomplete = !audit.ok;
  }

  return res.status(200).json({
    status: 'executed',
    detail: outcome.detail,
    ...(auditIncomplete ? { audit_incomplete: true } : {}),
  });
}
