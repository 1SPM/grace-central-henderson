/**
 * PATCH /api/community/moderate?id=<post_id>
 *
 * Staff moderation decision on a community post: approve, reject, or
 * remove (a previously-approved post taken down after the fact).
 * Resolving a report also marks it reviewed.
 *
 * Auth: Clerk Bearer (or demo bootstrap), communications.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  decision: str({ required: true, pattern: /^(approved|rejected|removed)$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'communications.manage');
  if (!actor) return;

  const id = typeof req.query.id === 'string' ? req.query.id : undefined;
  if (!id) return res.status(400).json({ error: 'missing_id' });

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const { data: before } = await supabase.from('community_posts').select('*').eq('id', id).eq('church_id', actor.churchId).maybeSingle();
  if (!before) return res.status(404).json({ error: 'not_found' });

  const update: Record<string, unknown> = {
    moderation_status: body.decision,
    moderated_by_user_id: actor.userId,
    moderated_at: new Date().toISOString(),
  };
  if (body.decision === 'removed') update.deleted_at = new Date().toISOString();

  const { data: after, error } = await supabase
    .from('community_posts')
    .update(update)
    .eq('id', id)
    .eq('church_id', actor.churchId)
    .select()
    .single();
  if (error || !after) return res.status(500).json({ error: 'update_failed' });

  await supabase
    .from('community_post_reports')
    .update({ status: 'reviewed', reviewed_by_user_id: actor.userId })
    .eq('post_id', id)
    .eq('status', 'pending');

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'community.post.moderated',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'community_post',
    subjectId: id,
    payload: { decision: body.decision },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'moderate',
    entityType: 'community_post',
    entityId: id,
    before,
    after,
    correlationId,
    route: '/api/community/moderate',
    method: 'PATCH',
  });

  return res.status(200).json({ post: after });
}
