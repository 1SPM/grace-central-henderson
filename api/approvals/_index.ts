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
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { executeAgentAction } from '../_lib/agentActionExecutors.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, bool_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DECISIONS = ['approve', 'approve_with_changes', 'return_for_revision', 'reject', 'escalate'] as const;

/**
 * The `reason` recorded on an agent-driven change's audit row.
 *
 * The actor on that row is the human who decided, which is correct — but
 * "who proposed this" is the other half of the story, and the only place
 * it survives for a reader of the Work Order's own history.
 */
function agentAuditReason(requestedByAgent: unknown): string {
  return typeof requestedByAgent === 'string' && requestedByAgent
    ? `Agent proposal approved (proposed by ${requestedByAgent})`
    : 'Agent proposal approved';
}

const DECIDE_SCHEMA = {
  decision: str({ required: true, pattern: new RegExp(`^(${DECISIONS.join('|')})$`) }),
  decision_notes: str({ max: 5000 }),
};

const REVIEW_SCHEMA = {
  mark_related_party_reviewed: bool_({ required: true }),
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

    // Related-party review is a separate, narrower action (still gated on
    // approvals.decide) from deciding the approval itself — a flagged
    // approval can be reviewed and cleared for disclosure purposes
    // independent of whether it's been approved/rejected yet.
    if (req.body && typeof req.body === 'object' && 'mark_related_party_reviewed' in (req.body as Record<string, unknown>)) {
      const reviewBody = readBody(req, res, REVIEW_SCHEMA);
      if (!reviewBody) return;

      const { data: existing, error: fetchErr } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', id)
        .eq('church_id', actor.churchId)
        .maybeSingle();
      if (fetchErr) return res.status(500).json({ error: 'read_failed' });
      if (!existing) return res.status(404).json({ error: 'not_found' });

      const { data: approval, error } = await supabase
        .from('approvals')
        .update({
          related_party_reviewed_by_user_id: actor.userId,
          related_party_reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('church_id', actor.churchId)
        .select()
        .single();
      if (error || !approval) return res.status(500).json({ error: 'update_failed' });

      const { correlationId } = await emitPlatformEvent(supabase, {
        churchId: actor.churchId,
        eventType: 'approval.related_party_reviewed',
        sourceApp: 'admin_dashboard',
        actorUserId: actor.userId,
        subjectType: 'approval',
        subjectId: id,
        payload: {},
      });
      await recordAudit(supabase, {
        churchId: actor.churchId,
        actorUserId: actor.userId,
        actorClerkId: actor.clerkUserId,
        action: 'update',
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
    // C-13: the approval gate is a second pair of eyes, so the person who
    // asked for the change cannot be the one who approves it. Only favourable
    // decisions are held back — withdrawing or escalating your own request is
    // fine — and agent proposals carry no human requester, so are unaffected.
    if (existing.requested_by_user_id && existing.requested_by_user_id === actor.userId
        && ['approve', 'approve_with_changes'].includes(body.decision)) {
      return res.status(403).json({ error: 'self_approval' });
    }

    const decidedAt = new Date().toISOString();
    // Conditional on status='pending', not just id: the check above and
    // this write are not atomic together, so two concurrent PATCHes could
    // both pass it. Losing the race must mean losing the decision — and,
    // more importantly, not running the executor a second time.
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
      .eq('status', 'pending')
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'update_failed' });
    if (!approval) return res.status(409).json({ error: 'already_decided' });

    // An agent-proposed action is carried out here and nowhere else: the
    // agent only recorded a proposal, and this decision is the one thing
    // that can turn it into a change. A favourable decision runs the
    // registered executor; anything else marks the action rejected so it
    // stops reading as outstanding. An execution failure is recorded as
    // 'failed' with a reason rather than swallowed — an approved action
    // that silently did nothing is the worst outcome for a decision-maker.
    let agentAction: { action_id: string; status: string; reason?: string } | null = null;
    // Set only when this endpoint still OWES an audit row for the change.
    // An atomic executor (migration 070) already wrote its own inside the
    // mutation's transaction; writing a second here would double-record
    // one change.
    let agentMutation: import('../_lib/agentActionExecutors.js').ExecutorMutation | null = null;

    // Generated up front, not after the fact: an atomic executor writes its
    // audit row before this handler emits the decision's platform event, and
    // both must carry the same id or the chain cannot be queried as one.
    const correlationId = randomUUID();

    if (approval.entity_type === 'agent_action' && approval.entity_id) {
      const favorable = ['approve', 'approve_with_changes'].includes(body.decision);
      const { data: action, error: actionReadErr } = await supabase
        .from('agent_actions')
        .select('id, church_id, action_type, target_entity_type, target_entity_id, payload, status, approval_id, requires_approval')
        .eq('id', approval.entity_id)
        .eq('church_id', actor.churchId)
        .maybeSingle();
      if (actionReadErr) return res.status(500).json({ error: 'agent_action_read_failed' });

      // Only act on an action that actually points back at THIS approval.
      // Without it, a mis-linked row (see the run endpoint's partial-failure
      // path) could be executed under an approval that was never its own —
      // and the 035 CHECK would then reject the status write silently.
      const linked = action
        && action.status === 'proposed'
        && (!action.requires_approval || action.approval_id === approval.id);

      if (action && linked) {
        if (!favorable) {
          const { error } = await supabase.from('agent_actions').update({ status: 'rejected' })
            .eq('id', action.id).eq('church_id', actor.churchId).eq('status', 'proposed');
          agentAction = error
            ? { action_id: action.id, status: 'failed', reason: 'reject_write_failed' }
            : { action_id: action.id, status: 'rejected' };
        } else {
          const outcome = await executeAgentAction(supabase, action, {
            approvalId: approval.id,
            actorUserId: actor.userId,
            actorClerkId: actor.clerkUserId,
            correlationId,
            // The deciding human is the actor; this names who proposed it.
            reason: agentAuditReason(approval.requested_by_agent),
            sourceApp: 'admin_dashboard',
            route: '/api/approvals',
            method: 'PATCH',
            executedAt: decidedAt,
          });

          if (outcome.ok && outcome.committedStatusAndAudit) {
            // The mutation, the status write and the audit row committed
            // together. Repeating either here would undo the point of it
            // and double-record the change — so this branch writes nothing.
            agentAction = { action_id: action.id, status: 'executed' };
          } else {
            // Conditional on status='proposed' so a concurrent decision
            // cannot double-write, and the error is checked: an approved
            // action whose status write failed must not be reported as done.
            const { data: written, error: writeErr } = await supabase
              .from('agent_actions')
              .update({
                status: outcome.ok ? 'executed' : 'failed',
                executed_at: outcome.ok ? decidedAt : null,
              })
              .eq('id', action.id)
              .eq('church_id', actor.churchId)
              .eq('status', 'proposed')
              .select('id')
              .maybeSingle();
            if (writeErr || !written) {
              agentAction = { action_id: action.id, status: 'failed', reason: 'status_write_failed' };
            } else if (outcome.ok) {
              agentAction = { action_id: action.id, status: 'executed' };
              agentMutation = outcome.mutation ?? null;
            } else {
              agentAction = { action_id: action.id, status: 'failed', reason: outcome.reason };
            }
          }
        }
      }
    }

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

    await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'approval.decided',
      sourceApp: 'admin_dashboard',
      actorUserId: actor.userId,
      subjectType: 'approval',
      subjectId: id,
      correlationId,
      payload: { decision: body.decision, work_order_id: approval.work_order_id, agent_action: agentAction },
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

    // The decision audit above records that a decision was made. This one
    // records what it CHANGED, against the entity that changed — so an
    // agent-driven write shows up in the Work Order's own history like
    // every other write to it, rather than only in an approvals row a
    // reader would have to know to look for. Same correlationId as the
    // decision and the platform event, so the whole chain is one query.
    //
    // Reached only for a NON-atomic executor. An atomic one (migration
    // 070) wrote this row inside the mutation's own transaction, which is
    // why `agentMutation` is left null in that path — the guarantee there
    // is not "we tried to audit it" but "it could not have committed
    // unaudited", and this fallback must not double-write on top of it.
    let auditIncomplete = false;
    if (agentMutation) {
      const mutationAudit = await recordAudit(supabase, {
        churchId: actor.churchId,
        actorUserId: actor.userId,
        actorClerkId: actor.clerkUserId,
        action: 'update',
        entityType: agentMutation.entityType,
        entityId: agentMutation.entityId,
        before: agentMutation.before,
        after: agentMutation.after,
        reason: agentAuditReason(approval.requested_by_agent),
        correlationId,
        route: '/api/approvals',
        method: 'PATCH',
      });
      // The change is committed; the trail is not. Say so rather than
      // returning a clean success — this is the one path where an agent
      // altered church data, and "we changed it but cannot prove what"
      // is exactly what a decision-maker needs to hear immediately.
      auditIncomplete = !mutationAudit.ok;
    }

    return res.status(200).json({
      approval,
      agent_action: agentAction,
      ...(auditIncomplete ? { audit_incomplete: true } : {}),
    });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
