/**
 * POST /api/giving/create-subscription
 *
 * Recurring-giving sibling to create-payment-intent. Creates a Stripe
 * Subscription routed through the church's Connected Account with our
 * platform fee deducted via application_fee_percent.
 *
 * Flow:
 *   1. Validate inputs + church Connect status (same as one-time)
 *   2. Find-or-create a Stripe customer (de-dupe by email if provided)
 *   3. Create an ad-hoc Price on the platform (recurring monthly/weekly)
 *      with product_data inline — keeps the price catalog clean
 *   4. Create the Subscription with:
 *        application_fee_percent = 2.5
 *        transfer_data.destination = church Stripe Connect account
 *        payment_behavior = 'default_incomplete' so we can confirm
 *        the first invoice's PaymentIntent via Stripe Elements
 *   5. Return the first invoice's payment_intent client_secret
 *
 * After the first successful payment, Stripe handles renewal
 * automatically. Each renewal fires:
 *   - invoice.paid  → existing handleInvoicePaid writes giving row
 *   - customer.subscription.updated → existing handleSubscriptionLifecycle
 *     keeps recurring_giving status in sync
 *
 * No auth required. Same protection model as create-payment-intent:
 * slug + Connect-enabled + sensible amount bounds.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { readBody, str, int_, email_ } from '../_lib/validation.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLATFORM_FEE_PERCENT = 2.5;

const SCHEMA = {
  church_slug: str({ required: true, max: 100, pattern: /^[a-z0-9-]+$/ }),
  amount_cents: int_({ required: true, min: 100, max: 5_000_000 }),
  /** Stripe recurring intervals we expose to donors. */
  frequency: str({ required: true, max: 20, pattern: /^(weekly|monthly|yearly)$/ }),
  fund: str({ max: 100 }),
  email: email_({ max: 320 }),
  donor_name: str({ max: 200 }),
  note: str({ max: 500 }),
  // Member-portal gifts attach the giver's person record for attribution.
  person_id: str({ max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
};

const FREQUENCY_TO_STRIPE: Record<string, { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number }> = {
  weekly:  { interval: 'week',  interval_count: 1 },
  monthly: { interval: 'month', interval_count: 1 },
  yearly:  { interval: 'year',  interval_count: 1 },
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
  const { church_slug, amount_cents, frequency, fund, email, donor_name, note, person_id } = body;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: church, error } = await supabase
    .from('churches')
    .select('id, name, stripe_connect_account_id, stripe_connect_charges_enabled')
    .eq('slug', church_slug)
    .single();

  if (error || !church) return res.status(404).json({ error: 'church_not_found' });
  if (!church.stripe_connect_account_id || !church.stripe_connect_charges_enabled) {
    return res.status(409).json({
      error: 'giving_not_active',
      detail: 'This church has not finished setting up online giving yet.',
    });
  }

  // Attribution guard: only attach person_id if that person belongs to
  // this church (prevents cross-tenant attribution spoofing).
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

  try {
    // Find-or-create customer. De-dupe by email so a donor who already
    // has a subscription doesn't accumulate parallel customers.
    let customerId: string;
    if (email) {
      const existing = await stripe.customers.list({ email: email!, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const c = await stripe.customers.create({
          email: email!,
          name: donor_name || undefined,
          metadata: { purpose: 'giving', church_id: church.id },
        });
        customerId = c.id;
      }
    } else {
      const c = await stripe.customers.create({
        name: donor_name || undefined,
        metadata: { purpose: 'giving', church_id: church.id, anonymous: 'true' },
      });
      customerId = c.id;
    }

    const recurringSpec = FREQUENCY_TO_STRIPE[frequency!];
    const price = await stripe.prices.create({
      unit_amount: amount_cents!,
      currency: 'usd',
      recurring: recurringSpec,
      product_data: { name: `${frequency} gift to ${church.name}${fund ? ` — ${fund}` : ''}` },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      application_fee_percent: PLATFORM_FEE_PERCENT,
      transfer_data: { destination: church.stripe_connect_account_id },
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        purpose: 'giving',
        church_id: church.id,
        fund: fund || 'general',
        donor_email: email || '',
        donor_name: donor_name || '',
        platform_fee_percent: String(PLATFORM_FEE_PERCENT),
        note: note || '',
        frequency: frequency!,
        ...(verifiedPersonId ? { person_id: verifiedPersonId } : {}),
      },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const pi = invoice?.payment_intent as Stripe.PaymentIntent | null;
    if (!pi?.client_secret) {
      return res.status(502).json({
        error: 'no_client_secret',
        detail: 'Stripe did not return a client secret for the first invoice.',
      });
    }

    return res.status(200).json({
      client_secret: pi.client_secret,
      subscription_id: subscription.id,
      amount_cents: amount_cents,
      frequency,
      church_name: church.name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(502).json({ error: 'stripe_error', detail: msg });
  }
}
