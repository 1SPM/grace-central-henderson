/**
 * POST /api/people/seed-demo-persona
 *
 * Body: { first_name: string, last_name: string, confirm?: string }
 *
 * Productizes tonight's manual seed SQL: creates a synthetic person with
 * a coherent journey (milestones, journey goals, a group, a recurring
 * gift sized to the church's giving tiers, one-time gifts, a prayer
 * post, an event RSVP, an approved KYC + funded Impact Card + a small
 * interchange history, and an activity trail) via the pure builder in
 * api/_lib/demoPersona.ts.
 *
 * Tenant guard: on a real (non-demo) tenant, requires
 * body.confirm === the church's exact configured name — this response
 * NEVER echoes that name back, so a caller must actually know it (e.g.
 * from Settings), not copy it from an error message.
 *
 * Auth: portal.provision_member.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';
import { isDemoChurch } from '../_lib/demoTenants.js';
import { buildDemoPersonaSeed, type GivingTierDefinition } from '../_lib/demoPersona.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  first_name: str({ required: true, min: 1, max: 100 }),
  last_name: str({ required: true, min: 1, max: 100 }),
  confirm: str({ max: 200 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'portal.provision_member');
  if (!actor) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const { data: church, error: churchErr } = await supabase
    .from('churches')
    .select('settings')
    .eq('id', actor.churchId)
    .maybeSingle();
  if (churchErr || !church) return res.status(500).json({ error: 'church_read_failed' });

  const settings = (church.settings as Record<string, unknown> | null) ?? {};
  const profile = settings.profile as Record<string, unknown> | undefined;
  const churchName = typeof profile?.name === 'string' ? profile.name : null;

  if (!isDemoChurch(actor.churchId)) {
    if (!body.confirm) {
      return res.status(409).json({
        error: 'confirmation_required',
        message: "This is a real tenant. Type your church's exact name to confirm.",
      });
    }
    if (!churchName || body.confirm !== churchName) {
      return res.status(409).json({
        error: 'confirmation_mismatch',
        message: "The typed name didn't match this church's name exactly.",
      });
    }
  }

  const givingTiers = Array.isArray(settings.givingTiers)
    ? (settings.givingTiers as GivingTierDefinition[])
    : undefined;

  const { data: firstGroup } = await supabase
    .from('small_groups')
    .select('id')
    .eq('church_id', actor.churchId)
    .limit(1)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const { data: nextEvent } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('church_id', actor.churchId)
    .gte('start_date', today)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  const personId = randomUUID();
  const kycId = randomUUID();
  const cardId = randomUUID();
  const cardAccountId = randomUUID();

  const seed = buildDemoPersonaSeed({
    churchId: actor.churchId,
    personId,
    kycId,
    cardId,
    cardAccountId,
    firstName: body.first_name,
    lastName: body.last_name,
    now: new Date(),
    givingTiers,
    firstActiveGroupId: firstGroup?.id ?? null,
    nextUpcomingEventId: nextEvent?.id ?? null,
  });

  const { error: personInsertErr } = await supabase.from('people').insert(seed.person);
  if (personInsertErr) {
    return res.status(500).json({ error: 'person_create_failed', detail: personInsertErr.message });
  }

  await supabase.from('discipleship_milestones').insert(seed.discipleshipMilestones);
  await supabase.from('member_journey_items').insert(seed.journeyItems);
  if (seed.groupMembership) await supabase.from('group_memberships').insert(seed.groupMembership);
  await supabase.from('recurring_giving').insert(seed.recurringGift);
  await supabase.from('giving').insert(seed.oneTimeGifts);
  await supabase.from('prayer_requests').insert(seed.prayerPost);
  if (seed.eventRsvp) await supabase.from('event_rsvps').insert(seed.eventRsvp);
  await supabase.from('kyc_verifications').insert(seed.kyc);
  await supabase.from('cards').insert(seed.card);
  await supabase.from('card_accounts').insert(seed.cardAccount);
  await supabase.from('interchange_events').insert(seed.interchangeEvents);
  await supabase.from('member_activity_events').insert(seed.activityEvents);

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'portal.demo_persona_seeded',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'person',
    subjectId: personId,
    payload: { first_name: body.first_name, last_name: body.last_name },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'seed_demo_persona',
    entityType: 'person',
    entityId: personId,
    after: { first_name: body.first_name, last_name: body.last_name, tags: ['demo-persona'] },
    correlationId,
    route: '/api/people/seed-demo-persona',
    method: 'POST',
  });

  return res.status(201).json({
    person_id: personId,
    email: seed.person.email,
    giving_tier_note: seed.givingTierNote,
    group_membership_skipped: !seed.groupMembership,
    event_rsvp_skipped: !seed.eventRsvp,
  });
}
