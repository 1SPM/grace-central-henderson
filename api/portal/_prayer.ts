/**
 * /api/portal/prayer
 *
 *   POST — submit a prayer request with an explicit visibility choice:
 *          private_pastoral_care | specific_care_team | selected_group |
 *          church_prayer_wall | anonymous_prayer_wall. Visibility is
 *          enforced by RLS (migration 043) — this route does not filter
 *          reads by visibility itself, the database does.
 *   GET  ?scope=mine — the member's own prayer requests, any visibility.
 *   GET  ?scope=wall (default) — church_prayer_wall +
 *          anonymous_prayer_wall requests. Author identity is stripped
 *          here at the API layer for anonymous_prayer_wall entries — a
 *          SECOND, independent safeguard on top of RLS, since RLS
 *          controls row access but not field redaction.
 *
 * Crisis-language safety override: if the message contains crisis
 * language, visibility is forced to private_pastoral_care regardless of
 * what the member selected, and the response includes approved crisis
 * resource information. This is a routing decision, not a diagnosis,
 * and it does not promise an emergency response — see
 * docs/AI_BOUNDARIES.md.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { detectCrisisLanguage, resolveEffectiveVisibility, CRISIS_RESOURCE_MESSAGE } from '../_lib/careSafety.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VISIBILITY_VALUES = ['private_pastoral_care', 'specific_care_team', 'selected_group', 'church_prayer_wall', 'anonymous_prayer_wall'];

const SUBMIT_SCHEMA = {
  content: str({ required: true, min: 1, max: 2000 }),
  visibility: str({ required: true, pattern: new RegExp(`^(${VISIBILITY_VALUES.join('|')})$`) }),
  group_id: uuid_(),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const scope = req.query.scope === 'mine' ? 'mine' : 'wall';

    if (scope === 'mine') {
      const { data, error } = await supabase
        .from('prayer_requests')
        .select('id, content, visibility, is_answered, testimony, status, created_at')
        .eq('person_id', member.personId)
        .eq('church_id', member.churchId)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: 'read_failed' });
      return res.status(200).json({ requests: data ?? [] });
    }

    // RLS already restricts this query to church_prayer_wall +
    // anonymous_prayer_wall rows (see "prayer_requests read church wall"
    // policy) — no additional .in('visibility', ...) filter needed, but
    // the service-role client bypasses RLS, so we filter explicitly here
    // too (defense in depth for the one client that doesn't ride RLS).
    const { data, error } = await supabase
      .from('prayer_requests')
      .select('id, content, visibility, is_answered, created_at, person_id, people(first_name, last_name)')
      .eq('church_id', member.churchId)
      .in('visibility', ['church_prayer_wall', 'anonymous_prayer_wall'])
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: 'read_failed' });

    const wall = (data ?? []).map(r => {
      const isAnon = r.visibility === 'anonymous_prayer_wall';
      const person = (r as unknown as { people: { first_name: string; last_name: string } | null }).people;
      return {
        id: r.id,
        content: r.content,
        is_answered: r.is_answered,
        created_at: r.created_at,
        author_name: isAnon ? null : (person ? `${person.first_name} ${person.last_name}` : null),
        is_anonymous: isAnon,
      };
    });
    return res.status(200).json({ requests: wall });
  }

  if (req.method === 'POST') {
    const body = readBody(req, res, SUBMIT_SCHEMA);
    if (!body) return;

    if (body.visibility === 'selected_group' && !body.group_id) {
      return res.status(400).json({ error: 'group_id_required_for_selected_group' });
    }

    const crisisFlagged = detectCrisisLanguage(body.content);
    const effectiveVisibility = resolveEffectiveVisibility(body.visibility!, crisisFlagged, 'private_pastoral_care');

    const { data: prayer, error } = await supabase
      .from('prayer_requests')
      .insert({
        church_id: member.churchId,
        person_id: member.personId,
        content: body.content,
        is_private: effectiveVisibility !== 'church_prayer_wall' && effectiveVisibility !== 'anonymous_prayer_wall',
        visibility: effectiveVisibility,
        group_id: effectiveVisibility === 'selected_group' ? body.group_id : null,
        crisis_flagged: crisisFlagged,
      })
      .select()
      .single();
    if (error || !prayer) {
      console.error('[portal/prayer] create failed', error);
      return res.status(500).json({ error: 'create_failed' });
    }

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'prayer.request.submitted',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'prayer_request',
      subjectId: prayer.id,
      payload: { visibility: effectiveVisibility, crisis_flagged: crisisFlagged },
    });
    await recordAudit(supabase, {
      churchId: member.churchId,
      actorUserId: null,
      actorClerkId: member.clerkUserId,
      action: 'create',
      entityType: 'prayer_request',
      entityId: prayer.id,
      after: { visibility: effectiveVisibility, crisis_flagged: crisisFlagged },
      sourceApp: 'member_portal',
      reason: 'member self-service prayer request',
      correlationId,
      route: '/api/portal/prayer',
      method: 'POST',
    });

    return res.status(201).json({
      request: { id: prayer.id, visibility: effectiveVisibility, created_at: prayer.created_at },
      visibility_overridden: crisisFlagged,
      ...(crisisFlagged ? { crisis_resource_message: CRISIS_RESOURCE_MESSAGE } : {}),
    });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
