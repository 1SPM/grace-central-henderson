/**
 * GET /api/portal/requests
 *
 * The member's own submitted requests (group joins, volunteer interest,
 * contact messages) with a simple, member-facing status label —
 * Received / Assigned / In Progress / Waiting for Information /
 * Completed. Never exposes the internal work_order_tasks.status value,
 * the assigned staff member's identity, internal notes, or the Work
 * Order itself — see toMemberFacingStatus().
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { toMemberFacingStatus } from '../_lib/portalRequestTask.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  const { data: tasks, error } = await supabase
    .from('work_order_tasks')
    .select('id, title, status, owner_user_id, metadata, created_at, completed_at')
    .eq('requested_by_person_id', member.personId)
    .eq('church_id', member.churchId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: 'read_failed' });

  const requests = (tasks ?? []).map(t => ({
    id: t.id,
    title: t.title,
    request_type: (t.metadata as Record<string, unknown> | null)?.request_type ?? 'other',
    status: toMemberFacingStatus(t.status, !!t.owner_user_id),
    submitted_at: t.created_at,
    completed_at: t.completed_at,
  }));

  return res.status(200).json({ requests });
}
