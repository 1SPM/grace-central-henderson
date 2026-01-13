/**
 * Grace CRM - Payment API Server
 *
 * Handles secure Stripe payment processing.
 * This server should be run separately from the frontend.
 *
 * Environment variables required:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_KEY: Supabase service role key
 * - PORT: Server port (default 3001)
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Raw body for webhooks
app.use('/webhooks', express.raw({ type: 'application/json' }));

// JSON body for other routes
app.use(express.json());

// Error handler
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ============================================
// CUSTOMER ROUTES
// ============================================

// Create or retrieve a customer
app.post('/api/payments/customers', asyncHandler(async (req: Request, res: Response) => {
  const { email, name, phone, metadata } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  // Check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  let customer: Stripe.Customer;

  if (existingCustomers.data.length > 0) {
    customer = existingCustomers.data[0];
    // Update customer info if needed
    if (name || phone) {
      customer = await stripe.customers.update(customer.id, {
        name,
        phone,
        metadata,
      });
    }
  } else {
    customer = await stripe.customers.create({
      email,
      name,
      phone,
      metadata,
    });
  }

  res.json({
    customerId: customer.id,
    email: customer.email,
  });
}));

// Get customer's payment methods
app.get('/api/payments/customers/:customerId/payment-methods', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });

  const bankAccounts = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'us_bank_account',
  });

  const allMethods = [...paymentMethods.data, ...bankAccounts.data].map((pm) => ({
    id: pm.id,
    type: pm.type,
    card: pm.card ? {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    } : undefined,
    bankAccount: pm.us_bank_account ? {
      bankName: pm.us_bank_account.bank_name,
      last4: pm.us_bank_account.last4,
    } : undefined,
  }));

  res.json({ paymentMethods: allMethods });
}));

// Get customer's payment history
app.get('/api/payments/customers/:customerId/payments', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { limit = '50' } = req.query;

  const payments = await stripe.paymentIntents.list({
    customer: customerId,
    limit: parseInt(limit as string),
  });

  const formattedPayments = payments.data
    .filter((pi) => pi.status === 'succeeded')
    .map((pi) => ({
      id: pi.id,
      amount: pi.amount / 100,
      fund: pi.metadata?.fund || 'other',
      date: new Date(pi.created * 1000).toISOString(),
      status: pi.status,
    }));

  res.json({ payments: formattedPayments });
}));

// Get giving summary for a customer
app.get('/api/payments/customers/:customerId/summary', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { year } = req.query;
  const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

  const startDate = new Date(targetYear, 0, 1);
  const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

  const payments = await stripe.paymentIntents.list({
    customer: customerId,
    created: {
      gte: Math.floor(startDate.getTime() / 1000),
      lte: Math.floor(endDate.getTime() / 1000),
    },
    limit: 100,
  });

  const succeededPayments = payments.data.filter((pi) => pi.status === 'succeeded');

  const total = succeededPayments.reduce((sum, pi) => sum + pi.amount, 0) / 100;

  const byFund: Record<string, number> = {};
  const byMonth: Record<string, number> = {};

  succeededPayments.forEach((pi) => {
    const fund = pi.metadata?.fund || 'other';
    const month = new Date(pi.created * 1000).toLocaleString('default', { month: 'short' });

    byFund[fund] = (byFund[fund] || 0) + pi.amount / 100;
    byMonth[month] = (byMonth[month] || 0) + pi.amount / 100;
  });

  res.json({
    summary: {
      total,
      byFund,
      byMonth,
    },
  });
}));

// ============================================
// PAYMENT INTENT ROUTES
// ============================================

// Create a payment intent
app.post('/api/payments/create-payment-intent', asyncHandler(async (req: Request, res: Response) => {
  const {
    amount,
    currency = 'usd',
    description,
    metadata,
    customer,
    payment_method,
  } = req.body;

  if (!amount || amount < 50) {
    res.status(400).json({ error: 'Amount must be at least $0.50' });
    return;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount), // amount in cents
    currency,
    description,
    metadata,
    customer,
    payment_method,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.json({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
  });
}));

// Confirm a payment intent
app.post('/api/payments/confirm-payment/:paymentIntentId', asyncHandler(async (req: Request, res: Response) => {
  const { paymentIntentId } = req.params;
  const { payment_method } = req.body;

  const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method,
  });

  res.json({
    success: paymentIntent.status === 'succeeded',
    status: paymentIntent.status,
    paymentIntentId: paymentIntent.id,
  });
}));

// ============================================
// SUBSCRIPTION ROUTES
// ============================================

// Create a subscription for recurring giving
app.post('/api/payments/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const { customerId, priceId, metadata } = req.body;

  if (!customerId || !priceId) {
    res.status(400).json({ error: 'Customer ID and Price ID are required' });
    return;
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata,
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

  res.json({
    subscriptionId: subscription.id,
    status: subscription.status,
    clientSecret: paymentIntent?.client_secret,
  });
}));

// Cancel a subscription
app.delete('/api/payments/subscriptions/:subscriptionId', asyncHandler(async (req: Request, res: Response) => {
  const { subscriptionId } = req.params;

  const subscription = await stripe.subscriptions.cancel(subscriptionId);

  res.json({
    subscriptionId: subscription.id,
    status: 'canceled',
  });
}));

// Pause a subscription
app.post('/api/payments/subscriptions/:subscriptionId/pause', asyncHandler(async (req: Request, res: Response) => {
  const { subscriptionId } = req.params;

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: 'void',
    },
  });

  res.json({
    subscriptionId: subscription.id,
    status: 'paused',
  });
}));

// Resume a subscription
app.post('/api/payments/subscriptions/:subscriptionId/resume', asyncHandler(async (req: Request, res: Response) => {
  const { subscriptionId } = req.params;

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    pause_collection: null as unknown as Stripe.SubscriptionUpdateParams.PauseCollection,
  });

  res.json({
    subscriptionId: subscription.id,
    status: subscription.status,
  });
}));

// Get customer subscriptions
app.get('/api/payments/customers/:customerId/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
  });

  const formattedSubscriptions = subscriptions.data.map((sub) => ({
    id: sub.id,
    status: sub.status,
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    amount: sub.items.data[0]?.price?.unit_amount ? sub.items.data[0].price.unit_amount / 100 : 0,
    interval: sub.items.data[0]?.price?.recurring?.interval,
    fund: sub.metadata?.fund,
  }));

  res.json({ subscriptions: formattedSubscriptions });
}));

// ============================================
// PRICE ROUTES (for recurring giving)
// ============================================

// Create a price for recurring giving
app.post('/api/payments/prices', asyncHandler(async (req: Request, res: Response) => {
  const { amount, interval, fund } = req.body;

  if (!amount || !interval) {
    res.status(400).json({ error: 'Amount and interval are required' });
    return;
  }

  // First, get or create a product for recurring giving
  let product: Stripe.Product;
  const products = await stripe.products.list({
    active: true,
    limit: 1,
  });

  const existingProduct = products.data.find((p) => p.name === 'Recurring Giving');

  if (existingProduct) {
    product = existingProduct;
  } else {
    product = await stripe.products.create({
      name: 'Recurring Giving',
      description: 'Recurring donation to the church',
    });
  }

  // Create the price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(amount * 100),
    currency: 'usd',
    recurring: {
      interval: interval as 'week' | 'month' | 'year',
    },
    metadata: {
      fund,
    },
  });

  res.json({
    priceId: price.id,
    amount: price.unit_amount ? price.unit_amount / 100 : 0,
    interval: price.recurring?.interval,
  });
}));

// ============================================
// WEBHOOK HANDLER
// ============================================

app.post('/webhooks/stripe', asyncHandler(async (req: Request, res: Response) => {
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

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    supabase: !!process.env.SUPABASE_URL,
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Grace CRM Payment API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
