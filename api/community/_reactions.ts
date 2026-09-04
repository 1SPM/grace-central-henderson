/**
 * /api/community/reactions
 *
 *   POST { post_id, reaction_type } — toggle a reaction on a post: adds
 *   it if the member hasn't reacted with that type yet, removes it if
 *   they have. community_reactions's UNIQUE(post_id, person_id,
 *   reaction_type) is what makes "toggle" safe against a double-click
 *   race — a second insert attempt just fails the unique constraint
 *   rather than double-counting.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { enforcePortalWriteLimit } from '../_lib/portalWriteRateLimit.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';
import { REACTION_TYPES } from './_posts.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  post_id: uuid_({ required: true }),
  reaction_type: str({ required: true, pattern: new RegExp(`^(${REACTION_TYPES.join('|')})$`) }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;
  if (await enforcePortalWriteLimit(res, 'community_reaction', member.personId)) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  // RLS on community_posts already scopes this to a post the member can
  // see (approved, in their church, or their own) — reacting to a post
  // they can't read fails here rather than silently succeeding.
  const { data: post } = await supabase
    .from('community_posts')
    .select('id')
    .eq('id', body.post_id)
    .eq('church_id', member.churchId)
    .maybeSingle();
  if (!post) return res.status(404).json({ error: 'post_not_found' });

  const { data: existing } = await supabase
    .from('community_reactions')
    .select('id')
    .eq('post_id', body.post_id)
    .eq('person_id', member.personId)
    .eq('reaction_type', body.reaction_type)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('community_reactions').delete().eq('id', existing.id);
    if (error) return res.status(500).json({ error: 'unreact_failed' });
    return res.status(200).json({ reacted: false });
  }

  const { error } = await supabase.from('community_reactions').insert({
    church_id: member.churchId,
    post_id: body.post_id,
    person_id: member.personId,
    reaction_type: body.reaction_type,
  });
  if (error) return res.status(500).json({ error: 'react_failed' });
  return res.status(201).json({ reacted: true });
}
