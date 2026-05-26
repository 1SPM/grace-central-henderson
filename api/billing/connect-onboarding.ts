/**
 * POST /api/billing/connect-onboarding
 *
 * Creates (if needed) a Stripe Express Connect account for the
 * church, then generates a one-time Onboarding Link URL the admin
 * can be redirected to. Stripe collects business info, bank account,
 * and verification documents directly — VWS never touches them.
 *
 * Once onboarding completes (or partially completes), Stripe fires
 * an `account.updated` webhook that our handler uses to mirror
 * charges_enabled / payouts_enabled / requirements into the
 * churches.stripe_connect_* columns.
 *
 * Auth: Clerk JWT, role must be admin (only the church admin should
 * be able to start banking onboarding).
 *
 * Response: { onboarding_url, account_id, completed }
 *   - completed=true means charges_enabled was already TRUE — admin
 *     was probably hitting this endpoint to RE-onboard after a
 *     requirement (additional docs etc).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://grace-crm.app';

const ALLOWED_ROLES = ['admin', 'platform_admin'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req, { allowedRoles: ALLOWED_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: church, error: chErr } = await supabase
    .from('churches')
    .select('id, name, stripe_connect_account_id, stripe_connect_charges_enabled')
    .eq('id', auth.churchId)
    .single();
  if (chErr || !church) return res.status(404).json({ error: 'church_not_found' });

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  });

  // Create the Express account if the church doesn't have one yet.
  let accountId = church.stripe_connect_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      business_type: 'non_profit',
      business_profile: {
        name: church.name,
        product_description: 'Charitable donations and church operating revenue',
        mcc: '8661',   // Religious organizations
        url: APP_URL,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { church_id: church.id, purpose: 'giving' },
    });
    accountId = account.id;
    const { error: updateErr } = await supabase
      .from('churches')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', church.id);
    if (updateErr) {
      // Race or constraint violation — fetch what landed and continue
      console.error('[connect-onboarding] could not write account_id', updateErr.message);
    }
  }

  // Stripe Account Links are single-use; create one for THIS request.
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/#settings`,
    return_url: `${APP_URL}/#settings?stripe_connect=ok`,
    type: 'account_onboarding',
    collection_options: { fields: 'currently_due' },
  });

  return res.status(200).json({
    onboarding_url: link.url,
    account_id: accountId,
    completed: !!church.stripe_connect_charges_enabled,
  });
}
