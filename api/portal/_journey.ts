/**
 * /api/portal/journey
 *
 *   GET   — onboarding checklist (derived, not scored), church-verified
 *           milestones (read-only), and the member's own goals/saved
 *           resources.
 *   POST  — create a goal or saved_resource.
 *   PATCH ?id= — update status (active/completed/archived). Marking a
 *           goal completed emits journey.step.completed.
 *
 * Next-step suggestions are based only on the member's own explicit
 * choices (their goals) and permitted activity signals already computed
 * for onboarding — never an inferred "readiness" or spiritual score.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { computeOnboardingSteps, currentOnboardingStep } from '../_lib/portalJourney.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CREATE_SCHEMA = {
  item_type: str({ required: true, pattern: /^(goal|saved_resource)$/ }),
  title: str({ required: true, min: 1, max: 200 }),
  description: str({ max: 2000 }),
  reference_type: str({ max: 60 }),
  reference_id: str({ max: 120 }),
};

const UPDATE_SCHEMA = {
  status: str({ required: true, pattern: /^(active|completed|archived)$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const [
      { data: person },
      { data: consents },
      { data: groups },
      { data: rsvps },
      { data: items },
      { data: milestones },
      { data: church },
    ] = await Promise.all([
      supabase.from('people').select('phone, address').eq('id', member.personId).maybeSingle(),
      supabase.from('consents').select('id').eq('person_id', member.personId).limit(1),
      supabase.from('group_memberships').select('id').eq('person_id', member.personId).eq('status', 'active').limit(1),
      supabase.from('event_rsvps').select('id').eq('person_id', member.personId).limit(1),
      supabase.from('member_journey_items').select('*').eq('person_id', member.personId).order('created_at', { ascending: false }),
      supabase.from('discipleship_milestones').select('milestone_type, completed_at').eq('person_id', member.personId),
      supabase.from('churches').select('settings').eq('id', member.churchId).maybeSingle(),
    ]);

    const steps = computeOnboardingSteps({
      hasContactInfo: !!(person?.phone || person?.address),
      hasAnyConsentDecision: (consents ?? []).length > 0,
      hasActiveGroup: (groups ?? []).length > 0,
      hasEventRsvp: (rsvps ?? []).length > 0,
    });

    // Computed, not stored — same "no scoring table" convention as the
    // onboarding steps above. A church's membership track (e.g. "Ownership":
    // salvation + baptism + a first-steps class) is defined in
    // churches.settings.membershipTrack and evaluated here against the
    // member's real discipleship_milestones rows.
    const completedMilestones = milestones ?? [];
    const track = (church?.settings as { membershipTrack?: { label: string; requiredMilestoneTypes: string[] } } | null)?.membershipTrack;
    const membershipTrack = track
      ? {
          label: track.label,
          required_count: track.requiredMilestoneTypes.length,
          completed_count: track.requiredMilestoneTypes.filter(t => completedMilestones.some(m => m.milestone_type === t)).length,
          is_complete: track.requiredMilestoneTypes.every(t => completedMilestones.some(m => m.milestone_type === t)),
        }
      : null;

    return res.status(200).json({
      onboarding: { steps, current_step: currentOnboardingStep(steps) },
      goals: (items ?? []).filter(i => i.item_type === 'goal'),
      saved_resources: (items ?? []).filter(i => i.item_type === 'saved_resource'),
      completed_milestones: completedMilestones,
      membership_track: membershipTrack,
    });
  }

  if (req.method === 'POST') {
    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;

    const { data: item, error } = await supabase
      .from('member_journey_items')
      .insert({
        church_id: member.churchId,
        person_id: member.personId,
        item_type: body.item_type,
        title: body.title,
        description: body.description ?? null,
        reference_type: body.reference_type ?? null,
        reference_id: body.reference_id ?? null,
      })
      .select()
      .single();
    if (error || !item) return res.status(500).json({ error: 'create_failed' });

    return res.status(201).json({ item });
  }

  if (req.method === 'PATCH') {
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    const body = readBody(req, res, UPDATE_SCHEMA);
    if (!body) return;

    const { data: before } = await supabase.from('member_journey_items').select('*').eq('id', id).eq('person_id', member.personId).maybeSingle();
    if (!before) return res.status(404).json({ error: 'not_found' });

    const { data: item, error } = await supabase
      .from('member_journey_items')
      .update({ status: body.status })
      .eq('id', id)
      .eq('person_id', member.personId)
      .select()
      .single();
    if (error || !item) return res.status(500).json({ error: 'update_failed' });

    if (body.status === 'completed' && before.status !== 'completed') {
      const { correlationId } = await emitPlatformEvent(supabase, {
        churchId: member.churchId,
        eventType: 'journey.step.completed',
        sourceApp: 'member_portal',
        actorPersonId: member.personId,
        subjectType: 'member_journey_item',
        subjectId: id,
        payload: { item_type: item.item_type, title: item.title },
      });
      await recordAudit(supabase, {
        churchId: member.churchId,
        actorUserId: null,
        actorClerkId: member.clerkUserId,
        action: 'update',
        entityType: 'member_journey_item',
        entityId: id,
        before,
        after: item,
        sourceApp: 'member_portal',
        reason: 'member marked journey item completed',
        correlationId,
        route: '/api/portal/journey',
        method: 'PATCH',
      });
    }

    return res.status(200).json({ item });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
