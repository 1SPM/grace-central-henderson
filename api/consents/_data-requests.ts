/**
 * /api/consents/data-requests
 *
 *   POST — member self-service: submit a data-export or account-
 *          deactivation request.
 *   GET   — staff view of pending/all requests for the church (requires
 *          consent.view). Resolving/completing a request is a manual
 *          operator workflow in this phase — see SHARED_BACKEND.md
 *          "Known gaps" (no automated export/deactivation pipeline yet).
 *
 * Auth: member path via resolveMemberActor; staff path via consent.view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission, resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CREATE_SCHEMA = {
  request_type: str({ required: true, pattern: /^(data_export|account_deactivation)$/ }),
  notes: str({ max: 2000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'POST') {
    const member = await resolveMemberActor(req, res, supabase);
    if (!member) return;

    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;

    const { data: request, error } = await supabase
      .from('data_subject_requests')
      .insert({
        church_id: member.churchId,
        person_id: member.personId,
        request_type: body.request_type,
        notes: body.notes ?? null,
      })
      .select()
      .single();
    if (error || !request) return res.status(500).json({ error: 'create_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'consent.changed',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'data_subject_request',
      subjectId: request.id,
      payload: { request_type: body.request_type },
    });
    await recordAudit(supabase, {
      churchId: member.churchId,
      actorUserId: null,
      actorClerkId: member.clerkUserId,
      action: 'create',
      entityType: 'data_subject_request',
      entityId: request.id,
      after: request,
      sourceApp: 'member_portal',
      reason: 'member self-service',
      correlationId,
      route: '/api/consents/data-requests',
      method: 'POST',
    });

    return res.status(201).json({ request });
  }

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'consent.view');
    if (!actor) return;

    let query = supabase
      .from('data_subject_requests')
      .select('*')
      .eq('church_id', actor.churchId)
      .order('requested_at', { ascending: false })
      .limit(200);
    if (typeof req.query.status === 'string') query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ requests: data ?? [] });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
