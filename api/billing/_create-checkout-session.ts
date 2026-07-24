/**
 * POST /api/billing/create-checkout-session
 *
 * Creates a Stripe Checkout Session for a church to subscribe to a SaaS
 * plan. Returns the Checkout URL — caller redirects the browser.
 *
 * This is the entry point of the sign-up flow:
 *   1. New church signs up (Clerk) → we create a Supabase `churches` row
 *   2. UI calls this endpoint with { plan_slug, church_id }
 *   3. We create or find the Stripe customer, create a Checkout Session,
 *      return the URL.
 *   4. UI redirects to Stripe-hosted checkout.
 *   5. On success, Stripe fires customer.subscription.created → our
 *      webhook updates churches.subscription_status to 'trial' or 'active'.
 *
 * Auth: this endpoint accepts BOTH a Clerk JWT (for existing logged-in
 * users upgrading from trial) AND an unauthenticated request that
 * carries a fresh church_id created by the sign-up flow (the church_id
 * itself is the proof — it was just created server-side moments before).
 *
 * NOTE on church_id from request body: we accept it here ONLY because
 * this route runs at sign-up before the user has a Clerk session bound
 * to the church. We mitigate by:
 *   1. Verifying the church_id exists in Supabase
 *   2. Verifying subscription_status is NULL (church has never paid) —
 *      protects against using this endpoint to switch an existing
 *      church's plan without auth
 *   3. The Checkout Session metadata is set server-side; user can't
 *      tamper with the plan/price after this point
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getPlanBySlug, getStripePriceId, type PlanSlug } from '../_lib/billing/plans.js';
import { checkStripeEnvSafety } from '../_lib/billing/stripeMode.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://grace-crm.app';

const SCHEMA = {
  church_id: uuid_({ required: true }),
  plan_slug: str({ required: true, max: 40, pattern: /^(starter|pro|enterprise)$/ }),
  success_path: str({ max: 200 }),
  cancel_path: str({ max: 200 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'stripe_not_configured',
      detail: 'STRIPE_SECRET_KEY env var is not set. Cannot create checkout sessions in this environment.',
    });
  }
  // Refuse to create real charges from a non-production deploy running a live key.
  const modeCheck = checkStripeEnvSafety({ secretKey: STRIPE_SECRET_KEY, vercelEnv: process.env.VERCEL_ENV });
  if (!modeCheck.ok) {
    console.error('[billing] stripe env unsafe:', modeCheck.reason);
    return res.status(503).json({ error: 'stripe_env_unsafe', detail: modeCheck.reason });
  }
  if (modeCheck.warning) console.warn('[billing] stripe env:', modeCheck.warning);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'supabase_not_configured' });
  }

  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { church_id, plan_slug, success_path, cancel_path } = body;

  const plan = getPlanBySlug(plan_slug as PlanSlug);
  if (!plan) {
    return res.status(400).json({ error: 'unknown_plan', detail: `plan_slug=${plan_slug} not in catalog` });
  }

  const priceId = getStripePriceId(plan.slug);
  if (!priceId) {
    return res.status(503).json({
      error: 'plan_not_provisioned',
      detail: `STRIPE_PRICE_${plan.slug.toUpperCase()} env var is not set. Operator needs to create the Stripe Price and set the env var.`,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch church + verify it exists and has not yet paid
  const { data: church, error: churchErr } = await supabase
    .from('churches')
    .select('id, name, stripe_customer_id, subscription_status')
    .eq('id', church_id!)
    .single();
  if (churchErr || !church) {
    return res.status(404).json({ error: 'church_not_found' });
  }
  if (church.subscription_status && church.subscription_status !== 'incomplete') {
    return res.status(409).json({
      error: 'already_subscribed',
      detail: 'Church already has a subscription. Use /api/billing/portal-session to manage it.',
    });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion });

  // Create or reuse the Stripe customer for this church
  let stripeCustomerId = church.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: church.name,
      metadata: { church_id: church.id },
    });
    stripeCustomerId = customer.id;
    await supabase
      .from('churches')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', church.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}${success_path || '/welcome'}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}${cancel_path || '/pricing'}?canceled=1`,
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        church_id: church.id,
        plan_slug: plan.slug,
        purpose: 'saas',
      },
    },
    metadata: {
      church_id: church.id,
      plan_slug: plan.slug,
      purpose: 'saas',
    },
    allow_promotion_codes: true,
    automatic_tax: { enabled: false },
  });

  return res.status(200).json({
    checkout_url: session.url,
    session_id: session.id,
  });
}
