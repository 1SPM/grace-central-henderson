/**
 * GET /api/workos/staff — active staff of the caller's church.
 *
 * The list behind every "who is accountable for this?" picker: Work Order
 * ownership today, task and care assignment later. Deliberately thin — id,
 * display name, and title — because a picker needs nothing else, and staff
 * records are not a directory to be exported from here.
 *
 * Auth: any active staff actor. Seeing that Naomi Ito is the Director of
 * Finance is not sensitive; the surfaces her name appears on keep their own
 * permission gates, and writing an assignment is checked separately.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';
import { staffDisplayName, type StaffRow } from '../_lib/ministryAreas.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * staff_profiles.user_id is UNIQUE, so PostgREST returns the embed as a
 * to-one OBJECT — but typings and older rows can present an array. Handle
 * both: the array-only guard silently dropped every title in production.
 */
function profileTitle(sp: unknown): string | null {
  const p = Array.isArray(sp) ? sp[0] : sp;
  return (p as { title?: string | null } | null | undefined)?.title ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return; // 401/403 already sent

  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, staff_profiles(title)')
    .eq('church_id', actor.churchId)
    .eq('account_status', 'active')
    .order('first_name');

  if (error) {
    console.error('[workos/staff] read failed', error);
    return res.status(500).json({ error: 'read_failed' });
  }

  const staff = ((data ?? []) as unknown as {
    id: string; first_name: string | null; last_name: string | null;
    staff_profiles?: { title: string | null }[] | null;
  }[]).map(u => {
    const row: StaffRow = { id: u.id, first_name: u.first_name, last_name: u.last_name };
    return {
      user_id: u.id,
      name: staffDisplayName(row),
      title: profileTitle(u.staff_profiles),
    };
  });

  return res.status(200).json({ staff });
}
