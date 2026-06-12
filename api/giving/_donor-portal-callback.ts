/**
 * GET /api/giving/donor-portal-callback?token=<raw>
 *
 * Validates the magic-link token, finds the donor's Stripe customer
 * record, creates a Stripe Customer Portal session, and redirects to it.
 *
 * Flow:
 *   1. Hash token, look up donor_portal_tokens row
 *   2. Check: not consumed, not expired, matches
 *   3. Find Stripe customer by email (the one we created during their
 *      first donation / subscription)
 *   4. Create Customer Portal session
 *   5. Mark token consumed
 *   6. 302 to portal URL
 *
 * Errors render a friendly HTML page (not JSON) since the browser
 * comes here directly from an email click.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://grace-crm.app';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function renderErrorPage(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #fef3c7; margin: 0; padding: 40px 20px; min-height: 100vh; }
  .card { max-width: 480px; margin: 0 auto; background: white; padding: 32px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-align: center; }
  h1 { margin: 0 0 12px; color: #111827; font-weight: 500; }
  p { color: #374151; line-height: 1.5; }
  a { color: #b45309; }
</style></head>
<body><div class="card"><h1>${title}</h1>${body}<p style="margin-top:24px;font-size:13px;color:#6b7280;">Need help? Email <a href="mailto:support@grace-crm.app">support@grace-crm.app</a>.</p></div></body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(503).send(renderErrorPage(
      'Service not available',
      '<p>Donor self-service is not configured. Please contact the church directly.</p>',
    ));
  }

  const rawToken = String(req.query.token ?? '').trim();
  if (!rawToken || rawToken.length < 20) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(renderErrorPage(
      'Invalid link',
      '<p>This link is missing or malformed. Please request a fresh link.</p>',
    ));
  }

  const tokenHash = hashToken(rawToken);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Look up the token
  const { data: tokenRow } = await supabase
    .from('donor_portal_tokens')
    .select('id, church_id, email, consumed_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!tokenRow) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(404).send(renderErrorPage(
      'Link not found',
      '<p>This link is invalid or has already been used. <a href="' + APP_URL + '">Request a fresh link</a>.</p>',
    ));
  }
  if (tokenRow.consumed_at) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(410).send(renderErrorPage(
      'Link already used',
      '<p>Magic links are single-use for your security. Request a fresh link from your church\'s giving page.</p>',
    ));
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(410).send(renderErrorPage(
      'Link expired',
      '<p>This link expired (links are valid for 30 minutes for your security). Request a fresh link.</p>',
    ));
  }

  // Find the Stripe customer for this email
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  });

  let customerId: string | null = null;
  try {
    const list = await stripe.customers.list({ email: tokenRow.email, limit: 1 });
    if (list.data.length > 0) {
      customerId = list.data[0].id;
    }
  } catch (err) {
    console.error('[donor-portal-callback] stripe lookup failed', err);
  }

  if (!customerId) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(404).send(renderErrorPage(
      'No giving on file',
      '<p>We couldn\'t find any giving records under this email address. If you recently gave a one-time gift, there\'s nothing to manage. Recurring gifts may take a moment to register — try again in a few minutes.</p>',
    ));
  }

  // Mark the token consumed BEFORE creating the portal session so a
  // double-click during the Stripe redirect doesn't burn two sessions.
  await supabase
    .from('donor_portal_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  // Create the portal session
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: APP_URL,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, session.url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.setHeader('Content-Type', 'text/html');
    if (msg.includes('No configuration')) {
      return res.status(503).send(renderErrorPage(
        'Portal not configured',
        '<p>The donor portal isn\'t set up yet. Please contact your church to manage your giving directly.</p>',
      ));
    }
    return res.status(502).send(renderErrorPage(
      'Couldn\'t open portal',
      `<p>Stripe returned an error: <code>${msg.replace(/[<>]/g, '')}</code>. Try again in a moment or contact your church directly.</p>`,
    ));
  }
}
