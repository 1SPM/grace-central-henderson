/**
 * Legacy Express webhook route — kept for local dev parity with the
 * Express server (api/_server.ts). All real logic lives in
 * api/_lib/webhooks/stripe-dispatch.ts. The Vercel serverless
 * equivalent is api/webhooks/stripe.ts; production traffic should
 * route there.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dispatchStripeEvent } from '../_lib/webhooks/stripe-dispatch.js';

const router = Router();

let stripe: Stripe;
let supabase: SupabaseClient;

export function initWebhookRoutes(stripeInstance: Stripe, supabaseClient: SupabaseClient) {
  stripe = stripeInstance;
  supabase = supabaseClient;
  return router;
}

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post('/stripe', asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    res.status(503).json({ error: 'webhook not configured' });
    return;
  }
  if (!sig) {
    res.status(400).json({ error: 'missing signature' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch {
    res.status(400).json({ error: 'invalid signature' });
    return;
  }

  try {
    const outcome = await dispatchStripeEvent(event, { supabase, stripe });
    res.json({ received: true, outcome });
  } catch (err) {
    console.error('[express stripe webhook] dispatch threw', err);
    res.status(500).json({ error: 'dispatch_failed' });
  }
}));

export default router;
