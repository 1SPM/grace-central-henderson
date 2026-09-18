/**
 * POST /api/story/cancel
 *
 * Retires a handoff code before it expires. The code is displayed on a screen
 * other people can see, so the member needs a way to kill it: when they walk
 * away, ask for a fresh one, or leave the page.
 *
 * Idempotent and deliberately uninformative — it returns the same 200 whether
 * the token was cancelled, already spent, or never existed. This route needs
 * no secrecy of its own, but it must not become an oracle for guessing which
 * tokens are real.
 *
 * Cancelling is not the same as expiring: redeem_visitor_story_handoff()
 * reports them separately, so the phone can say "this was cancelled on the
 * other screen" rather than implying time ran out.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { readBody, str } from '../_lib/validation.js';
import { resolvePortalChurchId } from '../_lib/portalTenants.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';
import { hashToken } from './_handoff.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  tenant: str({ max: 64, pattern: /^[a-z0-9-]+$/ }),
  token: str({ required: true, max: 64, pattern: /^[A-Za-z0-9_-]{20,64}$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'service_not_configured' });

  // sendBeacon posts a Blob, which arrives unparsed on some runtimes.
  let raw: unknown = req.body;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = {}; } }
  const body = readBody({ body: raw ?? {} }, res, SCHEMA);
  if (!body) return;

  if (await enforceRateLimit(res, `story-cancel:ip:${clientIp(req)}`, 30, 600,
    'Too many requests from this network. Please wait a few minutes and try again.')) return;

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const churchId = await resolvePortalChurchId(req.headers.host, body.tenant, supabase);
  if (!churchId) return res.status(404).json({ error: 'cancel_not_available_on_this_domain' });

  // Only an unredeemed, uncancelled token changes: cancelling after the fact
  // must not overwrite the record of a successful redemption.
  await supabase
    .from('visitor_story_handoffs')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('token_sha256', hashToken(body.token))
    .eq('church_id', churchId)
    .is('redeemed_at', null)
    .is('cancelled_at', null);

  return res.status(200).json({ ok: true });
}
