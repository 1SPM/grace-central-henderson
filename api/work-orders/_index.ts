/**
 * /api/work-orders
 *
 *   GET   ?id=<uuid>        — fetch a single Work Order (+ tasks, dependencies, evidence)
 *   GET   (no id, filters)  — list Work Orders for the caller's church
 *                             (?status=, ?ministry=, ?owner_user_id=)
 *   POST                    — create a Work Order (status starts 'draft')
 *   PATCH ?id=<uuid>        — update status/fields on an existing Work Order
 *
 * Auth: Clerk Bearer. GET/list requires work_orders.view; POST/PATCH
 * requires work_orders.manage. Staff-only by design — the Members Portal
 * has no path to this route (see migration 034 header).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { applyApprovalPolicy } from '../_lib/workOrderPolicy.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const WORK_ORDER_STATUSES = [
  'draft', 'planning', 'awaiting_approval', 'in_progress',
  'blocked', 'under_review', 'completed', 'cancelled',
] as const;

const STATUS_PATTERN = new RegExp(`^(${WORK_ORDER_STATUSES.join('|')})$`);
const PRIORITY_PATTERN = /^(low|medium|high|urgent)$/;
const SENSITIVITY_PATTERN = /^(public|internal|restricted|confidential)$/;

const CREATE_SCHEMA = {
  title: str({ required: true, min: 1, max: 200 }),
  description: str({ max: 5000 }),
  priority: str({ pattern: PRIORITY_PATTERN }),
  ministry: str({ max: 100 }),
  sensitivity: str({ pattern: SENSITIVITY_PATTERN }),
  owner_user_id: uuid_(),
  due_date: str({ max: 40 }),
};

const UPDATE_SCHEMA = {
  title: str({ max: 200 }),
  description: str({ max: 5000 }),
  status: str({ pattern: STATUS_PATTERN }),
  priority: str({ pattern: PRIORITY_PATTERN }),
  ministry: str({ max: 100 }),
  owner_user_id: uuid_(),
  due_date: str({ max: 40 }),
  deliverable_summary: str({ max: 5000 }),
};

// Structurally valid transitions. Enforced here (not only by the CHECK-free
// status column) so a client can't jump e.g. draft -> completed. 'cancelled'
// is reachable from any non-terminal state. Communications-type Work
// Orders additionally lose the direct planning->in_progress edge — see
// api/_lib/workOrderPolicy.ts applyApprovalPolicy().
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['awaiting_approval', 'in_progress', 'cancelled'],
  awaiting_approval: ['in_progress', 'planning', 'cancelled'],
  in_progress: ['blocked', 'under_review', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  under_review: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'work_orders.view');
    if (!actor) return;

    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    if (id) {
      const { data: workOrder, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', id)
        .eq('church_id', actor.churchId)
        .maybeSingle();
      if (error) return res.status(500).json({ error: 'read_failed' });
      if (!workOrder) return res.status(404).json({ error: 'not_found' });

      const [{ data: tasks }, { data: dependencies }, { data: evidence }] = await Promise.all([
        supabase.from('work_order_tasks').select('*').eq('work_order_id', id).order('position'),
        supabase.from('work_order_dependencies').select('*').eq('work_order_id', id),
        supabase.from('work_order_evidence').select('*').eq('work_order_id', id).order('created_at'),
      ]);

      return res.status(200).json({
        work_order: workOrder,
        tasks: tasks ?? [],
        dependencies: dependencies ?? [],
        evidence: evidence ?? [],
      });
    }

    let query = supabase
      .from('work_orders')
      .select('*')
      .eq('church_id', actor.churchId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (typeof req.query.status === 'string') query = query.eq('status', req.query.status);
    if (typeof req.query.ministry === 'string') query = query.eq('ministry', req.query.ministry);
    if (typeof req.query.owner_user_id === 'string') query = query.eq('owner_user_id', req.query.owner_user_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ work_orders: data ?? [] });
  }

  if (req.method === 'POST') {
    const actor = await requirePermission(req, res, supabase, 'work_orders.manage');
    if (!actor) return;

    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert({
        church_id: actor.churchId,
        title: body.title,
        description: body.description ?? null,
        priority: body.priority ?? 'medium',
        ministry: body.ministry ?? null,
        sensitivity: body.sensitivity ?? 'internal',
        owner_user_id: body.owner_user_id ?? actor.userId,
        requested_by_user_id: actor.userId,
        due_date: body.due_date ?? null,
      })
      .select()
      .single();

    if (error || !workOrder) {
      console.error('[work-orders] create failed', error);
      return res.status(500).json({ error: 'create_failed' });
    }

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'work_order.created',
      sourceApp: 'admin_dashboard',
      actorUserId: actor.userId,
      subjectType: 'work_order',
      subjectId: workOrder.id,
      payload: { title: workOrder.title, status: workOrder.status },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'create',
      entityType: 'work_order',
      entityId: workOrder.id,
      after: workOrder,
      correlationId,
      route: '/api/work-orders',
      method: 'POST',
    });

    return res.status(201).json({ work_order: workOrder, correlation_id: correlationId });
  }

  if (req.method === 'PATCH') {
    const actor = await requirePermission(req, res, supabase, 'work_orders.manage');
    if (!actor) return;

    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    const body = readBody(req, res, UPDATE_SCHEMA);
    if (!body) return;

    const { data: existing, error: fetchErr } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .eq('church_id', actor.churchId)
      .maybeSingle();
    if (fetchErr) return res.status(500).json({ error: 'read_failed' });
    if (!existing) return res.status(404).json({ error: 'not_found' });

    if (body.status && body.status !== existing.status) {
      const baseAllowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      const allowed = applyApprovalPolicy(baseAllowed, { ministry: existing.ministry, metadata: existing.metadata }, existing.status);
      if (!allowed.includes(body.status)) {
        return res.status(409).json({
          error: 'invalid_status_transition',
          from: existing.status,
          to: body.status,
          allowed,
          ...(baseAllowed.includes(body.status) && !allowed.includes(body.status)
            ? { reason: 'communications_work_orders_require_approval' }
            : {}),
        });
      }
    }

    const update: Record<string, unknown> = { ...body };
    if (body.status === 'in_progress' && !existing.started_at) update.started_at = new Date().toISOString();
    if (body.status === 'completed') update.completed_at = new Date().toISOString();
    if (body.status === 'cancelled') update.cancelled_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('work_orders')
      .update(update)
      .eq('id', id)
      .eq('church_id', actor.churchId)
      .select()
      .single();
    if (error || !updated) return res.status(500).json({ error: 'update_failed' });

    // Auto-resolve hook: any agent_finding this Work Order was converted
    // from ('actioned' → linked via work_order_id) flips to 'resolved'
    // without manual action once the Work Order itself completes.
    if (body.status === 'completed') {
      const { data: linkedFindings } = await supabase
        .from('agent_findings')
        .select('id')
        .eq('work_order_id', id)
        .eq('status', 'actioned');
      if (linkedFindings && linkedFindings.length > 0) {
        const resolvedAt = new Date().toISOString();
        await supabase
          .from('agent_findings')
          .update({ status: 'resolved', resolved_at: resolvedAt, updated_at: resolvedAt })
          .eq('work_order_id', id)
          .eq('status', 'actioned');
        for (const finding of linkedFindings) {
          await emitPlatformEvent(supabase, {
            churchId: actor.churchId,
            eventType: 'agent_finding.resolved',
            sourceApp: 'admin_dashboard',
            actorUserId: actor.userId,
            subjectType: 'agent_finding',
            subjectId: finding.id,
            payload: { work_order_id: id, trigger: 'work_order_completed' },
          });
        }
      }
    }

    let correlationId: string | undefined;
    if (body.status && body.status !== existing.status) {
      const emitted = await emitPlatformEvent(supabase, {
        churchId: actor.churchId,
        eventType: body.status === 'completed' ? 'work_order.completed' : 'work_order.status_changed',
        sourceApp: 'admin_dashboard',
        actorUserId: actor.userId,
        subjectType: 'work_order',
        subjectId: id,
        payload: { from: existing.status, to: body.status },
      });
      correlationId = emitted.correlationId;
    }
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'update',
      entityType: 'work_order',
      entityId: id,
      before: existing,
      after: updated,
      correlationId,
      route: '/api/work-orders',
      method: 'PATCH',
    });

    return res.status(200).json({ work_order: updated });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
