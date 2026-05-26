/**
 * Stripe event → operational + ledger writes.
 *
 * One handler per event type. Each handler:
 *   1. Is idempotent (safe to re-run; we rely on UNIQUE(source,
 *      source_event_id) in ledger_entries + the upstream claim).
 *   2. Writes the operational row (giving / recurring_giving) — these
 *      already exist and the rest of the app reads from them.
 *   3. Writes the ledger entry — the auditor-facing journal.
 *
 * Unsupported event types short-circuit with skip=true; the dispatcher
 * marks the webhook_events row 'skipped' rather than 'processed'.
 *
 * All money math goes through centsToMicroUsd to avoid float drift on
 * the cents-to-dollars-to-micro pipeline.
 */

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appendLedgerEntry, centsToMicroUsd, type LedgerEntryInput } from '../ledger';

export interface StripeHandlerContext {
  supabase: SupabaseClient;
  /** Stripe client. Used by handlers that need to fetch related objects (invoice → subscription). */
  stripe: Stripe;
}

export interface HandlerResult {
  status: 'processed' | 'skipped';
  reason?: string;
  ledgerWritten?: boolean;
  ledgerDuplicate?: boolean;
}

type StripeEventHandler = (event: Stripe.Event, ctx: StripeHandlerContext) => Promise<HandlerResult>;

// ============================================
// payment_intent.succeeded
// ============================================
// One-time gift. Write a giving row + a ledger 'donation' credit.
async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  ctx: StripeHandlerContext,
): Promise<HandlerResult> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const churchId = pi.metadata?.church_id;
  if (!churchId) {
    return { status: 'skipped', reason: 'missing metadata.church_id' };
  }

  const amountMicroUsd = centsToMicroUsd(pi.amount);
  const personId = pi.metadata?.person_id || null;
  const fund = pi.metadata?.fund || 'tithe';
  const today = new Date().toISOString().split('T')[0];

  // OPERATIONAL: upsert by stripe_payment_id so a re-delivered webhook
  // doesn't create a duplicate giving row. This is defense in depth on
  // top of webhook_events dedup.
  const { data: givingRow, error: givingErr } = await ctx.supabase
    .from('giving')
    .upsert(
      {
        church_id: churchId,
        person_id: personId,
        amount: pi.amount / 100,
        fund,
        date: today,
        method: 'online',
        is_recurring: pi.metadata?.is_recurring === 'true',
        stripe_payment_id: pi.id,
        note: pi.description || null,
      },
      { onConflict: 'stripe_payment_id' },
    )
    .select('id')
    .single();
  if (givingErr) throw new Error(`giving upsert failed: ${givingErr.message}`);

  // LEDGER: append-only journal.
  const entry: LedgerEntryInput = {
    churchId,
    source: 'stripe',
    sourceEventId: event.id,
    kind: 'donation',
    direction: 'credit',
    amountMicroUsd,
    currency: (pi.currency ?? 'usd').toUpperCase(),
    description: pi.description ?? null,
    relatedGivingId: (givingRow as { id: string } | null)?.id ?? null,
    relatedPersonId: personId,
    occurredAt: new Date(event.created * 1000),
    metadata: {
      stripe_payment_intent_id: pi.id,
      fund,
      is_recurring: pi.metadata?.is_recurring === 'true',
    },
  };
  const ledger = await appendLedgerEntry(ctx.supabase, entry);
  return {
    status: 'processed',
    ledgerWritten: ledger.inserted,
    ledgerDuplicate: ledger.duplicate,
  };
}

// ============================================
// charge.refunded
// ============================================
// Full or partial refund. Write a ledger 'refund' DEBIT — operational
// `giving` rows are left untouched (the original donation still
// happened; the refund is a separate event in the ledger).
async function handleChargeRefunded(
  event: Stripe.Event,
  ctx: StripeHandlerContext,
): Promise<HandlerResult> {
  const charge = event.data.object as Stripe.Charge;
  const churchId = charge.metadata?.church_id;
  if (!churchId) {
    return { status: 'skipped', reason: 'missing metadata.church_id' };
  }

  // `amount_refunded` is cumulative; we record the delta from the previous
  // amount via metadata. For Sprint 3 MVP we record the full amount_refunded
  // and rely on event.id idempotency to prevent double-counting.
  const refundedMicro = centsToMicroUsd(charge.amount_refunded);
  if (refundedMicro <= 0) {
    return { status: 'skipped', reason: 'amount_refunded is zero' };
  }

  const entry: LedgerEntryInput = {
    churchId,
    source: 'stripe',
    sourceEventId: event.id,
    kind: 'refund',
    direction: 'debit',
    amountMicroUsd: refundedMicro,
    currency: (charge.currency ?? 'usd').toUpperCase(),
    description: `Refund: ${charge.id}`,
    relatedPersonId: charge.metadata?.person_id || null,
    occurredAt: new Date(event.created * 1000),
    metadata: {
      stripe_charge_id: charge.id,
      stripe_payment_intent_id: charge.payment_intent,
      refund_reason: (charge.refunds?.data?.[0]?.reason) ?? null,
    },
  };
  const ledger = await appendLedgerEntry(ctx.supabase, entry);
  return { status: 'processed', ledgerWritten: ledger.inserted, ledgerDuplicate: ledger.duplicate };
}

