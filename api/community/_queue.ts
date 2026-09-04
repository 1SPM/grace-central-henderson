/**
 * GET /api/community/queue
 *
 * The staff moderation queue TD-051 asked for: community_post_reports
 * and community_posts.moderation_status are real, RLS-enforced, and
 * tested, but until now nothing surfaced them together as one worklist —
 * api/community/_reports.ts lists open reports, api/community/_moderate.ts
 * acts on a post, and nothing listed posts awaiting their FIRST review.
 *
 * Returns two lists:
 *   pending  — posts with moderation_status='pending' (never reviewed),
 *              oldest first so the queue drains in submission order.
 *   reported — approved posts with at least one open (status='pending')
 *              report, newest report first, with the report count and
 *              reasons attached so a moderator doesn't need a second
 *              lookup.
 * A post already 'rejected' or 'removed' never appears in either list —
 * there's nothing left to decide.
 *
 * Acting on either list is PATCH /api/community/moderate?id=<post_id>
 * (existing) — approving/rejecting/removing a post also marks its open
 * reports reviewed.
 *
 * Auth: Clerk Bearer (or demo bootstrap), communications.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'communications.manage');
  if (!actor) return;

  const [{ data: pending, error: pendingErr }, { data: openReports, error: reportsErr }] = await Promise.all([
    supabase
      .from('community_posts')
      .select('id, author_person_id, post_type, body, created_at, people:author_person_id(first_name, last_name)')
      .eq('church_id', actor.churchId)
      .eq('moderation_status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('community_post_reports')
      .select('id, post_id, reason, created_at, reported_by_person_id')
      .eq('church_id', actor.churchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);
  if (pendingErr || reportsErr) return res.status(500).json({ error: 'read_failed' });

  const pendingIds = new Set((pending ?? []).map(p => p.id));
  // Exclude anything already in `pending` — it's either not-yet-reviewed
  // (covered there) or has already been decided (rejected/removed, not
  // worth re-surfacing). Only an APPROVED-and-reported post belongs here.
  const reportedPostIds = [...new Set((openReports ?? []).map(r => r.post_id))].filter(id => !pendingIds.has(id));
  let reportedPosts: {
    id: string; author_person_id: string; post_type: string; body: string; created_at: string;
    people: { first_name: string; last_name: string } | null;
  }[] = [];
  if (reportedPostIds.length > 0) {
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, author_person_id, post_type, body, created_at, people:author_person_id(first_name, last_name)')
      .in('id', reportedPostIds)
      .is('deleted_at', null)
      .eq('moderation_status', 'approved');
    if (error) return res.status(500).json({ error: 'read_failed' });
    reportedPosts = (data ?? []) as typeof reportedPosts;
  }

  const reportsByPost = new Map<string, { reasons: string[]; count: number }>();
  for (const r of openReports ?? []) {
    const entry = reportsByPost.get(r.post_id) ?? { reasons: [], count: 0 };
    entry.count += 1;
    if (r.reason) entry.reasons.push(r.reason);
    reportsByPost.set(r.post_id, entry);
  }

  function toQueueItem(p: (typeof reportedPosts)[number]) {
    const author = p.people;
    return {
      id: p.id,
      post_type: p.post_type,
      body: p.body,
      created_at: p.created_at,
      author_name: author ? `${author.first_name} ${author.last_name}`.trim() : 'A member',
    };
  }

  return res.status(200).json({
    pending: (pending ?? []).map(toQueueItem),
    reported: reportedPosts.map(p => ({
      ...toQueueItem(p),
      report_count: reportsByPost.get(p.id)?.count ?? 0,
      report_reasons: reportsByPost.get(p.id)?.reasons ?? [],
    })),
  });
}
