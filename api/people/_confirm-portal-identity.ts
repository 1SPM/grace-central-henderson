/**
 * POST /api/people/confirm-portal-identity
 *
 * Staff confirms a self-registered Member Portal identity (see
 * migration 078, api/portal/_self-signup.ts): sets people.staff_reviewed_at,
 * which flips MemberActor.identityVerified to true and unlocks the
 * giving history / Impact Card / care-request history that stayed
 * hidden since sign-up (api/_lib/authz.ts's requireVerifiedIdentity).
 *
 * Only meaningful for a self_registered row that hasn't been reviewed
 * yet — staff-provisioned people (Set up portal account / invite
 * accept) never needed this in the first place.
 *
 * Auth: portal.provision_member — same permission that gates initiating
 * portal access in the first place.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  person_id: uuid_({ required: true }),
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

  const { data: person, error: personErr } = await supabase
    .from('people')
    .select('id, self_registered, staff_reviewed_at')
    .eq('id', body.person_id)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (personErr) return res.status(500).json({ error: 'person_read_failed' });
  if (!person) return res.status(404).json({ error: 'not_found' });
  if (!person.self_registered) return res.status(409).json({ error: 'not_self_registered' });
  if (person.staff_reviewed_at) {
    return res.status(200).json({ ok: true, already_reviewed: true, reviewed_at: person.staff_reviewed_at });
  }

  const reviewedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('people')
    .update({ staff_reviewed_at: reviewedAt })
    .eq('id', person.id);
  if (updateErr) return res.status(500).json({ error: 'update_failed' });

  await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'portal.self_signup_reviewed',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'person',
    subjectId: person.id,
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'confirm_portal_identity',
    entityType: 'person',
    entityId: person.id,
    after: { staff_reviewed_at: reviewedAt },
  });

  return res.status(200).json({ ok: true, already_reviewed: false, reviewed_at: reviewedAt });
}
