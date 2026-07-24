/**
 * POST /api/people/preview-portal-token
 *
 * Mints a short-lived, read-only "preview as member" token for the
 * Members Portal (see api/_lib/authz.ts's PREVIEW_TOKEN_PREFIX /
 * resolveMemberActor). Staff-only, gated on portal.preview_as_member.
 *
 * Body: { person_id: string }
 * Response: { token, expires_at, portal_url, person_name }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { requirePermission, PREVIEW_TOKEN_PREFIX } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.FRONTEND_URL || process.env.VERCEL_URL
  ? (process.env.FRONTEND_URL || `https://${process.env.VERCEL_URL}`)
  : 'http://localhost:3000';

const PREVIEW_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough to click through several portal pages

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'portal.preview_as_member');
  if (!actor) return;

  const personId = typeof req.body?.person_id === 'string' ? req.body.person_id : '';
  if (!personId) return res.status(400).json({ error: 'person_id required' });

  const { data: person, error: personErr } = await supabase
    .from('people')
    .select('id, first_name, last_name, portal_enabled')
    .eq('id', personId)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (personErr) return res.status(500).json({ error: 'person_lookup_failed' });
  if (!person) return res.status(404).json({ error: 'person_not_found' });
  if (!person.portal_enabled) {
    return res.status(409).json({ error: 'portal_not_enabled_for_person' });
  }

  const token = PREVIEW_TOKEN_PREFIX + randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();

  const { error: insertErr } = await supabase.from('portal_preview_tokens').insert({
    church_id: actor.churchId,
    person_id: person.id,
    token,
    issued_by_user_id: actor.userId,
    expires_at: expiresAt,
  });
  if (insertErr) return res.status(500).json({ error: 'preview_token_create_failed' });

  const personName = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Member';

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'portal.preview_issued',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'person',
    subjectId: person.id,
    payload: { expires_at: expiresAt },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'create',
    entityType: 'portal_preview_token',
    entityId: person.id,
    after: { expires_at: expiresAt },
    correlationId,
    route: '/api/people/preview-portal-token',
    method: 'POST',
  });

  return res.status(201).json({
    token,
    expires_at: expiresAt,
    person_name: personName,
    portal_url: `${APP_URL}/portal?preview_token=${encodeURIComponent(token)}&preview_name=${encodeURIComponent(personName)}`,
  });
}
