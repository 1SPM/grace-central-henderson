/**
 * /api/portal/profile
 *
 *   GET   — the member's own permitted profile fields.
 *   PATCH — update permitted fields only. Internal-only fields (status,
 *           notes, tags, household_id, portal_enabled, etc.) are never
 *           accepted, even if present in the request body — the update
 *           schema is an explicit allow-list, not a blocklist.
 *
 * Emits member.profile.updated and writes an audit_logs row on every
 * successful PATCH.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROFILE_FIELDS = 'id, first_name, last_name, email, phone, address, city, state, zip, birth_date, photo_url';

const UPDATE_SCHEMA = {
  first_name: str({ max: 100 }),
  last_name: str({ max: 100 }),
  phone: str({ max: 30 }),
  address: str({ max: 200 }),
  city: str({ max: 100 }),
  state: str({ max: 50 }),
  zip: str({ max: 20 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const { data: person, error } = await supabase
      .from('people')
      .select(PROFILE_FIELDS)
      .eq('id', member.personId)
      .eq('church_id', member.churchId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ profile: person });
  }

  if (req.method === 'PATCH') {
    const body = readBody(req, res, UPDATE_SCHEMA);
    if (!body) return;

    const { data: before } = await supabase
      .from('people')
      .select(PROFILE_FIELDS)
      .eq('id', member.personId)
      .maybeSingle();

    const update = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'no_fields_to_update' });
    }

    const { data: after, error } = await supabase
      .from('people')
      .update(update)
      .eq('id', member.personId)
      .eq('church_id', member.churchId)
      .select(PROFILE_FIELDS)
      .single();
    if (error || !after) return res.status(500).json({ error: 'update_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'member.profile.updated',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'person',
      subjectId: member.personId,
      payload: { fields_changed: Object.keys(update) },
    });
    await recordAudit(supabase, {
      churchId: member.churchId,
      actorUserId: null,
      actorClerkId: member.clerkUserId,
      action: 'update',
      entityType: 'person',
      entityId: member.personId,
      before,
      after,
      sourceApp: 'member_portal',
      reason: 'member self-service profile update',
      correlationId,
      route: '/api/portal/profile',
      method: 'PATCH',
    });

    return res.status(200).json({ profile: after });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
