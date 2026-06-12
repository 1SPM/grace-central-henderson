/**
 * POST /api/billing/portal-session
 *
 * Creates a Stripe Billing Portal session for the church to self-manage:
 * update payment method, change plan, cancel, download invoices.
 *
 * Auth: requires Clerk JWT (logged-in church admin). We look up their
 * church_id from public_metadata and verify the church has an existing
 * Stripe customer.
 *
 * Stripe Billing Portal must be configured ONCE in the Stripe dashboard
 * (allowed plan changes, cancellation policy, invoice access). Without
 * that config, Stripe returns a clear error which we surface as 503.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient, verifyToken } from '@clerk/backend';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://grace-crm.app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CLERK_SECRET_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'auth_required' });
  }

  let payload: { sub?: string };
  try {
    payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
  const clerkUserId = payload.sub;
  if (!clerkUserId) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const user = await clerk.users.getUser(clerkUserId);
  const churchId = (user.publicMetadata?.church_id as string | undefined)
                 ?? (user.privateMetadata?.church_id as string | undefined);
  if (!churchId) {
    return res.status(403).json({ error: 'no_church', detail: 'User has no church_id in metadata' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: church, error } = await supabase
    .from('churches')
    .select('id, stripe_customer_id')
    .eq('id', churchId)
    .single();
  if (error || !church?.stripe_customer_id) {
    return res.status(404).json({ error: 'no_customer', detail: 'Church has no Stripe customer yet — sign up first.' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: church.stripe_customer_id,
      return_url: `${APP_URL}/settings/billing`,
    });
    return res.status(200).json({ portal_url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    if (msg.includes('No configuration')) {
      return res.status(503).json({
        error: 'portal_not_configured',
        detail: 'Stripe Billing Portal must be configured in the Stripe dashboard before this endpoint works.',
      });
    }
    return res.status(502).json({ error: 'stripe_error', detail: msg });
  }
}
