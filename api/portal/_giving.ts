/**
 * /api/portal/giving
 *
 *   GET  — the member's own real gift history, active recurring gifts,
 *          and whether this church's online giving is live (Stripe
 *          Connect charges_enabled) — everything a member needs to know
 *          before calling the existing public giving endpoints.
 *   POST { action: 'cancel_recurring', recurring_giving_id } — cancels a
 *          real Stripe subscription the member owns.
 *
 * This route does NOT create a gift or a subscription itself — those
 * already have real, working, PUBLIC endpoints (POST
 * /api/giving/create-payment-intent, POST /api/giving/create-subscription)
 * that the Members Portal calls directly with the member's own person_id
 * for attribution. Duplicating that Stripe-facing logic here would be
 * redundant and risk drifting from the webhook-driven source of truth
 * (api/_lib/webhooks/stripe-handlers.ts writes the actual `giving` and
 * `recurring_giving` rows on payment_intent.succeeded / invoice.paid).
 *
 * Deliberately NOT implemented: statement download. giving_statements
 * exists as a schema (migration 002) but nothing in this codebase
 * generates a PDF or populates pdf_url — there is no real provider
 * integration to implement against, so this function is left off the
 * portal rather than faked.
 *
 * Never exposes: stripe_customer_id, stripe_subscription_id, or any
 * other provider identifier — those are internal only.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';
import { computeGivingTier, type GivingTierDefinition } from '../_lib/givingTiers.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CANCEL_SCHEMA = {
  action: str({ required: true, pattern: /^cancel_recurring$/ }),
  recurring_giving_id: str({ required: true, max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const [{ data: church }, { data: gifts, error: giftsErr }, { data: recurring, error: recurringErr }] = await Promise.all([
      supabase.from('churches').select('slug, name, stripe_connect_charges_enabled, settings').eq('id', member.churchId).maybeSingle(),
      supabase.from('giving')
        .select('id, amount, fund, date, method, is_recurring, note, created_at')
        .eq('church_id', member.churchId)
        .eq('person_id', member.personId)
        .order('date', { ascending: false })
        .limit(100),
      supabase.from('recurring_giving')
        .select('id, amount, frequency, fund, next_date, payment_method_last4, payment_method_brand, status, created_at')
        .eq('church_id', member.churchId)
        .eq('person_id', member.personId)
        .order('created_at', { ascending: false }),
    ]);
    if (giftsErr || recurringErr) return res.status(500).json({ error: 'read_failed' });

    const givingTiers = ((church?.settings as { givingTiers?: GivingTierDefinition[] } | null)?.givingTiers) ?? [];
    const givingTier = computeGivingTier(
      (recurring ?? []).map(r => ({ amount: Number(r.amount), frequency: r.frequency, status: r.status })),
      givingTiers,
    );

    return res.status(200).json({
      giving_active: !!church?.stripe_connect_charges_enabled,
      person_id: member.personId,
      church_slug: church?.slug ?? null,
      church_name: church?.name ?? null,
      gift_history: gifts ?? [],
      recurring_gifts: recurring ?? [],
      giving_tier: givingTier,
      // Documents which portal functions this endpoint intentionally does
      // NOT support, and why — so the frontend can render an honest
      // "not available" state instead of a broken button.
      unsupported_functions: {
        download_statement: 'No statement-generation provider is wired up (giving_statements.pdf_url is never populated).',
      },
    });
  }

  if (req.method === 'POST') {
    if (!STRIPE_SECRET_KEY) return res.status(503).json({ error: 'service_not_configured' });
    const body = readBody(req, res, CANCEL_SCHEMA);
    if (!body) return;

    const { data: recurringGift, error: fetchErr } = await supabase
      .from('recurring_giving')
      .select('id, stripe_subscription_id, status')
      .eq('id', body.recurring_giving_id)
      .eq('church_id', member.churchId)
      .eq('person_id', member.personId)
      .maybeSingle();
    if (fetchErr) return res.status(500).json({ error: 'read_failed' });
    if (!recurringGift) return res.status(404).json({ error: 'not_found' });
    if (recurringGift.status === 'cancelled') {
      return res.status(409).json({ error: 'already_cancelled' });
    }
    if (!recurringGift.stripe_subscription_id) {
      return res.status(409).json({ error: 'no_provider_subscription' });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion });
    try {
      await stripe.subscriptions.cancel(recurringGift.stripe_subscription_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      return res.status(502).json({ error: 'stripe_error', detail: msg });
    }

    // The customer.subscription.deleted webhook (existing
    // handleSubscriptionLifecycle) will also sync this row when Stripe's
    // event arrives; updating here too means the member sees the change
    // immediately rather than waiting on webhook delivery.
    const { data: updated, error: updateErr } = await supabase
      .from('recurring_giving')
      .update({ status: 'cancelled' })
      .eq('id', recurringGift.id)
      .select('id, status')
      .single();
    if (updateErr || !updated) return res.status(500).json({ error: 'update_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'giving.recurring_gift.cancelled',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'recurring_giving',
      subjectId: recurringGift.id,
      payload: {},
    });
    await recordAudit(supabase, {
      churchId: member.churchId,
      actorUserId: null,
      actorClerkId: member.clerkUserId,
      action: 'update',
      entityType: 'recurring_giving',
      entityId: recurringGift.id,
      after: { status: 'cancelled' },
      sourceApp: 'member_portal',
      reason: 'member self-service recurring-gift cancellation',
      correlationId,
      route: '/api/portal/giving',
      method: 'POST',
    });

    return res.status(200).json({ recurring_gift: updated });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
