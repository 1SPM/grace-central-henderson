/**
 * Webhook Routes - Stripe Webhooks
 */

import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';

const router = Router();

let stripe: Stripe;
let supabase: SupabaseClient;

export function initWebhookRoutes(stripeInstance: Stripe, supabaseClient: SupabaseClient) {
  stripe = stripeInstance;
  supabase = supabaseClient;
  return router;
}

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Stripe webhook handler
router.post('/stripe', asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`Payment succeeded: ${paymentIntent.id}`);

      // Record the giving in the database
      const { error } = await supabase.from('giving').insert({
        church_id: paymentIntent.metadata?.church_id,
        person_id: paymentIntent.metadata?.person_id || null,
        amount: paymentIntent.amount / 100,
        fund: paymentIntent.metadata?.fund || 'tithe',
        date: new Date().toISOString().split('T')[0],
        method: 'online',
        is_recurring: paymentIntent.metadata?.is_recurring === 'true',
        stripe_payment_id: paymentIntent.id,
        note: paymentIntent.description || null,
      });

      if (error) {
        console.error('Failed to record giving:', error);
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Invoice paid: ${invoice.id}`);

      // Record recurring giving
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

        const { error } = await supabase.from('giving').insert({
          church_id: subscription.metadata?.church_id,
          person_id: subscription.metadata?.person_id || null,
          amount: invoice.amount_paid / 100,
          fund: subscription.metadata?.fund || 'tithe',
          date: new Date().toISOString().split('T')[0],
          method: 'online',
          is_recurring: true,
          stripe_payment_id: invoice.payment_intent as string,
          note: 'Recurring giving',
        });

        if (error) {
          console.error('Failed to record recurring giving:', error);
        }
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`Subscription ${event.type}: ${subscription.id}`);

      // Update recurring_giving table
      const status = subscription.status === 'active' ? 'active' :
                     subscription.status === 'canceled' ? 'cancelled' : 'paused';

      const { error } = await supabase
        .from('recurring_giving')
        .upsert({
          stripe_subscription_id: subscription.id,
          church_id: subscription.metadata?.church_id,
          person_id: subscription.metadata?.person_id || null,
          amount: subscription.items.data[0]?.price?.unit_amount
            ? subscription.items.data[0].price.unit_amount / 100
            : 0,
          frequency: subscription.items.data[0]?.price?.recurring?.interval || 'month',
          fund: subscription.metadata?.fund || 'tithe',
          next_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
          status,
        });

      if (error) {
        console.error('Failed to update recurring giving:', error);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}));

export default router;
