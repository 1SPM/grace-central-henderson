/**
 * POST /api/work-orders/create-from-template
 *
 * Instantiates one of the named Work Order templates from
 * api/_lib/workOrderTemplates.ts (onboarding_campaign, support_escalation,
 * reconciliation_exception, impact_card_communications,
 * monthly_leadership_reporting) as a real work_orders row plus its
 * work_order_tasks checklist. Mirrors the shape of the existing
 * api/work-orders/_pilot-readiness.ts demonstration endpoint, which remains
 * the entry point for the sixth named type (pilot-readiness review).
 *
 * Body: { template: WorkOrderTemplateKey, owner_user_id?: string, due_date?: string }
 *
 * Auth: Clerk Bearer (or demo bootstrap), work_orders.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { getWorkOrderTemplate } from '../_lib/workOrderTemplates.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BODY_SCHEMA = {
  template: str({ required: true, max: 60 }),
  owner_user_id: uuid_(),
  due_date: str({ max: 40 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'work_orders.manage');
  if (!actor) return;

  const body = readBody(req, res, BODY_SCHEMA);
  if (!body) return;

  const template = getWorkOrderTemplate(body.template);
  if (!template) {
    return res.status(400).json({ error: 'unknown_template', template: body.template });
  }

  const { data: workOrder, error: woErr } = await supabase
    .from('work_orders')
    .insert({
      church_id: actor.churchId,
      title: template.title,
      description: template.description,
      status: 'planning',
      priority: template.priority,
      ministry: template.ministry,
      sensitivity: template.sensitivity,
      metadata: template.metadata ?? {},
      owner_user_id: body.owner_user_id ?? actor.userId,
      requested_by_user_id: actor.userId,
      due_date: body.due_date ?? null,
    })
    .select()
    .single();
  if (woErr || !workOrder) {
    console.error('[work-orders/create-from-template] work order create failed', woErr);
    return res.status(500).json({ error: 'create_failed' });
  }

  const { data: tasks, error: taskErr } = await supabase
    .from('work_order_tasks')
    .insert(
      template.tasks.map((t, i) => ({
        work_order_id: workOrder.id,
        church_id: actor.churchId,
        title: t.title,
        description: t.description,
        status: 'pending',
        priority: 'medium',
        position: i,
      })),
    )
    .select();
  if (taskErr) {
    console.error('[work-orders/create-from-template] task create failed', taskErr);
    return res.status(500).json({ error: 'tasks_create_failed', work_order: workOrder });
  }

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'work_order.created',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'work_order',
    subjectId: workOrder.id,
    payload: { title: workOrder.title, task_count: tasks?.length ?? 0, template: template.key },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'create',
    entityType: 'work_order',
    entityId: workOrder.id,
    after: { work_order: workOrder, task_count: tasks?.length ?? 0, template: template.key },
    correlationId,
    route: '/api/work-orders/create-from-template',
    method: 'POST',
  });

  return res.status(201).json({ work_order: workOrder, tasks: tasks ?? [] });
}
