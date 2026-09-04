/**
 * /api/community/posts
 *
 *   GET  — the member's feed: approved, non-deleted church posts, minus
 *          anyone they've blocked and anyone who's blocked them
 *          (bidirectional — a blocked member should not keep seeing or
 *          reacting to the person who blocked them either), with each
 *          post's reaction counts and the caller's own reaction state.
 *   POST { post_type, body } — compose a post. Always created
 *          moderation_status='pending' (migration 043's default) — it is
 *          invisible to the church feed until a moderator approves it via
 *          /api/community/moderation. The author can still see their own
 *          pending/rejected posts (RLS "community_posts read own"), which
 *          this route also serves back so the composer can show status.
 *
 * post_type is restricted to member-composable types. 'prayer' is
 * deliberately excluded — that's /api/portal/prayer's job (its own
 * visibility tiers, crisis detection, and prayer wall). 'milestone',
 * 'event', and 'group_activity' are excluded too — those read as
 * system-derived post types (from discipleship_milestones/calendar_events
 * automation), not something this composer should let a member fabricate.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { enforcePortalWriteLimit } from '../_lib/portalWriteRateLimit.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COMPOSABLE_POST_TYPES = ['blessing', 'praise', 'scripture'] as const;
const REACTION_TYPES = ['pray', 'amen', 'share'] as const;

const CREATE_SCHEMA = {
  post_type: str({ required: true, pattern: new RegExp(`^(${COMPOSABLE_POST_TYPES.join('|')})$`) }),
  body: str({ required: true, min: 1, max: 2000 }),
};

const FEED_LIMIT = 50;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const [{ data: blockedByMe }, { data: blockedMe }] = await Promise.all([
      supabase.from('member_blocks').select('blocked_person_id').eq('blocker_person_id', member.personId),
      supabase.from('member_blocks').select('blocker_person_id').eq('blocked_person_id', member.personId),
    ]);
    const excludedAuthors = new Set<string>([
      ...(blockedByMe ?? []).map(b => b.blocked_person_id as string),
      ...(blockedMe ?? []).map(b => b.blocker_person_id as string),
    ]);

    // RLS already restricts this to approved posts (or the caller's own,
    // any status) — the excludedAuthors filter below is on top of that.
    const { data: posts, error } = await supabase
      .from('community_posts')
      .select('id, author_person_id, post_type, body, moderation_status, created_at, people:author_person_id(first_name, last_name)')
      .eq('church_id', member.churchId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT);
    if (error) return res.status(500).json({ error: 'read_failed' });

    const visible = (posts ?? []).filter(p =>
      p.author_person_id === member.personId || !excludedAuthors.has(p.author_person_id),
    );
    const postIds = visible.map(p => p.id);

    let reactions: { post_id: string; person_id: string; reaction_type: string }[] = [];
    if (postIds.length > 0) {
      const { data } = await supabase
        .from('community_reactions')
        .select('post_id, person_id, reaction_type')
        .in('post_id', postIds);
      reactions = data ?? [];
    }

    const countsByPost = new Map<string, Record<string, number>>();
    const mineByPost = new Map<string, Set<string>>();
    for (const r of reactions) {
      const counts = countsByPost.get(r.post_id) ?? {};
      counts[r.reaction_type] = (counts[r.reaction_type] ?? 0) + 1;
      countsByPost.set(r.post_id, counts);
      if (r.person_id === member.personId) {
        const mine = mineByPost.get(r.post_id) ?? new Set<string>();
        mine.add(r.reaction_type);
        mineByPost.set(r.post_id, mine);
      }
    }

    const feed = visible.map(p => {
      const author = p.people as unknown as { first_name: string; last_name: string } | null;
      return {
        id: p.id,
        post_type: p.post_type,
        body: p.body,
        created_at: p.created_at,
        is_mine: p.author_person_id === member.personId,
        // Exposed so the feed can offer "Report" / "Block this person" on
        // someone else's post — never used to attribute content to the
        // wrong person since it comes straight from the row, not the client.
        author_person_id: p.author_person_id,
        // Status is only meaningful for the author's own posts — RLS
        // already prevents anyone else's pending/rejected posts from
        // reaching this query, so this is never an information leak.
        moderation_status: p.moderation_status,
        author_name: author ? `${author.first_name} ${author.last_name}`.trim() : 'A member',
        reaction_counts: countsByPost.get(p.id) ?? {},
        my_reactions: [...(mineByPost.get(p.id) ?? [])],
      };
    });

    return res.status(200).json({ posts: feed });
  }

  if (req.method === 'POST') {
    if (await enforcePortalWriteLimit(res, 'community_post', member.personId)) return;
    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;

    const { data: post, error } = await supabase
      .from('community_posts')
      .insert({
        church_id: member.churchId,
        author_person_id: member.personId,
        post_type: body.post_type,
        body: body.body,
        visibility: 'church',
      })
      .select('id, post_type, body, moderation_status, created_at')
      .single();
    if (error || !post) return res.status(500).json({ error: 'create_failed' });

    await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'community.post.submitted',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'community_post',
      subjectId: post.id,
      payload: { post_type: post.post_type },
    });

    return res.status(201).json({ post });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}

export { COMPOSABLE_POST_TYPES, REACTION_TYPES };
