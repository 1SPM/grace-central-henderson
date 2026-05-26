import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { dispatchStripeEvent } from './stripe-dispatch';

/**
 * Stateful in-memory Supabase mock that supports:
 *   - webhook_events with UNIQUE(source, source_event_id)
 *   - webhook_dlq linked by webhook_event_id
 *   - ledger_entries with UNIQUE(source, source_event_id)
 *   - giving (upsert by stripe_payment_id)
 *   - recurring_giving (upsert by stripe_subscription_id)
 */
function makeMockDb() {
  const state = {
    webhookEvents: [] as Array<Record<string, unknown>>,
    webhookDlq: [] as Array<Record<string, unknown>>,
    ledgerEntries: [] as Array<Record<string, unknown>>,
    giving: [] as Array<Record<string, unknown>>,
    recurringGiving: [] as Array<Record<string, unknown>>,
  };
  let nextId = 1;

  function singleSelectChain(rows: Array<Record<string, unknown>>) {
    const filters: Array<[string, unknown]> = [];
    const chain = {
      eq(col: string, val: unknown) { filters.push([col, val]); return chain; },
      async maybeSingle() {
        const found = rows.find((r) => filters.every(([c, v]) => r[c] === v));
        return { data: found ?? null, error: null };
      },
      async single() {
        const found = rows.find((r) => filters.every(([c, v]) => r[c] === v));
        return { data: found ?? null, error: found ? null : { message: 'no rows' } };
      },
    };
    return chain;
  }

  const client = {
    from(table: string) {
      const rows =
        table === 'webhook_events' ? state.webhookEvents
        : table === 'webhook_dlq' ? state.webhookDlq
        : table === 'ledger_entries' ? state.ledgerEntries
        : table === 'giving' ? state.giving
        : table === 'recurring_giving' ? state.recurringGiving
        : null;
      if (!rows) throw new Error(`unexpected table ${table}`);

      return {
        insert(row: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  // Enforce UNIQUE for webhook_events + ledger_entries
                  if (table === 'webhook_events' || table === 'ledger_entries') {
                    const dup = rows.find(
                      (r) => r.source === row.source && r.source_event_id === row.source_event_id,
                    );
                    if (dup) {
                      return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
                    }
                  }
                  const created = { id: `row-${nextId++}`, ...row };
                  rows.push(created);
                  return { data: created, error: null };
                },
              };
            },
          };
        },
        upsert(row: Record<string, unknown>, opts: { onConflict?: string } = {}) {
          const key = opts.onConflict;
          return {
            select() {
              return {
                async single() {
                  if (key && row[key] !== undefined) {
                    const idx = rows.findIndex((r) => r[key] === row[key]);
                    if (idx >= 0) {
                      rows[idx] = { ...rows[idx], ...row };
                      return { data: rows[idx], error: null };
                    }
                  }
                  const created = { id: `row-${nextId++}`, ...row };
                  rows.push(created);
                  return { data: created, error: null };
                },
              };
            },
            // Some callers don't .select; return a thenable shape
            then(onFulfilled: (v: { error: null }) => unknown) {
              if (key && row[key] !== undefined) {
                const idx = rows.findIndex((r) => r[key] === row[key]);
                if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
                else rows.push({ id: `row-${nextId++}`, ...row });
              } else {
                rows.push({ id: `row-${nextId++}`, ...row });
              }
              return Promise.resolve(onFulfilled({ error: null }));
            },
          };
        },
        select() { return singleSelectChain(rows); },
        update(patch: Record<string, unknown>) {
          return {
            async eq(col: string, val: unknown) {
              const idx = rows.findIndex((r) => r[col] === val);
              if (idx >= 0) rows[idx] = { ...rows[idx], ...patch };
              return { error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

function mockStripeClient(): Stripe {
  return {
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'sub_test',
        metadata: { church_id: 'c-1', person_id: 'p-1', fund: 'missions' },
        items: { data: [{ price: { unit_amount: 5000, recurring: { interval: 'month' } } }] },
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: 'active',
      }),
    },
  } as unknown as Stripe;
}

function paymentIntentEvent(overrides: Partial<Stripe.PaymentIntent> = {}, id = 'evt_pi_1'): Stripe.Event {
  return {
    id,
    type: 'payment_intent.succeeded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pi_test_1',
        amount: 5000,                       // $50
        currency: 'usd',
        description: 'Sunday gift',
        metadata: { church_id: 'c-1', person_id: 'p-1', fund: 'tithe' },
        ...overrides,
      } as Stripe.PaymentIntent,
    },
  } as Stripe.Event;
}

