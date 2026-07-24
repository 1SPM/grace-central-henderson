/**
 * /api/portal/events
 *
 *   GET  — discover upcoming events with the member's own RSVP status.
 *   POST { event_id, status, guest_count? } — RSVP (yes/no/maybe),
 *          upserting the member's own event_rsvps row. Emits
 *          event.rsvp.created.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { readBody, str, uuid_, int_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RSVP_SCHEMA = {
  event_id: uuid_({ required: true }),
  status: str({ required: true, pattern: /^(yes|no|maybe)$/ }),
  guest_count: int_({ min: 0, max: 20 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const nowIso = new Date().toISOString();
    const [{ data: events, error }, { data: myRsvps }] = await Promise.all([
      supabase.from('calendar_events').select('id, title, description, start_date, end_date, location, category').eq('church_id', member.churchId).gte('start_date', nowIso).order('start_date', { ascending: true }).limit(30),
      supabase.from('event_rsvps').select('event_id, status, guest_count').eq('person_id', member.personId),
    ]);
    if (error) return res.status(500).json({ error: 'read_failed' });

    const rsvpByEvent = new Map((myRsvps ?? []).map(r => [r.event_id, r]));
    const withRsvp = (events ?? []).map(e => ({ ...e, my_rsvp: rsvpByEvent.get(e.id) ?? null }));

    return res.status(200).json({ events: withRsvp });
  }

  if (req.method === 'POST') {
    const body = readBody(req, res, RSVP_SCHEMA);
    if (!body) return;

    const { data: event } = await supabase
      .from('calendar_events')
      .select('id, title')
      .eq('id', body.event_id)
      .eq('church_id', member.churchId)
      .maybeSingle();
    if (!event) return res.status(404).json({ error: 'event_not_found' });

    const { data: rsvp, error } = await supabase
      .from('event_rsvps')
      .upsert(
        {
          church_id: member.churchId,
          event_id: body.event_id,
          person_id: member.personId,
          status: body.status,
          guest_count: body.guest_count ?? 0,
          source: 'portal',
        },
        { onConflict: 'event_id,person_id' },
      )
      .select()
      .single();
    if (error || !rsvp) return res.status(500).json({ error: 'rsvp_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'event.rsvp.created',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'calendar_event',
      subjectId: body.event_id,
      payload: { event_title: event.title, status: body.status },
    });

    return res.status(200).json({ rsvp, correlation_id: correlationId });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
