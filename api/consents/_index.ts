/**
 * /api/consents
 *
 *   GET                     — member self-service: the caller's own consents
 *                             + communication_preferences.
 *   GET   ?person_id=<uuid> — staff view of a specific member's consents
 *                             (requires consent.view).
 *   PATCH                   — member self-service: update one of the
 *                             caller's own consent types.
 *   PATCH ?person_id=<uuid> — staff update on a member's behalf (requires
 *                             consent.manage; source recorded as 'staff').
 *
 * This is the one route in the shared foundation that intentionally
 * supports two different callers (member vs. staff) because "member-
 * controlled consent" and "staff manages consent on a member's behalf"
 * are both explicit requirements. The two paths never share a permission
 * check — a member can only ever affect person_id = their own resolved
 * people.id (enforced by resolveMemberActor, not by trusting a client-
 * supplied person_id).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission, resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { deriveCommunicationFlags } from '../_lib/consentPreferences.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const CONSENT_TYPES = [
  'email', 'sms', 'push_notification', 'pastoral_contact', 'directory_visibility',
  'photograph', 'group_visibility', 'prayer_request_visibility',
  'volunteer_communications', 'impact_card_communications',
] as const;

const UPDATE_SCHEMA = {
  consent_type: str({ required: true, pattern: new RegExp(`^(${CONSENT_TYPES.join('|')})$`) }),
  status: str({ required: true, pattern: /^(granted|denied|withdrawn)$/ }),
};

async function fetchConsentBundle(supabase: ReturnType<typeof createClient>, churchId: string, personId: string) {
  const [{ data: consents }, { data: preferences }] = await Promise.all([
    supabase.from('consents').select('*').eq('church_id', churchId).eq('person_id', personId),
    supabase.from('communication_preferences').select('*').eq('church_id', churchId).eq('person_id', personId).maybeSingle(),
  ]);
  return { consents: consents ?? [], preferences: preferences ?? null };
}

async function syncCommunicationPreferences(
  supabase: ReturnType<typeof createClient>,
  churchId: string,
  personId: string,
) {
  const { data: consents } = await supabase
    .from('consents')
    .select('consent_type, status')
    .eq('church_id', churchId)
    .eq('person_id', personId);

  const flags = deriveCommunicationFlags(consents ?? []);

  await supabase.from('communication_preferences').upsert(
    {
      church_id: churchId,
      person_id: personId,
      ...flags,
    },
    { onConflict: 'person_id' },
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const staffPersonId = typeof req.query.person_id === 'string' ? req.query.person_id : undefined;

  if (req.method === 'GET') {
    if (staffPersonId) {
      const actor = await requirePermission(req, res, supabase, 'consent.view');
      if (!actor) return;
      const { data: person } = await supabase
        .from('people')
        .select('id')
        .eq('id', staffPersonId)
        .eq('church_id', actor.churchId)
        .maybeSingle();
      if (!person) return res.status(404).json({ error: 'person_not_found' });
      return res.status(200).json(await fetchConsentBundle(supabase, actor.churchId, staffPersonId));
    }

    const member = await resolveMemberActor(req, res, supabase);
    if (!member) return;
    return res.status(200).json(await fetchConsentBundle(supabase, member.churchId, member.personId));
  }

  if (req.method === 'PATCH') {
    const body = readBody(req, res, UPDATE_SCHEMA);
    if (!body) return;

    let churchId: string;
    let personId: string;
    let source: 'portal' | 'staff';
    let actorUserId: string | null = null;
    let actorClerkId: string | null = null;

    if (staffPersonId) {
      const actor = await requirePermission(req, res, supabase, 'consent.manage');
      if (!actor) return;
      const { data: person } = await supabase
        .from('people')
        .select('id')
        .eq('id', staffPersonId)
        .eq('church_id', actor.churchId)
        .maybeSingle();
      if (!person) return res.status(404).json({ error: 'person_not_found' });
      churchId = actor.churchId;
      personId = staffPersonId;
      source = 'staff';
      actorUserId = actor.userId;
      actorClerkId = actor.clerkUserId;
    } else {
      const member = await resolveMemberActor(req, res, supabase);
      if (!member) return;
      churchId = member.churchId;
      personId = member.personId;
      source = 'portal';
      actorClerkId = member.clerkUserId;
    }

    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('consents')
      .select('*')
      .eq('church_id', churchId)
      .eq('person_id', personId)
      .eq('consent_type', body.consent_type)
      .maybeSingle();

    const { data: consent, error } = await supabase
      .from('consents')
      .upsert(
        {
          church_id: churchId,
          person_id: personId,
          consent_type: body.consent_type,
          status: body.status,
          source,
          recorded_by_user_id: actorUserId,
          granted_at: body.status === 'granted' ? now : (existing?.granted_at ?? null),
          withdrawn_at: body.status === 'withdrawn' ? now : null,
        },
        { onConflict: 'person_id,consent_type' },
      )
      .select()
      .single();
    if (error || !consent) return res.status(500).json({ error: 'update_failed' });

    await syncCommunicationPreferences(supabase, churchId, personId);

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId,
      // Member-initiated changes use the Members Portal event catalog
      // name; staff-recorded-on-behalf-of changes keep the original
      // shared-platform event name. Same underlying write either way.
      eventType: source === 'portal' ? 'member.preferences.changed' : 'consent.changed',
      sourceApp: source === 'portal' ? 'member_portal' : 'admin_dashboard',
      actorUserId,
      actorPersonId: source === 'portal' ? personId : null,
      subjectType: 'person',
      subjectId: personId,
      payload: { consent_type: body.consent_type, status: body.status },
    });

    await recordAudit(supabase, {
      churchId,
      actorUserId,
      actorClerkId,
      action: 'update',
      entityType: 'consent',
      entityId: consent.id,
      before: existing ?? null,
      after: consent,
      sourceApp: source === 'portal' ? 'member_portal' : 'admin_dashboard',
      reason: source === 'portal' ? 'member self-service' : 'staff-recorded on behalf of member',
      correlationId,
      route: '/api/consents',
      method: 'PATCH',
    });

    return res.status(200).json({ consent });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
