/**
 * POST /api/story/handoff
 *
 * Ends the portal walkthrough: stores the visitor's reviewed answers and mints
 * a short-lived, one-use token for their phone. Anonymous by design — the
 * whole point is that someone can carry their story to a phone and decide
 * about an account afterwards, not before.
 *
 * WHAT THE QR CARRIES. A URL with the token in the FRAGMENT:
 *
 *     https://<host>/claim#t=<token>
 *
 * A fragment is never sent to the server, so the token cannot reach access
 * logs, analytics or a Referer header. docs/MEMBER_MOBILE_HANDOFF.md asks for
 * the token to be cleared from the URL after use; putting it in the fragment
 * means it was never anywhere it had to be cleared from.
 *
 * WHY THE QR IS RENDERED HERE. The member portal is a static, bundler-less
 * page, and the existing QR call sites use api.qrserver.com — a third party
 * that receives the encoded URL on every render. Fine for a public page URL,
 * disqualifying for a token. Rendering to a PNG data URL server-side keeps the
 * token inside our own infrastructure and needs no CSP change (img-src already
 * allows data:). This is a deliberate deviation from step 4 of
 * MEMBER_MOBILE_HANDOFF.md, which says "render QR locally" meaning "not via the
 * third-party service" — the requirement it protects is met.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { readBody, str, bool_ } from '../_lib/validation.js';
import { resolvePortalChurchId, portalTenantSlug } from '../_lib/portalTenants.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import {
  validateSections,
  validateSegments,
  MAX_PREFERRED_NAME_CHARS,
} from '../_lib/storySegments.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * 15 minutes. 045_portal_preview_tokens uses 10 for a staff preview; this one
 * needs slack for venue wifi and a phone that has to be unlocked and pointed at
 * a screen, without leaving a live handoff on an unattended display for long.
 */
export const HANDOFF_TTL_MS = 15 * 60 * 1000;

const SCHEMA = {
  tenant: str({ max: 64, pattern: /^[a-z0-9-]+$/ }),
  preferredName: str({ max: MAX_PREFERRED_NAME_CHARS }),
  consentCarryStory: bool_(),
  consentMoneySections: bool_(),
  consentFollowup: bool_(),
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'service_not_configured' });

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  // Carrying the story is the entire purpose of this route. Declining is a
  // real, offered outcome in the UI — it just doesn't call this endpoint.
  if (body.consentCarryStory !== true) {
    return res.status(400).json({ error: 'consent_required', detail: 'consentCarryStory must be true', path: 'consentCarryStory' });
  }

  const allowMoney = body.consentMoneySections === true;
  const raw = (req.body ?? {}) as Record<string, unknown>;

  const sections = validateSections(raw.sections, allowMoney);
  if (!sections.ok) {
    return res.status(400).json({ error: 'invalid_request', detail: sections.error, path: sections.path });
  }
  const segments = validateSegments(raw.segments);
  if (!segments.ok) {
    return res.status(400).json({ error: 'invalid_request', detail: segments.error, path: segments.path });
  }

  // Public, no-login surface. A workshop room shares one NAT, so this has to
  // clear a whole cohort in a few minutes — but it mints tokens, so it is
  // tighter than the workshop routes' 40/300.
  if (await enforceRateLimit(res, `story-handoff:ip:${clientIp(req)}`, 20, 600,
    'Too many handoffs from this network. Please wait a few minutes and try again.')) return;

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const churchId = await resolvePortalChurchId(req.headers.host, body.tenant, supabase);
  if (!churchId) return res.status(404).json({ error: 'handoff_not_available_on_this_domain' });

  const { data: draft, error: draftErr } = await supabase
    .from('visitor_story_drafts')
    .insert({
      church_id: churchId,
      preferred_name: body.preferredName ?? null,
      sections: sections.value,
      segments: segments.value,
      consent_carry_story: true,
      consent_money_sections: allowMoney,
      consent_followup: body.consentFollowup === true,
      source: body.tenant ? `${body.tenant}_portal` : 'portal',
    })
    .select('id')
    .single();
  if (draftErr || !draft) return res.status(500).json({ error: 'story_save_failed' });

  // 32 bytes: this token is displayed on a screen in a room full of people,
  // rather than minted for one authenticated staff member as in 045.
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);

  const { error: tokenErr } = await supabase
    .from('visitor_story_handoffs')
    .insert({
      church_id: churchId,
      draft_id: draft.id,
      token_sha256: hashToken(token),
      expires_at: expiresAt.toISOString(),
    });
  if (tokenErr) return res.status(500).json({ error: 'handoff_create_failed' });

  // Prefer the configured portal origin (the same env var
  // api/people/_preview-portal-token.ts uses) so the QR always points at the
  // real portal. Fall back to the request's own host, honouring
  // x-forwarded-proto so a local http QA run produces a scannable URL rather
  // than an https one nothing is serving.
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const host = req.headers.host ?? '';
  const proto = forwardedProto || (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? 'http' : 'https');
  const origin = process.env.MEMBER_PORTAL_URL || `${proto}://${host}`;
  // The tenant travels in the QUERY, the token in the FRAGMENT. Both are
  // needed and they have different secrecy: /claim must tell the API which
  // church to look the token up in — on the shared host, without this, a
  // Faithful token would be looked up against Central Henderson and come back
  // 'unknown'. The slug is not a secret and is safe in the query; the token is,
  // and stays out of every log by living in the fragment.
  const claimUrl = `${origin}/claim?tenant=${portalTenantSlug(churchId)}#t=${token}`;
  let qrPngDataUrl: string | null = null;
  try {
    qrPngDataUrl = await QRCode.toDataURL(claimUrl, { width: 256, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    // A missing QR image is a degraded experience, not a failed handoff: the
    // page can still show the link. Never lose a minted token over rendering.
    qrPngDataUrl = null;
  }

  // Ids, counts and expiry only — never the story itself.
  await emitPlatformEvent(supabase, {
    churchId,
    eventType: 'story.handoff_issued',
    sourceApp: 'member_portal',
    subjectType: 'visitor_story_draft',
    subjectId: draft.id,
    payload: {
      section_count: Object.keys(sections.value).length,
      segment_count: Object.keys(segments.value).length,
      money_sections_included: allowMoney,
      followup_consented: body.consentFollowup === true,
      expires_at: expiresAt.toISOString(),
    },
  });

  return res.status(201).json({
    ok: true,
    token,
    claim_url: claimUrl,
    qr_png_data_url: qrPngDataUrl,
    expires_at: expiresAt.toISOString(),
    expires_in_seconds: Math.floor(HANDOFF_TTL_MS / 1000),
  });
}
