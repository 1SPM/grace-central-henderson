/**
 * /api/care-requests
 *
 *   GET   — list care requests visible to the caller (care.view; RLS
 *           further narrows by visibility — see migration 043).
 *   PATCH ?id= — update status. A crisis-flagged request with
 *           sentinel_review_status='pending' cannot be moved to
 *           resolved/closed until a human clears the review
 *           (sentinel_review_status set to 'cleared' first, via the
 *           same PATCH) — a structural gate, not a suggestion. The
 *           system never clears this itself.
 *
 * Confidential: never exposed to a caller without care.view, regardless
 * of any other role/permission they hold (e.g. work_orders.manage does
 * NOT grant access here).
 *
 * Auth: Clerk Bearer (or demo bootstrap), care.view / care.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { canCloseCareRequest } from '../_lib/careSafety.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STATUS_VALUES = ['submitted', 'triaged', 'assigned', 'in_progress', 'resolved', 'closed'];
const SENTINEL_VALUES = ['not_required', 'pending', 'cleared', 'flagged'];

const UPDATE_SCHEMA = {
  status: str({ pattern: new RegExp(`^(${STATUS_VALUES.join('|')})$`) }),
  sentinel_review_status: str({ pattern: new RegExp(`^(${SENTINEL_VALUES.join('|')})$`) }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'care.view');
    if (!actor) return;

    let query = supabase
      .from('care_requests')
      .select('id, person_id, category, priority, status, visibility, crisis_flagged, sentinel_review_status, preferred_contact_method, requests_human_followup, summary, created_at, updated_at, care_assignments(id, assigned_to_user_id, status)')
      .eq('church_id', actor.churchId)
      .order('crisis_flagged', { ascending: false })
      .order('created_at', { ascending: false });
    if (typeof req.query.status === 'string') query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ requests: data ?? [] });
  }

  if (req.method === 'PATCH') {
    const actor = await requirePermission(req, res, supabase, 'care.manage');
    if (!actor) return;

    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    const body = readBody(req, res, UPDATE_SCHEMA);
    if (!body) return;

    const { data: before } = await supabase.from('care_requests').select('*').eq('id', id).eq('church_id', actor.churchId).maybeSingle();
    if (!before) return res.status(404).json({ error: 'not_found' });

    // Structural crisis-review gate: cannot close/resolve while a human
    // review is still pending. The system never auto-clears this.
    const effectiveSentinelStatus = body.sentinel_review_status ?? before.sentinel_review_status;
    if (body.status && !canCloseCareRequest(body.status, effectiveSentinelStatus)) {
      return res.status(409).json({ error: 'sentinel_review_pending', message: 'This request requires human privacy/safety review before it can be closed.' });
    }

    const update: Record<string, unknown> = { ...body };
    if (body.status && ['resolved', 'closed'].includes(body.status)) {
      update.resolved_at = new Date().toISOString();
      update.resolved_by_user_id = actor.userId;
    }

    const { data: after, error } = await supabase
      .from('care_requests')
      .update(update)
      .eq('id', id)
      .eq('church_id', actor.churchId)
      .select()
      .single();
    if (error || !after) return res.status(500).json({ error: 'update_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'care.request.updated',
      sourceApp: 'admin_dashboard',
      actorUserId: actor.userId,
      subjectType: 'care_request',
      subjectId: id,
      payload: { from_status: before.status, to_status: after.status },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'update',
      entityType: 'care_request',
      entityId: id,
      before,
      after,
      correlationId,
      route: '/api/care-requests',
      method: 'PATCH',
    });

    return res.status(200).json({ request: after });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
