/**
 * POST /api/billing/activate-trial
 *
 * No-Stripe trial activation for environments where STRIPE_SECRET_KEY
 * is not set (dev, staging, demo). Sets subscription_status to 'trial'
 * and trial_ends_at to 14 days from now.
 *
 * SAFETY GATE: this endpoint returns 501 when STRIPE_SECRET_KEY IS set.
 * In production (Stripe configured), all subscriptions go through Stripe
 * Checkout — this endpoint does not exist from the caller's perspective.
 *
 * Auth: valid Clerk JWT required. church_id comes from the JWT, not the
 * request body, so a caller cannot activate a trial for another church.
 *
 * Idempotent: calling again on an already-active trial returns 200 with
 * the current status unchanged.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TRIAL_DAYS = 14;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Gate: only available when Stripe is not configured.
  if (STRIPE_SECRET_KEY) {
    return res.status(501).json({
      error: 'stripe_configured',
      detail: 'This endpoint is not available when Stripe is configured. Use /api/billing/create-checkout-session instead.',
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const { data: church, error: fetchErr } = await supabase
    .from('churches')
    .select('id, name, subscription_status, trial_ends_at')
    .eq('id', auth.churchId)
    .single();

  if (fetchErr || !church) {
    return res.status(404).json({ error: 'church_not_found' });
  }

  // Idempotent: already on trial or active — return current state.
  if (church.subscription_status === 'trial' || church.subscription_status === 'active') {
    return res.status(200).json({
      church_id: church.id,
      subscription_status: church.subscription_status,
      trial_ends_at: church.trial_ends_at,
      already_active: true,
    });
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await supabase
    .from('churches')
    .update({
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt,
    })
    .eq('id', auth.churchId);

  if (updateErr) {
    return res.status(500).json({ error: 'activation_failed', detail: updateErr.message });
  }

  return res.status(200).json({
    church_id: church.id,
    subscription_status: 'trial',
    trial_ends_at: trialEndsAt,
    trial_days: TRIAL_DAYS,
  });
}
