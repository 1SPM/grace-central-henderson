/**
 * POST /api/giving/request-donor-portal
 *
 * PUBLIC endpoint. Donor enters email; we mint a single-use magic-link
 * token, email it to them. The link points at
 * /api/giving/donor-portal-callback?token=xxx which exchanges to a
 * Stripe Customer Portal session.
 *
 * Security:
 *   - Token is 32 bytes of crypto.randomBytes, base64url-encoded —
 *     128 bits of entropy. SHA-256 hashed before storing; raw token
 *     only lives in the URL + the donor's inbox.
 *   - 30-minute TTL.
 *   - Single-use (consumed_at).
 *   - Rate limit: max 3 active (unconsumed, unexpired) tokens per email.
 *
 * Privacy:
 *   - We DON'T leak whether the email has any matching donor record
 *     to Stripe. Every well-formed request returns 200 — the email
 *     either lands or doesn't (silent fail by design).
 *   - This makes the endpoint safe against email-enumeration.
 *
 * No auth. Same protection model as the rest of the public donate flow.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { readBody, str, email_ } from '../_lib/validation.js';
import { queueEmail } from '../_lib/email/queue.js';
import { renderDonorPortalLinkEmail } from '../_lib/email/templates/donor-portal-link.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://grace-crm.app';

const TOKEN_TTL_MS = 30 * 60 * 1000;       // 30 minutes
const MAX_ACTIVE_PER_EMAIL = 3;

const SCHEMA = {
  church_slug: str({ required: true, max: 100, pattern: /^[a-z0-9-]+$/ }),
  email: email_({ required: true, max: 320 }),
};

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { church_slug, email } = body;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: church } = await supabase
    .from('churches')
    .select('id, name, stripe_connect_charges_enabled')
    .eq('slug', church_slug)
    .single();

  // Return success even on church-not-found to avoid leaking which slugs are valid.
  if (!church || !church.stripe_connect_charges_enabled) {
    return res.status(200).json({ ok: true, sent: false });
  }

  // Rate limit: count active tokens for this email
  const nowIso = new Date().toISOString();
  const { count: activeCount } = await supabase
    .from('donor_portal_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('email', email!)
    .is('consumed_at', null)
    .gt('expires_at', nowIso);

  if (activeCount !== null && activeCount >= MAX_ACTIVE_PER_EMAIL) {
    // Still return 200 to avoid email-enumeration probing
    return res.status(200).json({ ok: true, sent: false, throttled: true });
  }

  // Mint token
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const { error: insertErr } = await supabase
    .from('donor_portal_tokens')
    .insert({
      church_id: church.id,
      email: email!,
      token_hash: tokenHash,
      expires_at: expiresAt,
      request_ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? null,
      request_ua: (req.headers['user-agent'] as string | undefined) ?? null,
    });

  if (insertErr) {
    // Don't leak DB errors to the public — but still log
    console.error('[request-donor-portal] insert failed', insertErr.message);
    return res.status(200).json({ ok: true, sent: false });
  }

  const link = `${APP_URL}/api/giving/donor-portal-callback?token=${encodeURIComponent(rawToken)}`;
  const { subject, html } = renderDonorPortalLinkEmail({
    churchName: church.name,
    link,
  });

  // Use the raw token in the idempotency key — guarantees one email per
  // mint, while a re-request (different token) sends a fresh email.
  try {
    await queueEmail({
      supabase,
      churchId: church.id,
      toAddr: email!,
      subject,
      templateId: 'donor_portal_link.v1',
      html,
      idempotencyKey: `donor_portal:${tokenHash}`,
      sendNow: true,
      metadata: { church_id: church.id },
    });
  } catch (err) {
    console.error('[request-donor-portal] email queue failed', err);
  }

  return res.status(200).json({ ok: true, sent: true });
}
