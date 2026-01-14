/**
 * Payment Routes - Stripe Integration
 *
 * Handles customers, payment intents, subscriptions, and prices
 */

import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';

// Initialize router
const router = Router();

// Initialize Stripe (will be set by parent)
let stripe: Stripe;

export function initPaymentRoutes(stripeInstance: Stripe) {
  stripe = stripeInstance;
  return router;
}

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ============================================
// CUSTOMER ROUTES
// ============================================

// Create or retrieve a customer
router.post('/customers', asyncHandler(async (req: Request, res: Response) => {
  const { email, name, phone, metadata } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  let customer: Stripe.Customer;

  if (existingCustomers.data.length > 0) {
    customer = existingCustomers.data[0];
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
router.get('/customers/:customerId/payment-methods', asyncHandler(async (req: Request, res: Response) => {
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
router.get('/customers/:customerId/payments', asyncHandler(async (req: Request, res: Response) => {
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
router.get('/customers/:customerId/summary', asyncHandler(async (req: Request, res: Response) => {
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
    summary: { total, byFund, byMonth },
  });
}));

// Get customer subscriptions
router.get('/customers/:customerId/subscriptions', asyncHandler(async (req: Request, res: Response) => {
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
// PAYMENT INTENT ROUTES
// ============================================

// Create a payment intent
router.post('/create-payment-intent', asyncHandler(async (req: Request, res: Response) => {
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
    amount: Math.round(amount),
    currency,
    description,
    metadata,
    customer,
    payment_method,
    automatic_payment_methods: { enabled: true },
  });

  res.json({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
  });
}));

// Confirm a payment intent
router.post('/confirm-payment/:paymentIntentId', asyncHandler(async (req: Request, res: Response) => {
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

// Create a subscription
router.post('/subscriptions', asyncHandler(async (req: Request, res: Response) => {
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
router.delete('/subscriptions/:subscriptionId', asyncHandler(async (req: Request, res: Response) => {
  const { subscriptionId } = req.params;
  const subscription = await stripe.subscriptions.cancel(subscriptionId);

  res.json({
    subscriptionId: subscription.id,
    status: 'canceled',
  });
}));

// Pause a subscription
router.post('/subscriptions/:subscriptionId/pause', asyncHandler(async (req: Request, res: Response) => {
  const { subscriptionId } = req.params;

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    pause_collection: { behavior: 'void' },
  });

  res.json({
    subscriptionId: subscription.id,
    status: 'paused',
  });
}));

// Resume a subscription
router.post('/subscriptions/:subscriptionId/resume', asyncHandler(async (req: Request, res: Response) => {
  const { subscriptionId } = req.params;

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    pause_collection: null as unknown as Stripe.SubscriptionUpdateParams.PauseCollection,
  });

  res.json({
    subscriptionId: subscription.id,
    status: subscription.status,
  });
}));

// ============================================
// PRICE ROUTES
// ============================================

// Create a price for recurring giving
router.post('/prices', asyncHandler(async (req: Request, res: Response) => {
  const { amount, interval, fund } = req.body;

  if (!amount || !interval) {
    res.status(400).json({ error: 'Amount and interval are required' });
    return;
  }

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

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(amount * 100),
    currency: 'usd',
    recurring: {
      interval: interval as 'week' | 'month' | 'year',
    },
    metadata: { fund },
  });

  res.json({
    priceId: price.id,
    amount: price.unit_amount ? price.unit_amount / 100 : 0,
    interval: price.recurring?.interval,
  });
}));

export default router;