describe('stripe-dispatch — happy path', () => {
  it('processes a fresh payment_intent.succeeded and writes both giving + ledger', async () => {
    const { client, state } = makeMockDb();
    const outcome = await dispatchStripeEvent(paymentIntentEvent(), { supabase: client, stripe: mockStripeClient() });

    expect(outcome.status).toBe('processed');
    expect(state.webhookEvents).toHaveLength(1);
    expect(state.webhookEvents[0].status).toBe('processed');
    expect(state.giving).toHaveLength(1);
    expect(state.giving[0].stripe_payment_id).toBe('pi_test_1');
    expect(state.ledgerEntries).toHaveLength(1);
    const entry = state.ledgerEntries[0];
    expect(entry.source).toBe('stripe');
    expect(entry.kind).toBe('donation');
    expect(entry.direction).toBe('credit');
    expect(entry.amount_micro_usd).toBe(50_000_000);    // $50 = 50M micro
    expect(entry.church_id).toBe('c-1');
  });

  it('treats duplicate event delivery as a no-op', async () => {
    const { client, state } = makeMockDb();
    const evt = paymentIntentEvent();
    const stripe = mockStripeClient();
    await dispatchStripeEvent(evt, { supabase: client, stripe });
    const second = await dispatchStripeEvent(evt, { supabase: client, stripe });

    expect(second.status).toBe('duplicate');
    expect(state.webhookEvents).toHaveLength(1);
    expect(state.giving).toHaveLength(1);
    expect(state.ledgerEntries).toHaveLength(1);
  });

  it('skips events with no registered handler', async () => {
    const { client, state } = makeMockDb();
    const evt = { ...paymentIntentEvent(), type: 'something.weird' } as Stripe.Event;
    const outcome = await dispatchStripeEvent(evt, { supabase: client, stripe: mockStripeClient() });

    expect(outcome.status).toBe('skipped');
    expect((outcome as { reason: string }).reason).toMatch(/unhandled event type/);
    expect(state.webhookEvents[0].status).toBe('skipped');
    expect(state.ledgerEntries).toHaveLength(0);
  });

  it('handler skip is recorded with reason (no ledger write)', async () => {
    const { client, state } = makeMockDb();
    const evt = paymentIntentEvent({ metadata: {} });   // no church_id → handler skips
    const outcome = await dispatchStripeEvent(evt, { supabase: client, stripe: mockStripeClient() });

    expect(outcome.status).toBe('skipped');
    expect(state.webhookEvents[0].status).toBe('skipped');
    expect((state.webhookEvents[0] as { processing_error: string }).processing_error).toMatch(/church_id/);
    expect(state.ledgerEntries).toHaveLength(0);
  });
});

describe('stripe-dispatch — failure path', () => {
  it('routes handler exceptions into DLQ + marks webhook_events failed', async () => {
    const { client, state } = makeMockDb();

    // Inject a giving-insert failure by patching the supabase mock
    const sb = client as unknown as { from: (t: string) => unknown };
    const origFrom = sb.from.bind(sb);
    sb.from = ((table: string) => {
      if (table === 'giving') {
        return {
          upsert() {
            return {
              select() {
                return { single: async () => ({ data: null, error: { message: 'pg constraint X failed' } }) };
              },
            };
          },
        };
      }
      return origFrom(table);
    }) as typeof origFrom;

    const outcome = await dispatchStripeEvent(paymentIntentEvent(), { supabase: client, stripe: mockStripeClient() });

    expect(outcome.status).toBe('failed');
    expect((outcome as { error: string }).error).toMatch(/pg constraint X failed/);
    expect((outcome as { dlqRowId: string }).dlqRowId).toBeTruthy();

    expect(state.webhookEvents).toHaveLength(1);
    expect(state.webhookEvents[0].status).toBe('failed');
    expect(state.webhookEvents[0].processing_error).toMatch(/pg constraint X failed/);
    expect(state.webhookDlq).toHaveLength(1);
    expect(state.webhookDlq[0].attempt_count).toBe(1);
    expect(state.ledgerEntries).toHaveLength(0);
  });

  it('replaying after failure (same event redelivered) hits duplicate path; DOES NOT retry the handler', async () => {
    // First attempt fails; second attempt sees alreadyProcessed=true
    // because the webhook_events row already exists (status='failed').
    // For Sprint 3 MVP, replay is operator-driven via admin endpoint —
    // the dispatcher itself short-circuits on the dedup check.
    const { client, state } = makeMockDb();
    const sb = client as unknown as { from: (t: string) => unknown };
    const origFrom = sb.from.bind(sb);
    let failGiving = true;
    sb.from = ((table: string) => {
      if (table === 'giving' && failGiving) {
        return {
          upsert() {
            return { select() { return { single: async () => ({ data: null, error: { message: 'tx failed' } }) }; } };
          },
        };
      }
      return origFrom(table);
    }) as typeof origFrom;

    const evt = paymentIntentEvent();
    const stripe = mockStripeClient();
    await dispatchStripeEvent(evt, { supabase: client, stripe });

    failGiving = false;          // simulate fix
    const second = await dispatchStripeEvent(evt, { supabase: client, stripe });
    expect(second.status).toBe('duplicate');     // claim short-circuits
    expect(state.giving).toHaveLength(0);
    expect(state.ledgerEntries).toHaveLength(0);
  });
});

