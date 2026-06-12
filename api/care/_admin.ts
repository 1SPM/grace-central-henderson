/**
 * GET /api/care/admin
 *
 * Staff-side feed for the Pastoral Care dashboard: every portal care
 * conversation in the caller's church with its messages, plus crisis
 * and triage rollups. anchor_* RLS is service-role-only, so this route
 * is the dashboard's only data path.
 *
 * Auth: Clerk Bearer, staff roles only.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STAFF_ROLES = ['admin', 'pastor', 'staff'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req, { allowedRoles: STAFF_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const { data: conversations, error: convErr } = await supabase
    .from('anchor_conversations')
    .select('*')
    .eq('church_id', auth.churchId)
    .order('last_message_at', { ascending: false })
    .limit(200);
  if (convErr) return res.status(500).json({ error: 'read_failed' });

  const ids = (conversations ?? []).map(c => c.id);
  let messages: unknown[] = [];
  if (ids.length > 0) {
    const { data: msgs, error: msgErr } = await supabase
      .from('anchor_messages')
      .select('*')
      .in('conversation_id', ids)
      .order('created_at', { ascending: true });
    if (msgErr) return res.status(500).json({ error: 'read_failed' });
    messages = msgs ?? [];
  }

  // Resolve member names for non-anonymous conversations.
  const personIds = Array.from(
    new Set((conversations ?? []).map(c => c.person_id).filter((id): id is string => !!id)),
  );
  let people: { id: string; first_name: string; last_name: string }[] = [];
  if (personIds.length > 0) {
    const { data: rows } = await supabase
      .from('people')
      .select('id, first_name, last_name')
      .in('id', personIds);
    people = (rows ?? []) as typeof people;
  }

  const all = conversations ?? [];
  const summary = {
    total: all.length,
    active: all.filter(c => c.status === 'active').length,
    crisis: all.filter(c => c.crisis_flagged && c.status !== 'closed').length,
    unassigned: all.filter(c => !c.leader_id && c.status === 'active').length,
  };

  return res.status(200).json({ conversations: all, messages, people, summary });
}
