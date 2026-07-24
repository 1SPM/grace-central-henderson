/**
 * /api/portal/notifications
 *
 *   GET   — the member's own notifications.
 *   PATCH ?id= — mark one notification read.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, channel, title, body, status, read_at, created_at')
      .eq('recipient_person_id', member.personId)
      .eq('church_id', member.churchId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ notifications: data ?? [] });
  }

  if (req.method === 'PATCH') {
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    const { data, error } = await supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('recipient_person_id', member.personId)
      .eq('church_id', member.churchId)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ notification: data });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
