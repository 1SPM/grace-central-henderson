/**
 * GET /api/billing/connect-status
 *
 * Returns the current Stripe Connect state for the church. Refreshes
 * from Stripe on demand (cheap one-call) so the admin doesn't have to
 * wait for an `account.updated` webhook to see status changes after
 * completing onboarding in another tab.
 *
 * Side effect: also writes the freshest state to
 * churches.stripe_connect_charges_enabled / payouts_enabled / details
 * so the rest of the app (giving routes that require an enabled
 * account) sees the truth immediately.
 *
 * Auth: Clerk JWT, any role (read-only).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: church } = await supabase
    .from('churches')
    .select('id, slug, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details')
    .eq('id', auth.churchId)
    .single();
  if (!church) return res.status(404).json({ error: 'church_not_found' });

  // Not yet started — quick return, no Stripe call
  if (!church.stripe_connect_account_id) {
    return res.status(200).json({
      connected: false,
      account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      currently_due: [],
      disabled_reason: null,
      church_slug: church.slug,
    });
  }

  // Refresh from Stripe (one call) — covers the case where the webhook
  // hasn't landed yet after the admin completed onboarding in another tab.
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  });

  let account: Stripe.Account;
  try {
    account = await stripe.accounts.retrieve(church.stripe_connect_account_id);
  } catch (err) {
    return res.status(502).json({
      error: 'stripe_fetch_failed',
      detail: err instanceof Error ? err.message : 'unknown',
    });
  }

  const chargesEnabled = !!account.charges_enabled;
  const payoutsEnabled = !!account.payouts_enabled;
  const currentlyDue = account.requirements?.currently_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;
  const details = {
    business_type: account.business_type,
    currently_due: currentlyDue,
    disabled_reason: disabledReason,
    details_submitted: account.details_submitted,
  };

  // Mirror onto churches if anything changed
  const previouslyEnabled = !!church.stripe_connect_charges_enabled;
  const updatePayload: Record<string, unknown> = {
    stripe_connect_charges_enabled: chargesEnabled,
    stripe_connect_payouts_enabled: payoutsEnabled,
    stripe_connect_details: details,
  };
  if (!previouslyEnabled && chargesEnabled) {
    updatePayload.stripe_connect_onboarded_at = new Date().toISOString();
  }
  await supabase.from('churches').update(updatePayload).eq('id', church.id);

  return res.status(200).json({
    connected: true,
    account_id: church.stripe_connect_account_id,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    currently_due: currentlyDue,
    disabled_reason: disabledReason,
    details_submitted: !!account.details_submitted,
    church_slug: church.slug,
  });
}
