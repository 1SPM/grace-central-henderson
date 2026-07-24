/**
 * /api/prayer-requests (staff)
 *
 *   GET   — prayer requests visible to the caller. RLS (migration 043)
 *           already restricts rows to what this specific staff member
 *           is allowed to see by visibility level; care.view is the
 *           floor permission for the private/specific-team tiers, and
 *           church-wall/anonymous-wall tiers are visible to any
 *           authenticated staff member same as any member.
 *   PATCH ?id= — mark answered + optional testimony (care.manage).
 *
 * Auth: Clerk Bearer (or demo bootstrap), care.view / care.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, bool_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UPDATE_SCHEMA = {
  is_answered: bool_(),
  testimony: str({ max: 2000 }),
  status: str({ pattern: /^(active|answered|archived)$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'care.view');
    if (!actor) return;

    const { data, error } = await supabase
      .from('prayer_requests')
      .select('id, person_id, content, visibility, group_id, is_answered, status, crisis_flagged, created_at')
      .eq('church_id', actor.churchId)
      .order('crisis_flagged', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
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

    const { data: before } = await supabase.from('prayer_requests').select('*').eq('id', id).eq('church_id', actor.churchId).maybeSingle();
    if (!before) return res.status(404).json({ error: 'not_found' });

    const { data: after, error } = await supabase
      .from('prayer_requests')
      .update(body)
      .eq('id', id)
      .eq('church_id', actor.churchId)
      .select()
      .single();
    if (error || !after) return res.status(500).json({ error: 'update_failed' });

    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'update',
      entityType: 'prayer_request',
      entityId: id,
      before,
      after,
      route: '/api/prayer-requests',
      method: 'PATCH',
    });

    return res.status(200).json({ request: after });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
