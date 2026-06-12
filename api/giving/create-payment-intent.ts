/**
 * POST /api/giving/create-payment-intent
 *
 * PUBLIC endpoint for online donations. Creates a Stripe PaymentIntent
 * routed through the church's connected Express account with our
 * platform fee deducted via application_fee_amount.
 *
 * Flow:
 *   1. Member visits /give/<church_slug>
 *   2. Page POSTs here with { church_slug, amount_cents, fund, email }
 *   3. We look up church by slug, verify Stripe Connect charges_enabled
 *   4. Create PaymentIntent on PLATFORM account with:
 *      - transfer_data.destination = church's connected account
 *      - application_fee_amount = amount × PLATFORM_FEE_BPS / 10000
 *   5. Return clientSecret + stripeAccount (the church account, for
 *      the SDK to render against)
 *
 * No auth required — donations are public. We protect by:
 *   - Slug must match an existing church row
 *   - That church must have stripe_connect_charges_enabled
 *   - Amount validated within sensible bounds ($1 minimum, $50k max)
 *   - Rate limit per IP applied at the API gateway (not here)
 *
 * NOTE: This does NOT write a giving row yet. The Stripe webhook
 * (payment_intent.succeeded) handles that — see
 * api/_lib/webhooks/stripe-handlers.ts:handlePaymentIntentSucceeded.
 * Metadata on the PI carries church_id + fund + donor_email so the
 * webhook can attribute correctly.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { readBody, str, int_, email_ } from '../_lib/validation.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Platform fee in basis points. 250 = 2.50%. Matches SettingsGiving display. */
const PLATFORM_FEE_BPS = 250;

const SCHEMA = {
  church_slug: str({ required: true, max: 100, pattern: /^[a-z0-9-]+$/ }),
  amount_cents: int_({ required: true, min: 100, max: 5_000_000 }),   // $1 — $50,000
  fund: str({ max: 100 }),
  email: email_({ max: 320 }),
  donor_name: str({ max: 200 }),
  note: str({ max: 500 }),
  // Member-portal gifts attach the giver's person record so the webhook
  // attributes the giving row to them (admin GivingDashboard + history).
  person_id: str({ max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { church_slug, amount_cents, fund, email, donor_name, note, person_id } = body;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: church, error } = await supabase
    .from('churches')
    .select('id, name, stripe_connect_account_id, stripe_connect_charges_enabled')
    .eq('slug', church_slug)
    .single();

  if (error || !church) {
    return res.status(404).json({ error: 'church_not_found' });
  }
  if (!church.stripe_connect_account_id || !church.stripe_connect_charges_enabled) {
    return res.status(409).json({
      error: 'giving_not_active',
      detail: 'This church has not finished setting up online giving yet.',
    });
  }

  // Attribution guard: only attach person_id if that person actually
  // belongs to this church (prevents cross-tenant attribution spoofing).
  let verifiedPersonId: string | null = null;
  if (person_id) {
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', person_id)
      .eq('church_id', church.id)
      .maybeSingle();
    verifiedPersonId = person?.id ?? null;
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  });

  const platformFeeCents = Math.floor((amount_cents! * PLATFORM_FEE_BPS) / 10_000);

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amount_cents!,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      // Route to the church's connected Express account.
      // transfer_data.destination + application_fee_amount lets Stripe
      // split the charge automatically — funds settle in the church's
      // account; our platform fee lands in our balance.
      transfer_data: { destination: church.stripe_connect_account_id },
      application_fee_amount: platformFeeCents,
      description: `Donation to ${church.name}${fund ? ` — ${fund}` : ''}`,
      receipt_email: email ?? undefined,
      metadata: {
        purpose: 'giving',
        church_id: church.id,
        fund: fund || 'general',
        donor_email: email || '',
        donor_name: donor_name || '',
        platform_fee_bps: String(PLATFORM_FEE_BPS),
        note: note || '',
        ...(verifiedPersonId ? { person_id: verifiedPersonId } : {}),
      },
    });

    return res.status(200).json({
      client_secret: intent.client_secret,
      amount_cents: intent.amount,
      platform_fee_cents: platformFeeCents,
      church_name: church.name,
      // For Stripe.js SDK: when using Elements with a Connected Account
      // direct charge, pass this account ID as `stripeAccount` option.
      // We're using DESTINATION charges (transfer_data.destination), so
      // the SDK uses the PLATFORM account — no stripeAccount needed.
      // Field is returned for forward-compat if we switch to direct charges.
      stripe_account: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(502).json({ error: 'stripe_error', detail: msg });
  }
}
