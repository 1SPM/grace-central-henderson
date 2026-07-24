/**
 * /api/work-orders/tasks
 *
 *   GET   — list tasks across all Work Orders for the church (Task Board),
 *           optionally filtered by ?work_order_id= or ?status=
 *   POST  — add a task to a Work Order
 *   PATCH ?id=<uuid> — update a task (status/owner/etc.)
 *
 * Auth: Clerk Bearer. GET requires work_orders.view; POST/PATCH require
 * work_orders.manage (task-board status drags, reassignment, and
 * evidence all count as "manage").
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { readBody, str, uuid_, int_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TASK_STATUS_PATTERN = /^(pending|in_progress|blocked|under_review|completed|cancelled)$/;
const PRIORITY_PATTERN = /^(low|medium|high|urgent)$/;

const CREATE_SCHEMA = {
  work_order_id: uuid_({ required: true }),
  title: str({ required: true, min: 1, max: 200 }),
  description: str({ max: 5000 }),
  priority: str({ pattern: PRIORITY_PATTERN }),
  owner_user_id: uuid_(),
  due_date: str({ max: 40 }),
  position: int_({ min: 0, max: 100000 }),
};

const UPDATE_SCHEMA = {
  title: str({ max: 200 }),
  description: str({ max: 5000 }),
  status: str({ pattern: TASK_STATUS_PATTERN }),
  priority: str({ pattern: PRIORITY_PATTERN }),
  owner_user_id: uuid_(),
  due_date: str({ max: 40 }),
  position: int_({ min: 0, max: 100000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'work_orders.view');
    if (!actor) return;

    let query = supabase
      .from('work_order_tasks')
      .select('*, work_orders!inner(id, title, church_id)')
      .eq('work_orders.church_id', actor.churchId)
      .order('position');
    if (typeof req.query.work_order_id === 'string') query = query.eq('work_order_id', req.query.work_order_id);
    if (typeof req.query.status === 'string') query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ tasks: data ?? [] });
  }

  const actor = await requirePermission(req, res, supabase, 'work_orders.manage');
  if (!actor) return;

  if (req.method === 'POST') {
    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;

    const { data: workOrder } = await supabase
      .from('work_orders')
      .select('id')
      .eq('id', body.work_order_id)
      .eq('church_id', actor.churchId)
      .maybeSingle();
    if (!workOrder) return res.status(404).json({ error: 'work_order_not_found' });

    const { data: task, error } = await supabase
      .from('work_order_tasks')
      .insert({
        work_order_id: body.work_order_id,
        church_id: actor.churchId,
        title: body.title,
        description: body.description ?? null,
        priority: body.priority ?? 'medium',
        owner_user_id: body.owner_user_id ?? null,
        due_date: body.due_date ?? null,
        position: body.position ?? 0,
      })
      .select()
      .single();
    if (error || !task) return res.status(500).json({ error: 'create_failed' });

    return res.status(201).json({ task });
  }

  if (req.method === 'PATCH') {
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    const body = readBody(req, res, UPDATE_SCHEMA);
    if (!body) return;

    const update: Record<string, unknown> = { ...body };
    if (body.status === 'completed') update.completed_at = new Date().toISOString();

    const { data: task, error } = await supabase
      .from('work_order_tasks')
      .update(update)
      .eq('id', id)
      .eq('church_id', actor.churchId)
      .select()
      .single();
    if (error || !task) return res.status(404).json({ error: 'not_found' });

    return res.status(200).json({ task });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
