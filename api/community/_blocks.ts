/**
 * /api/community/blocks
 *
 *   GET    — the member's own block list.
 *   POST   { blocked_person_id } — block another member.
 *   DELETE ?blocked_person_id= — unblock.
 *
 * Member self-service only — a member can never see or change another
 * member's block list (enforced by RLS: "member_blocks own only",
 * migration 043).
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { readBody, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BLOCK_SCHEMA = {
  blocked_person_id: uuid_({ required: true }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('member_blocks')
      .select('id, blocked_person_id, created_at')
      .eq('blocker_person_id', member.personId)
      .eq('church_id', member.churchId);
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ blocks: data ?? [] });
  }

  if (req.method === 'POST') {
    const body = readBody(req, res, BLOCK_SCHEMA);
    if (!body) return;
    if (body.blocked_person_id === member.personId) return res.status(400).json({ error: 'cannot_block_self' });

    const { data: block, error } = await supabase
      .from('member_blocks')
      .upsert({ church_id: member.churchId, blocker_person_id: member.personId, blocked_person_id: body.blocked_person_id }, { onConflict: 'blocker_person_id,blocked_person_id' })
      .select()
      .single();
    if (error || !block) return res.status(500).json({ error: 'block_failed' });
    return res.status(201).json({ block });
  }

  if (req.method === 'DELETE') {
    const blockedId = typeof req.query.blocked_person_id === 'string' ? req.query.blocked_person_id : undefined;
    if (!blockedId) return res.status(400).json({ error: 'missing_blocked_person_id' });

    const { error } = await supabase
      .from('member_blocks')
      .delete()
      .eq('blocker_person_id', member.personId)
      .eq('blocked_person_id', blockedId);
    if (error) return res.status(500).json({ error: 'unblock_failed' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
