/**
 * /api/work-orders/evidence
 *
 *   POST — attach evidence (file/link/note/validation_result) to a Work
 *          Order or one of its tasks.
 *
 * Auth: Clerk Bearer, work_orders.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CREATE_SCHEMA = {
  work_order_id: uuid_({ required: true }),
  task_id: uuid_(),
  kind: str({ required: true, pattern: /^(file|link|note|validation_result)$/ }),
  url: str({ max: 2000 }),
  content: str({ max: 10000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'work_orders.manage');
  if (!actor) return;

  const body = readBody(req, res, CREATE_SCHEMA);
  if (!body) return;

  const { data: workOrder } = await supabase
    .from('work_orders')
    .select('id')
    .eq('id', body.work_order_id)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (!workOrder) return res.status(404).json({ error: 'work_order_not_found' });

  const { data: evidence, error } = await supabase
    .from('work_order_evidence')
    .insert({
      work_order_id: body.work_order_id,
      task_id: body.task_id ?? null,
      church_id: actor.churchId,
      kind: body.kind,
      url: body.url ?? null,
      content: body.content ?? null,
      submitted_by_user_id: actor.userId,
    })
    .select()
    .single();
  if (error || !evidence) return res.status(500).json({ error: 'create_failed' });

  return res.status(201).json({ evidence });
}
