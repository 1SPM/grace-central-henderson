/**
 * Stripe webhook entry point (Vercel serverless).
 *
 * Verifies the signature, parses the event, hands off to the
 * dispatcher. Always returns 200 (with the dispatch outcome in the
 * body) UNLESS the signature is missing/invalid — those are 400.
 *
 * Rationale for "always 200 past the signature check": we own retry
 * via the DLQ. If we 500'd to Stripe, it would retry with its own
 * cadence (the first retry is hours away), and any DLQ replay we ran
 * in the meantime would race against it.
 *
 * The corresponding Express route in api/_routes/webhooks.ts is kept
 * for local dev parity and now also delegates to dispatchStripeEvent.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { dispatchStripeEvent } from '../_lib/webhooks/stripe-dispatch.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// IMPORTANT: Stripe signature verification requires the RAW request body.
// Vercel's default JSON parser would mangle it. Disable the body parser
// so we receive the buffer untouched.
export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'supabase not configured' });
  }
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    // Do NOT log the missing-signature event body — could be probing.
    return res.status(400).json({ error: 'missing signature' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch {
    // Per ADR-006 fail-closed: 400, no body logging.
    console.warn('[stripe webhook] signature verification failed');
    return res.status(400).json({ error: 'invalid signature' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const outcome = await dispatchStripeEvent(event, { supabase, stripe });
    return res.status(200).json({ received: true, outcome });
  } catch (err) {
    // dispatch is designed not to throw, but if it does (e.g. claimEvent
    // hits a DB outage) — return 500 so Stripe retries. The event has
    // not been claimed at that point so retry is safe.
    console.error('[stripe webhook] dispatch threw', err);
    return res.status(500).json({ error: 'dispatch_failed' });
  }
}
