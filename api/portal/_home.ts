/**
 * GET /api/portal/home
 *
 * Aggregated "My Home" data for the authenticated member: greeting,
 * upcoming events (with the member's own RSVP status), current
 * onboarding step, group activity, notifications, and a short list of
 * suggested next actions. Every value is read from the member's own
 * scope only — see resolveMemberActor, which resolves identity
 * server-side from the Clerk session and never trusts a client-supplied
 * person id.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { computeOnboardingSteps, currentOnboardingStep } from '../_lib/portalJourney.js';
import { VOLUNTEER_OPPORTUNITIES } from '../_lib/volunteerOpportunities.js';

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
    { data: person },
    { data: upcomingEvents },
    { data: myRsvps },
    { data: myGroups },
    { data: myConsents },
    { data: notifications },
  ] = await Promise.all([
    supabase.from('people').select('first_name, phone, address').eq('id', member.personId).maybeSingle(),
    supabase.from('calendar_events').select('id, title, start_date, location, category').eq('church_id', member.churchId).gte('start_date', nowIso).order('start_date', { ascending: true }).limit(5),
    supabase.from('event_rsvps').select('event_id, status').eq('person_id', member.personId),
    supabase.from('group_memberships').select('group_id, small_groups(name)').eq('person_id', member.personId).eq('status', 'active'),
    supabase.from('consents').select('id').eq('person_id', member.personId).limit(1),
    supabase.from('notifications').select('id, title, body, channel, status, created_at').eq('recipient_person_id', member.personId).neq('status', 'read').order('created_at', { ascending: false }).limit(5),
  ]);

  const rsvpByEvent = new Map((myRsvps ?? []).map(r => [r.event_id, r.status]));
  const eventsWithRsvp = (upcomingEvents ?? []).map(e => ({ ...e, my_rsvp: rsvpByEvent.get(e.id) ?? null }));

  const steps = computeOnboardingSteps({
    hasContactInfo: !!(person?.phone || person?.address),
    hasAnyConsentDecision: (myConsents ?? []).length > 0,
    hasActiveGroup: (myGroups ?? []).length > 0,
    hasEventRsvp: (myRsvps ?? []).length > 0,
  });
  const nextStep = currentOnboardingStep(steps);

  // A short, real, non-repetitive list of suggested next actions —
  // capped at 3 per the "no more than a few" requirement.
  const nextActions: { label: string; action: string }[] = [];
  if (nextStep) nextActions.push({ label: nextStep.label, action: nextStep.key });
  if ((eventsWithRsvp ?? []).some(e => !e.my_rsvp)) nextActions.push({ label: 'RSVP to an upcoming event', action: 'events' });
  if ((myGroups ?? []).length === 0) nextActions.push({ label: 'Find a group', action: 'groups' });

  return res.status(200).json({
    greeting_name: person?.first_name ?? 'friend',
    upcoming_events: eventsWithRsvp,
    onboarding: { steps, current_step: nextStep },
    group_activity: { count: (myGroups ?? []).length, groups: (myGroups ?? []).map(g => ({ id: g.group_id, name: (g as unknown as { small_groups: { name: string } | null }).small_groups?.name ?? 'Group' })) },
    notifications: notifications ?? [],
    volunteer_opportunities: VOLUNTEER_OPPORTUNITIES.slice(0, 3),
    next_actions: nextActions.slice(0, 3),
  });
}
