/**
 * POST /api/story/claim
 *
 * Redeems a handoff token on the member's phone and returns their story once.
 *
 * POST-ONLY, AND THAT IS THE POINT. docs/MEMBER_MOBILE_HANDOFF.md: "A GET must
 * not consume the token: scanners and link previews may prefetch it." iOS
 * Camera, Messages and every chat app fetch a URL to build a preview card. If
 * redemption happened on GET, the token would routinely be burned before the
 * member ever tapped anything, and they would be told their story was already
 * taken. The /claim page is static, reads the token from the URL fragment
 * (which never reaches a server at all), shows a confirmation, and only then
 * calls this.
 *
 * Single-use is enforced by redeem_visitor_story_handoff() in migration 082 —
 * one conditional UPDATE, not a SELECT-then-UPDATE. Two phones scanning the
 * same screen: exactly one wins.
 *
 * A token for another tenant returns `unknown`, never "wrong church": this
 * must not confirm that a token exists somewhere else.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';
import { readBody, str } from '../_lib/validation.js';
import { resolvePortalChurchId } from '../_lib/portalTenants.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { hashToken } from './_handoff.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * The attach nonce outlives the claim because Clerk sign-up happens in
 * between. 30 minutes covers reading the story, deciding, and creating an
 * account without leaving a usable handle lying around afterwards.
 */
export const ATTACH_TTL_MS = 30 * 60 * 1000;

/** base64url of 32 random bytes: 43 chars, no padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

const SCHEMA = {
  tenant: str({ max: 64, pattern: /^[a-z0-9-]+$/ }),
  token: str({ required: true, max: 64, pattern: TOKEN_PATTERN }),
};

/** Maps a redemption status to what the phone should say. */
const REFUSAL_MESSAGES: Record<string, string> = {
  expired: 'This code has expired. Open the portal again to create a new one.',
  cancelled: 'This code was cancelled on the other screen.',
  already_used: 'This story has already been brought onto a phone.',
  unknown: "We couldn't find that code.",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // A redeemed story must never sit in a shared cache.
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'service_not_configured' });

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  if (await enforceRateLimit(res, `story-claim:ip:${clientIp(req)}`, 20, 600,
    'Too many attempts from this network. Please wait a few minutes and try again.')) return;

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const churchId = await resolvePortalChurchId(req.headers.host, body.tenant, supabase);
  if (!churchId) return res.status(404).json({ error: 'claim_not_available_on_this_domain' });

  const { data, error } = await supabase.rpc('redeem_visitor_story_handoff', {
    p_token_sha256: hashToken(body.token),
    p_church_id: churchId,
  });
  if (error) return res.status(500).json({ error: 'claim_failed' });

  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status as string | undefined;

  if (status !== 'ok' || !row?.draft_id) {
    const refusal = status && status in REFUSAL_MESSAGES ? status : 'unknown';
    await emitPlatformEvent(supabase, {
      churchId,
      eventType: 'story.handoff_refused',
      sourceApp: 'member_portal',
      subjectType: 'visitor_story_handoff',
      payload: { reason: refusal },
    });
    // 410 for a token that existed and is spent; 404 for one we cannot place.
    const httpStatus = refusal === 'unknown' ? 404 : 410;
    return res.status(httpStatus).json({ error: refusal, message: REFUSAL_MESSAGES[refusal] });
  }

  const { data: draft, error: draftErr } = await supabase
    .from('visitor_story_drafts')
    .select('id, preferred_name, sections, segments, consent_followup, consent_money_sections')
    .eq('id', row.draft_id)
    .eq('church_id', churchId)
    .single();
  if (draftErr || !draft) return res.status(500).json({ error: 'story_unavailable' });

  // Minted here rather than at handoff time: it only becomes useful once the
  // story is actually on a phone, and a shorter life starts from that moment.
  const attachNonce = randomBytes(32).toString('base64url');
  const attachExpiresAt = new Date(Date.now() + ATTACH_TTL_MS);
  const { error: nonceErr } = await supabase
    .from('visitor_story_drafts')
    .update({
      attach_nonce_sha256: createHash('sha256').update(attachNonce).digest('hex'),
      attach_expires_at: attachExpiresAt.toISOString(),
    })
    .eq('id', draft.id)
    .eq('church_id', churchId);
  if (nonceErr) return res.status(500).json({ error: 'claim_failed' });

  await emitPlatformEvent(supabase, {
    churchId,
    eventType: 'story.handoff_redeemed',
    sourceApp: 'member_portal',
    subjectType: 'visitor_story_draft',
    subjectId: draft.id,
    payload: { section_count: Object.keys(draft.sections ?? {}).length },
  });

  return res.status(200).json({
    ok: true,
    draft_id: draft.id,
    attach_nonce: attachNonce,
    attach_expires_at: attachExpiresAt.toISOString(),
    preferred_name: draft.preferred_name,
    sections: draft.sections ?? {},
    segments: draft.segments ?? {},
    consent_followup: draft.consent_followup,
    consent_money_sections: draft.consent_money_sections,
  });
}
