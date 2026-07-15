/**
 * POST /api/work-orders/pilot-readiness
 *
 * The one functioning demonstration named in the WorkOS spec: "GRACE
 * Impact Card Pilot Readiness." Creates one real work_orders row and ten
 * real work_order_tasks rows covering the readiness checklist for a
 * 1,000-member pilot. From here the Work Order behaves exactly like any
 * other Work Order — status transitions, evidence, approval requests, and
 * the completion report (api/work-orders/_completion-report.ts) all go
 * through the same general-purpose endpoints.
 *
 * This endpoint does NOT connect to, call, or simulate any live financial
 * provider (Stripe, i2c, etc.) — it only creates planning/tracking
 * records. See TECH_DEBT.md for what's genuinely wired vs. not.
 *
 * Auth: Clerk Bearer (or demo bootstrap), work_orders.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const PILOT_TASKS: { title: string; description: string }[] = [
  {
    title: 'Document inventory',
    description: 'Catalog every existing document (policies, vendor agreements, prior audits) relevant to Impact Card operations before the pilot.',
  },
  {
    title: 'Product readiness',
    description: 'Confirm which Impact Card features are genuinely production-ready today vs. still demo/sandbox-only, and document the gap.',
  },
  {
    title: 'Financial assumptions',
    description: 'Document the assumptions behind pilot-scale volume, fee, and reconciliation projections. Does not require a live financial-provider connection to complete.',
  },
  {
    title: 'Member onboarding',
    description: 'Define the onboarding flow and consent capture for the first 1,000 pilot members.',
  },
  {
    title: 'Communication planning',
    description: 'Plan the announcement, training, and support-communications sequence for pilot members and staff.',
  },
  {
    title: 'Privacy review',
    description: 'Confirm consent capture, data minimization, and retention posture for pilot participant data.',
  },
  {
    title: 'Risk review',
    description: 'Identify and document operational, financial, and reputational risks specific to a 1,000-member pilot scale.',
  },
  {
    title: 'KPI definition',
    description: 'Define the success metrics the pilot will be measured against before it starts, not after.',
  },
  {
    title: 'Launch checklist',
    description: 'Compile the go/no-go checklist covering every prior task in this Work Order.',
  },
  {
    title: 'Independent validation',
    description: 'An independent reviewer (not the task owner) confirms each prior task before the Work Order can be marked complete.',
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'work_orders.manage');
  if (!actor) return;

  const { data: workOrder, error: woErr } = await supabase
    .from('work_orders')
    .insert({
      church_id: actor.churchId,
      title: 'GRACE Impact Card Pilot Readiness — 1,000-Member Pilot',
      description:
        'Readiness checklist for a 1,000-member Impact Card pilot. Planning and tracking only — ' +
        'does not itself connect to any live financial provider. Each task tracks its own evidence ' +
        'and this Work Order requires approval before it can be marked complete.',
      status: 'planning',
      priority: 'high',
      ministry: 'Impact Card Operations',
      sensitivity: 'restricted',
      owner_user_id: actor.userId,
      requested_by_user_id: actor.userId,
    })
    .select()
    .single();
  if (woErr || !workOrder) {
    console.error('[work-orders/pilot-readiness] work order create failed', woErr);
    return res.status(500).json({ error: 'create_failed' });
  }

  const { data: tasks, error: taskErr } = await supabase
    .from('work_order_tasks')
    .insert(
      PILOT_TASKS.map((t, i) => ({
        work_order_id: workOrder.id,
        church_id: actor.churchId,
        title: t.title,
        description: t.description,
        status: 'pending',
        priority: i === PILOT_TASKS.length - 1 ? 'high' : 'medium', // independent validation is high-priority by design
        position: i,
      })),
    )
    .select();
  if (taskErr) {
    console.error('[work-orders/pilot-readiness] task create failed', taskErr);
    return res.status(500).json({ error: 'tasks_create_failed', work_order: workOrder });
  }

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'work_order.created',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'work_order',
    subjectId: workOrder.id,
    payload: { title: workOrder.title, task_count: tasks?.length ?? 0, demonstration: 'impact_card_pilot_readiness' },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'create',
    entityType: 'work_order',
    entityId: workOrder.id,
    after: { work_order: workOrder, task_count: tasks?.length ?? 0 },
    correlationId,
    route: '/api/work-orders/pilot-readiness',
    method: 'POST',
  });

  return res.status(201).json({ work_order: workOrder, tasks: tasks ?? [] });
}