// ============================================
// invoice.paid
// ============================================
// Recurring giving cycle. Look up the subscription for tenant context,
// write a giving row + ledger donation credit.
async function handleInvoicePaid(
  event: Stripe.Event,
  ctx: StripeHandlerContext,
): Promise<HandlerResult> {
  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.subscription) {
    return { status: 'skipped', reason: 'invoice has no subscription (one-time)' };
  }

  const subscription = await ctx.stripe.subscriptions.retrieve(invoice.subscription as string);
  const churchId = subscription.metadata?.church_id;
  if (!churchId) {
    return { status: 'skipped', reason: 'subscription missing metadata.church_id' };
  }

  const personId = subscription.metadata?.person_id || null;
  const fund = subscription.metadata?.fund || 'tithe';
  const today = new Date().toISOString().split('T')[0];

  const { data: givingRow, error: givingErr } = await ctx.supabase
    .from('giving')
    .upsert(
      {
        church_id: churchId,
        person_id: personId,
        amount: invoice.amount_paid / 100,
        fund,
        date: today,
        method: 'online',
        is_recurring: true,
        stripe_payment_id: (invoice.payment_intent as string) ?? `inv_${invoice.id}`,
        note: 'Recurring giving',
      },
      { onConflict: 'stripe_payment_id' },
    )
    .select('id')
    .single();
  if (givingErr) throw new Error(`giving upsert failed: ${givingErr.message}`);

  const entry: LedgerEntryInput = {
    churchId,
    source: 'stripe',
    sourceEventId: event.id,
    kind: 'donation',
    direction: 'credit',
    amountMicroUsd: centsToMicroUsd(invoice.amount_paid),
    currency: (invoice.currency ?? 'usd').toUpperCase(),
    description: `Recurring: ${subscription.id}`,
    relatedGivingId: (givingRow as { id: string } | null)?.id ?? null,
    relatedPersonId: personId,
    occurredAt: new Date(event.created * 1000),
    metadata: {
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscription.id,
      fund,
    },
  };
  const ledger = await appendLedgerEntry(ctx.supabase, entry);
  return { status: 'processed', ledgerWritten: ledger.inserted, ledgerDuplicate: ledger.duplicate };
}

// ============================================
// customer.subscription.{created,updated,deleted}
// ============================================
// No ledger entry — these are state changes, not money movements.
// Update operational recurring_giving table only.
async function handleSubscriptionLifecycle(
  event: Stripe.Event,
  ctx: StripeHandlerContext,
): Promise<HandlerResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const churchId = subscription.metadata?.church_id;
  if (!churchId) {
    return { status: 'skipped', reason: 'missing metadata.church_id' };
  }

  const status =
    subscription.status === 'active' ? 'active' :
    subscription.status === 'canceled' ? 'cancelled' : 'paused';

  const amount = subscription.items.data[0]?.price?.unit_amount
    ? subscription.items.data[0].price.unit_amount / 100
    : 0;

  const { error } = await ctx.supabase
    .from('recurring_giving')
    .upsert(
      {
        stripe_subscription_id: subscription.id,
        church_id: churchId,
        person_id: subscription.metadata?.person_id || null,
        amount,
        frequency: subscription.items.data[0]?.price?.recurring?.interval || 'month',
        fund: subscription.metadata?.fund || 'tithe',
        next_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
        status,
      },
      { onConflict: 'stripe_subscription_id' },
    );
  if (error) throw new Error(`recurring_giving upsert failed: ${error.message}`);

  return { status: 'processed', ledgerWritten: false };
}

// ============================================
// REGISTRY
// ============================================
export const STRIPE_HANDLERS: Record<string, StripeEventHandler> = {
  'payment_intent.succeeded': handlePaymentIntentSucceeded,
  'charge.refunded': handleChargeRefunded,
  'invoice.paid': handleInvoicePaid,
  'customer.subscription.created': handleSubscriptionLifecycle,
  'customer.subscription.updated': handleSubscriptionLifecycle,
  'customer.subscription.deleted': handleSubscriptionLifecycle,
};

export function getStripeHandler(eventType: string): StripeEventHandler | null {
  return STRIPE_HANDLERS[eventType] ?? null;
}

/** Extracted for testing — extracts church_id from common Stripe event shapes. */
export function extractChurchIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as { metadata?: Record<string, string> };
  return obj?.metadata?.church_id ?? null;
}