describe('stripe-dispatch — invoice.paid (recurring)', () => {
  it('fetches subscription, writes giving + ledger', async () => {
    const { client, state } = makeMockDb();
    const event = {
      id: 'evt_inv_1',
      type: 'invoice.paid',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'in_1',
          subscription: 'sub_test',
          amount_paid: 5000,
          currency: 'usd',
          payment_intent: 'pi_inv_1',
        } as Stripe.Invoice,
      },
    } as Stripe.Event;

    const stripe = mockStripeClient();
    const outcome = await dispatchStripeEvent(event, { supabase: client, stripe });
    expect(outcome.status).toBe('processed');
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test');
    expect(state.giving).toHaveLength(1);
    expect((state.giving[0] as { is_recurring: boolean }).is_recurring).toBe(true);
    expect(state.ledgerEntries).toHaveLength(1);
    expect((state.ledgerEntries[0] as { metadata: Record<string, unknown> }).metadata.stripe_subscription_id).toBe('sub_test');
  });

  it('invoice with no subscription is skipped (one-time invoice)', async () => {
    const { client, state } = makeMockDb();
    const event = {
      id: 'evt_inv_2', type: 'invoice.paid', created: 1,
      data: { object: { id: 'in_2', subscription: null, amount_paid: 1000, currency: 'usd' } as Stripe.Invoice },
    } as Stripe.Event;
    const outcome = await dispatchStripeEvent(event, { supabase: client, stripe: mockStripeClient() });
    expect(outcome.status).toBe('skipped');
    expect(state.ledgerEntries).toHaveLength(0);
  });
});

describe('stripe-dispatch — charge.refunded', () => {
  it('writes a refund debit to ledger', async () => {
    const { client, state } = makeMockDb();
    const event = {
      id: 'evt_ref_1', type: 'charge.refunded', created: 1,
      data: {
        object: {
          id: 'ch_1',
          amount_refunded: 2500,
          currency: 'usd',
          payment_intent: 'pi_x',
          metadata: { church_id: 'c-1', person_id: 'p-1' },
          refunds: { data: [{ reason: 'requested_by_customer' }] },
        } as unknown as Stripe.Charge,
      },
    } as Stripe.Event;

    const outcome = await dispatchStripeEvent(event, { supabase: client, stripe: mockStripeClient() });
    expect(outcome.status).toBe('processed');
    expect(state.ledgerEntries).toHaveLength(1);
    expect(state.ledgerEntries[0].kind).toBe('refund');
    expect(state.ledgerEntries[0].direction).toBe('debit');
    expect(state.ledgerEntries[0].amount_micro_usd).toBe(25_000_000);  // $25
  });

  it('refund with zero amount is skipped', async () => {
    const { client, state } = makeMockDb();
    const event = {
      id: 'evt_ref_zero', type: 'charge.refunded', created: 1,
      data: { object: { id: 'ch_z', amount_refunded: 0, metadata: { church_id: 'c-1' } } as unknown as Stripe.Charge },
    } as Stripe.Event;
    const outcome = await dispatchStripeEvent(event, { supabase: client, stripe: mockStripeClient() });
    expect(outcome.status).toBe('skipped');
    expect(state.ledgerEntries).toHaveLength(0);
  });
});

describe('stripe-dispatch — subscription lifecycle', () => {
  it('updates recurring_giving on subscription.created (no ledger entry)', async () => {
    const { client, state } = makeMockDb();
    const event = {
      id: 'evt_sub_1', type: 'customer.subscription.created', created: 1,
      data: {
        object: {
          id: 'sub_1',
          status: 'active',
          metadata: { church_id: 'c-1', person_id: 'p-1', fund: 'missions' },
          items: { data: [{ price: { unit_amount: 5000, recurring: { interval: 'month' } } }] },
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        } as unknown as Stripe.Subscription,
      },
    } as Stripe.Event;

    const outcome = await dispatchStripeEvent(event, { supabase: client, stripe: mockStripeClient() });
    expect(outcome.status).toBe('processed');
    expect(state.recurringGiving).toHaveLength(1);
    expect(state.recurringGiving[0].stripe_subscription_id).toBe('sub_1');
    expect(state.ledgerEntries).toHaveLength(0);    // state change, not money movement
  });
});
