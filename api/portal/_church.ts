/**
 * GET /api/portal/church
 *
 * "My Church" read-only data: church profile/service-times/locations,
 * leadership (safe fields only — never internal staff notes), published
 * announcements, ministries/groups, and upcoming events. All church-
 * scoped to the member's own church via resolveMemberActor.
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  const nowIso = new Date().toISOString();

  const [
    { data: church },
    { data: leaders },
    { data: announcements },
    { data: groups },
    { data: events },
  ] = await Promise.all([
    supabase.from('churches').select('name, address, city, state, zip, phone, email, website, timezone, settings').eq('id', member.churchId).maybeSingle(),
    // Safe fields only: name/title/photo. Never staff notes, never a full users row.
    supabase.from('users').select('id, first_name, last_name, avatar_url, role, staff_profiles(title, ministry, bio)').eq('church_id', member.churchId).in('role', ['admin', 'pastor']).eq('account_status', 'active'),
    supabase.from('announcements').select('id, title, body, image_url, category, pinned, created_at').eq('church_id', member.churchId).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10),
    supabase.from('small_groups').select('id, name, description, meeting_day, meeting_time, location').eq('church_id', member.churchId).eq('is_active', true).order('name').limit(20),
    supabase.from('calendar_events').select('id, title, start_date, location, category').eq('church_id', member.churchId).gte('start_date', nowIso).order('start_date', { ascending: true }).limit(10),
  ]);

  const leadership = (leaders ?? []).map(l => {
    const staffProfile = (l as unknown as { staff_profiles: { title: string | null; ministry: string | null; bio: string | null } | null }).staff_profiles;
    return {
      id: l.id,
      name: [l.first_name, l.last_name].filter(Boolean).join(' '),
      photo_url: l.avatar_url,
      title: staffProfile?.title ?? (l.role === 'pastor' ? 'Pastor' : 'Leader'),
      ministry: staffProfile?.ministry ?? null,
      bio: staffProfile?.bio ?? null,
    };
  });

  return res.status(200).json({
    church: church ?? null,
    service_times: church?.settings?.profile?.serviceTimes ?? [],
    leadership,
    announcements: announcements ?? [],
    ministries: groups ?? [],
    groups: groups ?? [],
    events: events ?? [],
  });
}
