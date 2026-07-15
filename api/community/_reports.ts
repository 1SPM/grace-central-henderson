/**
 * /api/community/reports
 *
 *   POST — a member reports a post (resolveMemberActor). One report per
 *          (post, reporter) — a second attempt is a no-op, not an error.
 *   GET   — staff view of pending reports (communications.manage).
 *
 * Prerequisite infrastructure for community posting per this phase's
 * scope: the Members Portal posting composer is NOT enabled yet (see
 * PortalCommunity.tsx's "coming soon" notice) — this route exists so
 * moderation/reporting/blocking are real and tested BEFORE any posting
 * UI ships, per the explicit "implement only after" ordering.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor, requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REPORT_SCHEMA = {
  post_id: uuid_({ required: true }),
  reason: str({ max: 500 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'communications.manage');
    if (!actor) return;

    const { data, error } = await supabase
      .from('community_post_reports')
      .select('id, post_id, reported_by_person_id, reason, status, created_at')
      .eq('church_id', actor.churchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ reports: data ?? [] });
  }

  if (req.method === 'POST') {
    const member = await resolveMemberActor(req, res, supabase);
    if (!member) return;

    const body = readBody(req, res, REPORT_SCHEMA);
    if (!body) return;

    const { data: post } = await supabase.from('community_posts').select('id').eq('id', body.post_id).eq('church_id', member.churchId).maybeSingle();
    if (!post) return res.status(404).json({ error: 'post_not_found' });

    const { data: report, error } = await supabase
      .from('community_post_reports')
      .upsert(
        { church_id: member.churchId, post_id: body.post_id, reported_by_person_id: member.personId, reason: body.reason ?? null },
        { onConflict: 'post_id,reported_by_person_id' },
      )
      .select()
      .single();
    if (error || !report) return res.status(500).json({ error: 'report_failed' });

    await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'community.post.reported',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'community_post',
      subjectId: body.post_id,
      payload: { report_id: report.id },
    });

    return res.status(201).json({ report });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
