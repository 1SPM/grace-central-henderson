/**
 * Audit follow-ups #2 (dispute → ledger) and #3 (i2c gating).
 * Hermetic — no DB, no network, no real charges.
 */

import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { STRIPE_HANDLERS } from './stripe-handlers.js';
import { resolveI2cAuthMode } from '../../webhooks/i2c.js';

const CHURCH = '00000000-0000-0000-0000-0000000000c1';

// Records every ledger insert so we can assert direction/kind/amount.
function ledgerCtx(piChurchId: string | null = CHURCH) {
  const inserts: Array<Record<string, unknown>> = [];
  const supabase = {
    from(table: string) {
      if (table !== 'ledger_entries') throw new Error(`unexpected table ${table}`);
      return {
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: `led_${inserts.length}` }, error: null }) }) };
        },
      };
    },
  };
  const stripe = {
    paymentIntents: { retrieve: async () => ({ metadata: piChurchId ? { church_id: piChurchId } : {} }) },
  };
  return { ctx: { supabase: supabase as never, stripe: stripe as never }, inserts };
}

function disputeEvent(type: string, status: string, amount = 5000): Stripe.Event {
  return {
    id: `evt_${type}_${status}`, type, created: 1_700_000_000,
    data: { object: {
      id: 'dp_1', object: 'dispute', amount, currency: 'usd', reason: 'fraudulent',
      status, charge: 'ch_1', payment_intent: 'pi_1', metadata: {},
    } },
  } as unknown as Stripe.Event;
}

describe('#2 charge.dispute.* → ledger adjustment', () => {
  it('dispute.created writes a DEBIT (funds withdrawn), tenant resolved from the PaymentIntent', async () => {
    const { ctx, inserts } = ledgerCtx(CHURCH);
    const r = await STRIPE_HANDLERS['charge.dispute.created'](disputeEvent('charge.dispute.created', 'needs_response'), ctx);
    expect(r.status).toBe('processed');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      church_id: CHURCH, kind: 'refund', direction: 'debit', amount_micro_usd: 50_000_000,
    });
    expect((inserts[0].metadata as Record<string, unknown>).is_dispute).toBe(true);
  });

  it('dispute.closed as WON writes a CREDIT reversal', async () => {
    const { ctx, inserts } = ledgerCtx(CHURCH);
    const r = await STRIPE_HANDLERS['charge.dispute.closed'](disputeEvent('charge.dispute.closed', 'won'), ctx);
    expect(r.status).toBe('processed');
    expect(inserts[0]).toMatchObject({ kind: 'adjustment', direction: 'credit', amount_micro_usd: 50_000_000 });
  });

  it('dispute.closed as LOST writes NOTHING (created debit stands)', async () => {
    const { ctx, inserts } = ledgerCtx(CHURCH);
    const r = await STRIPE_HANDLERS['charge.dispute.closed'](disputeEvent('charge.dispute.closed', 'lost'), ctx);
    expect(r.status).toBe('skipped');
    expect(inserts).toHaveLength(0);
  });

  it('skips when the tenant cannot be resolved (no church_id anywhere)', async () => {
    const { ctx, inserts } = ledgerCtx(null);
    const r = await STRIPE_HANDLERS['charge.dispute.created'](disputeEvent('charge.dispute.created', 'needs_response'), ctx);
    expect(r.status).toBe('skipped');
    expect(inserts).toHaveLength(0);
  });
});

describe('#3 i2c webhook auth mode', () => {
  it('secret set → live (verify signature)', () => {
    expect(resolveI2cAuthMode(true, false)).toBe('live');
    expect(resolveI2cAuthMode(true, true)).toBe('live');
  });
  it('no secret + explicit opt-in → simulated', () => {
    expect(resolveI2cAuthMode(false, true)).toBe('simulated');
  });
  it('no secret, no opt-in → refuse (forgotten-secret no longer opens the mock path)', () => {
    expect(resolveI2cAuthMode(false, false)).toBe('refuse');
  });
});
