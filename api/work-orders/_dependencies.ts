/**
 * /api/work-orders/dependencies
 *
 *   POST — link two Work Orders (work_order_id depends on depends_on_work_order_id)
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
  depends_on_work_order_id: uuid_({ required: true }),
  dependency_type: str({ pattern: /^(blocks|relates_to)$/ }),
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

  if (body.work_order_id === body.depends_on_work_order_id) {
    return res.status(400).json({ error: 'self_dependency_not_allowed' });
  }

  const { data: both } = await supabase
    .from('work_orders')
    .select('id')
    .eq('church_id', actor.churchId)
    .in('id', [body.work_order_id, body.depends_on_work_order_id]);
  if (!both || both.length !== 2) return res.status(404).json({ error: 'work_order_not_found' });

  const { data: dependency, error } = await supabase
    .from('work_order_dependencies')
    .insert({
      work_order_id: body.work_order_id,
      depends_on_work_order_id: body.depends_on_work_order_id,
      dependency_type: body.dependency_type ?? 'blocks',
    })
    .select()
    .single();
  if (error || !dependency) {
    if (error?.code === '23505') return res.status(409).json({ error: 'dependency_already_exists' });
    return res.status(500).json({ error: 'create_failed' });
  }

  return res.status(201).json({ dependency });
}
