/**
 * i2c webhook entry point (Portal-CRM Alignment, Phase C).
 *
 * Pipeline (mirrors api/webhooks/stripe.ts):
 *   verify → claimEvent (webhook_events dedup) → interchange_events
 *   append → paired ledger_entries row → member_activity_events.
 *
 * Verification:
 *   - When I2C_WEBHOOK_SECRET is set (live mode): HMAC-SHA256 of the
 *     raw body in the `x-i2c-signature` header. Fail-closed 400.
 *   - When unset (mock mode): the route accepts *simulated* events
 *     only from an authenticated staff member (Clerk Bearer). This is
 *     the demo path — the admin Card Program UI can generate sample
 *     transactions end-to-end through the exact production pipeline.
 *
 * Expected event shape (the live i2c payload will be adapted to this
 * in the live adapter work, TD-036):
 *   {
 *     event_id:        string   — upstream id, dedup key
 *     event_type:      'authorization'|'capture'|'refund'|'reversal'|'fee'|'declined'
 *     i2c_card_id:     string
 *     amount_micro_usd: number  — positive integer
 *     direction:       'debit'|'credit'
 *     merchant_name?:  string
 *     merchant_category?: string
 *     decline_reason?: string
 *     occurred_at?:    ISO 8601 (defaults to now)
 *   }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { claimEvent, markProcessed, markFailed, markSkipped } from '../_lib/webhooks/idempotency.js';
import { appendLedgerEntry } from '../_lib/ledger.js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const I2C_WEBHOOK_SECRET = process.env.I2C_WEBHOOK_SECRET;

const STAFF_ROLES = ['admin', 'pastor', 'staff'];
const EVENT_TYPES = ['authorization', 'capture', 'refund', 'reversal', 'fee', 'declined'];

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

function verifySignature(raw: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface I2cWebhookEvent {
  event_id: string;
  event_type: string;
  i2c_card_id: string;
  amount_micro_usd: number;
  direction: string;
  merchant_name?: string;
  merchant_category?: string;
  decline_reason?: string;
  occurred_at?: string;
}

function validateEvent(body: unknown): I2cWebhookEvent | null {
  if (!body || typeof body !== 'object') return null;
  const e = body as Record<string, unknown>;
  if (typeof e.event_id !== 'string' || !e.event_id) return null;
  if (typeof e.event_type !== 'string' || !EVENT_TYPES.includes(e.event_type)) return null;
  if (typeof e.i2c_card_id !== 'string' || !e.i2c_card_id) return null;
  if (typeof e.amount_micro_usd !== 'number' || !Number.isInteger(e.amount_micro_usd) || e.amount_micro_usd <= 0) return null;
  if (e.direction !== 'debit' && e.direction !== 'credit') return null;
  return e as unknown as I2cWebhookEvent;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'supabase not configured' });
  }

  const raw = await readRawBody(req);

  let simulated = false;
  if (I2C_WEBHOOK_SECRET) {
    const sig = req.headers['x-i2c-signature'];
    if (!sig || typeof sig !== 'string' || !verifySignature(raw, sig, I2C_WEBHOOK_SECRET)) {
      console.warn('[i2c webhook] signature verification failed');
      return res.status(400).json({ error: 'invalid signature' });
    }
  } else {
    // Mock mode: only authenticated staff may inject simulated events.
    const auth = await requireClerkAuth(req, { allowedRoles: STAFF_ROLES });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    simulated = true;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'invalid json' });
  }
  const event = validateEvent(parsed);
  if (!event) return res.status(400).json({ error: 'invalid event shape' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Resolve the card → tenant. Unknown card = skip (don't fail; i2c
  // may deliver events for cards we haven't synced yet).
  const { data: card } = await supabase
    .from('cards')
    .select('id, church_id, cardholder_person_id, masked_pan')
    .eq('i2c_card_id', event.i2c_card_id)
    .maybeSingle();

  const claim = await claimEvent(supabase, {
    source: 'i2c',
    sourceEventId: event.event_id,
    eventType: event.event_type,
    payload: { ...event, simulated },
    churchId: card?.church_id ?? null,
  });
  if (claim.alreadyProcessed) {
    return res.status(200).json({ received: true, outcome: 'duplicate' });
  }

  if (!card) {
    await markSkipped(supabase, claim.eventRowId, `unknown i2c_card_id ${event.i2c_card_id}`);
    return res.status(200).json({ received: true, outcome: 'skipped_unknown_card' });
  }

  try {
    const occurredAt = event.occurred_at ?? new Date().toISOString();

    // Settled funds movements get a paired ledger entry FIRST so the
    // append-only interchange row can link to it. Authorizations and
    // declines are informational — interchange row only.
    let ledgerEntryId: string | null = null;
    if (event.event_type === 'capture' || event.event_type === 'fee' || event.event_type === 'refund') {
      const ledgerResult = await appendLedgerEntry(supabase, {
        churchId: card.church_id,
        source: 'i2c',
        sourceEventId: event.event_id,
        kind: event.event_type === 'fee' ? 'fee' : 'transfer',
        direction: event.direction as 'debit' | 'credit',
        amountMicroUsd: event.amount_micro_usd,
        description: event.event_type === 'fee'
          ? `Interchange revenue${event.merchant_name ? ` — ${event.merchant_name}` : ''}`
          : `Impact Card ${event.event_type}${event.merchant_name ? ` — ${event.merchant_name}` : ''} (${card.masked_pan})`,
        relatedPersonId: card.cardholder_person_id,
        occurredAt,
        metadata: { i2c_card_id: event.i2c_card_id, simulated },
      });
      ledgerEntryId = ledgerResult.rowId ?? null;
    }

    const { error: interchangeErr } = await supabase
      .from('interchange_events')
      .insert({
        church_id: card.church_id,
        card_id: card.id,
        i2c_event_id: event.event_id,
        event_type: event.event_type,
        direction: event.direction,
        amount_micro_usd: event.amount_micro_usd,
        merchant_name: event.merchant_name ?? null,
        merchant_category: event.merchant_category ?? null,
        decline_reason: event.event_type === 'declined' ? event.decline_reason ?? 'declined' : null,
        ledger_entry_id: ledgerEntryId,
        occurred_at: occurredAt,
        metadata: { simulated },
      });
    if (interchangeErr) {
      const isDup = (interchangeErr as { code?: string }).code === '23505';
      if (!isDup) throw new Error(`interchange insert failed: ${interchangeErr.message}`);
    }

    // Surface card activity in the portal-activity spine.
    if (card.cardholder_person_id && event.event_type !== 'authorization') {
      await supabase.from('member_activity_events').insert({
        church_id: card.church_id,
        person_id: card.cardholder_person_id,
        event_type: 'card_txn',
        entity_type: 'interchange_event',
        entity_id: event.event_id,
        metadata: {
          txn_type: event.event_type,
          amount_micro_usd: event.amount_micro_usd,
          merchant: event.merchant_name ?? null,
          simulated,
        },
      });
    }

    await markProcessed(supabase, claim.eventRowId);
    return res.status(200).json({ received: true, outcome: 'processed' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[i2c webhook] processing failed', message);
    await markFailed(supabase, claim.eventRowId, message).catch(() => undefined);
    return res.status(200).json({ received: true, outcome: 'failed' });
  }
}
