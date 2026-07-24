/**
 * POST /api/care-requests/assign
 *
 * Assigns a care request to an authorized human staff member. This is
 * the ONLY way a care_requests row gets a care_assignments row — the
 * system never self-assigns. Also moves the request's status to
 * 'assigned' if it was 'submitted' or 'triaged'.
 *
 * Auth: Clerk Bearer (or demo bootstrap), care.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, uuid_, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  care_request_id: uuid_({ required: true }),
  assigned_to_user_id: uuid_({ required: true }),
  role_in_case: str({ pattern: /^(primary|secondary|observer)$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'care.manage');
  if (!actor) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const { data: careRequest } = await supabase
    .from('care_requests')
    .select('id, status')
    .eq('id', body.care_request_id)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (!careRequest) return res.status(404).json({ error: 'care_request_not_found' });

  const { data: assignee } = await supabase
    .from('users')
    .select('id, account_status')
    .eq('id', body.assigned_to_user_id)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (!assignee || assignee.account_status !== 'active') return res.status(404).json({ error: 'assignee_not_found_or_inactive' });

  const { data: assignment, error } = await supabase
    .from('care_assignments')
    .insert({
      care_request_id: body.care_request_id,
      church_id: actor.churchId,
      assigned_to_user_id: body.assigned_to_user_id,
      assigned_by_user_id: actor.userId,
      role_in_case: body.role_in_case ?? 'primary',
    })
    .select()
    .single();
  if (error || !assignment) return res.status(500).json({ error: 'assign_failed' });

  if (['submitted', 'triaged'].includes(careRequest.status)) {
    await supabase.from('care_requests').update({ status: 'assigned' }).eq('id', body.care_request_id);
  }

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'care.request.updated',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'care_request',
    subjectId: body.care_request_id,
    payload: { assigned_to_user_id: body.assigned_to_user_id },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'assign',
    entityType: 'care_request',
    entityId: body.care_request_id,
    after: { assigned_to_user_id: body.assigned_to_user_id, role_in_case: assignment.role_in_case },
    correlationId,
    route: '/api/care-requests/assign',
    method: 'POST',
  });

  return res.status(201).json({ assignment });
}
