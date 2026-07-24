/**
 * Payment / entitlement NEGATIVE tests (hermetic — no DB, no network,
 * no real charges). Companion audit deliverable for the 2026-07-23
 * payment/subscription/entitlement review.
 *
 * Each test encodes one attack and asserts the system refuses it:
 *   - Forged successful-payment response  → signature rejected
 *   - Replayed webhook                    → idempotent (handler runs once)
 *   - Changed product ID / changed price  → entitlement follows the signed
 *                                           Stripe price via server catalog;
 *                                           an off-catalog price grants nothing
 *   - Duplicate fulfillment               → ledger dedups on (source,event id)
 *   - Cancelled subscription retains access→ gate denies non-active status
 *
 * The two "user directly writes the DB" cases (entitlement column / token
 * balance) are RLS properties — see tools/entitlement-billing-rls-smoke.test.ts.
 */

import { describe, it, expect, vi } from 'vitest';
import Stripe from 'stripe';

// gates.ts captures SUPABASE_URL / SERVICE_KEY at module load, so these
// must be set BEFORE the imports run (vi.hoisted runs first). Values are
// unused — every gate test passes an explicit mock client. STRIPE_PRICE_PRO
// is read lazily (per call) but set here too for one place.
vi.hoisted(() => {
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.STRIPE_PRICE_PRO = 'price_pro_real';
});

import { dispatchStripeEvent } from './stripe-dispatch.js';
import { STRIPE_HANDLERS } from './stripe-handlers.js';
import { appendLedgerEntry } from '../ledger.js';
import { requirePlanGate } from '../billing/gates.js';

const CHURCH = '00000000-0000-0000-0000-0000000000c1';

// ── 1. Forged successful-payment response ────────────────────────────
describe('forged successful-payment response is rejected at the signature boundary', () => {
  const stripe = new Stripe('sk_test_dummy', { apiVersion: '2023-10-16' });
  const secret = 'whsec_realsigningsecret';
  const payload = JSON.stringify({
    id: 'evt_forged', type: 'customer.subscription.updated',
    data: { object: { id: 'sub_x', metadata: { church_id: CHURCH, purpose: 'saas' } } },
  });

  it('a body signed with the WRONG secret does not verify', () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_attacker' });
    expect(() => stripe.webhooks.constructEvent(payload, header, secret)).toThrow();
  });

  it('a body tampered AFTER signing does not verify', () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const tampered = payload.replace('customer.subscription.updated', 'invoice.paid');
    expect(() => stripe.webhooks.constructEvent(tampered, header, secret)).toThrow();
  });

  it('an unsigned body does not verify', () => {
    expect(() => stripe.webhooks.constructEvent(payload, '', secret)).toThrow();
  });

  it('the correctly-signed body DOES verify (positive control)', () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    expect(event.id).toBe('evt_forged');
  });
});

// ── Mock Supabase for the dispatch/replay test ───────────────────────
function makeDispatchMock() {
  const store = new Map<string, { id: string; status: string }>();
  const calls = { recurringUpserts: 0 };
  let seq = 0;

  function webhookEvents() {
    const st: { op?: string; row?: Record<string, unknown>; f: Record<string, unknown> } = { f: {} };
    const b: Record<string, unknown> = {};
    b.insert = (row: Record<string, unknown>) => { st.op = 'insert'; st.row = row; return b; };
    b.update = () => { st.op = 'update'; return b; };
    b.select = () => b;
    b.eq = (c: string, v: unknown) => { st.f[c] = v; return b; };
    b.single = () => finish(true);
    b.maybeSingle = () => finish(false);
    (b as { then: unknown }).then = (onF: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(onF);
    function finish(_single: boolean) {
      if (st.op === 'insert') {
        const key = `${st.row!.source}:${st.row!.source_event_id}`;
        if (store.has(key)) return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value' } });
        const id = `we_${++seq}`;
        store.set(key, { id, status: 'received' });
        return Promise.resolve({ data: { id, status: 'received' }, error: null });
      }
      // select lookup
      const key = `${st.f.source}:${st.f.source_event_id}`;
      return Promise.resolve({ data: store.get(key) ?? null, error: null });
    }
    return b;
  }
  function recurring() {
    return { upsert: () => { calls.recurringUpserts++; return Promise.resolve({ error: null }); } };
  }
  const supabase = {
    from(table: string) {
      if (table === 'webhook_events') return webhookEvents();
      if (table === 'recurring_giving') return recurring();
      // dlq / anything else: benign
      return { insert: () => Promise.resolve({ data: { id: 'x' }, error: null }), select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
    },
  };
  return { supabase, calls };
}

// ── 2. Replayed webhook is idempotent ────────────────────────────────
describe('replayed webhook is idempotent (fulfillment runs once)', () => {
  const event = {
    id: 'evt_replay', type: 'customer.subscription.created', created: 1_700_000_000,
    data: { object: {
      id: 'sub_replay', status: 'active', metadata: { church_id: CHURCH },
      items: { data: [{ price: { unit_amount: 2500, recurring: { interval: 'month' } } }] },
      current_period_end: 1_702_000_000,
    } },
  } as unknown as Stripe.Event;

  it('the second delivery of the same event id is a no-op duplicate', async () => {
    const { supabase, calls } = makeDispatchMock();
    const ctx = { supabase: supabase as never, stripe: {} as never };

    const first = await dispatchStripeEvent(event, ctx);
    const second = await dispatchStripeEvent(event, ctx);

    expect(first.status).toBe('processed');
    expect(second.status).toBe('duplicate');
    expect(calls.recurringUpserts).toBe(1); // fulfillment happened exactly once
  });
});

// ── Mock for the SaaS entitlement handler ────────────────────────────
function makeSaasCtx() {
  const captured: { churchUpdate: Record<string, unknown> | null; subUpsert: Record<string, unknown> | null } = {
    churchUpdate: null, subUpsert: null,
  };
  const supabase = {
    from(table: string) {
      if (table === 'church_subscriptions') {
        return { upsert: (row: Record<string, unknown>) => { captured.subUpsert = row; return Promise.resolve({ error: null }); } };
      }
      if (table === 'churches') {
        return { update: (row: Record<string, unknown>) => { captured.churchUpdate = row; return { eq: () => Promise.resolve({ error: null }) }; } };
      }
      return {};
    },
  };
  return { ctx: { supabase: supabase as never, stripe: {} as never }, captured };
}

function saasSubEvent(priceId: string): Stripe.Event {
  return {
    id: `evt_${priceId}`, type: 'customer.subscription.updated', created: 1_700_000_000,
    data: { object: {
      id: 'sub_saas', status: 'active', customer: 'cus_1',
      metadata: { church_id: CHURCH, purpose: 'saas' },
      items: { data: [{ price: { id: priceId } }] },
      current_period_start: 1_700_000_000, current_period_end: 1_702_000_000,
      trial_start: null, trial_end: null, canceled_at: null, cancel_at_period_end: false,
    } },
  } as unknown as Stripe.Event;
}

// ── 3 & 4. Changed product ID / changed price ────────────────────────
describe('entitlement is derived from the signed Stripe price via the server catalog', () => {
  const handler = STRIPE_HANDLERS['customer.subscription.updated'];

  it('an OFF-CATALOG price (forged/swapped product or price) grants NO entitlement', async () => {
    const { ctx, captured } = makeSaasCtx();
    const result = await handler(saasSubEvent('price_attacker_or_wrong'), ctx);
    expect(result.status).toBe('skipped');
    expect(captured.churchUpdate).toBeNull();   // churches entitlement never mirrored
    expect(captured.subUpsert).toBeNull();
  });

  it('the provisioned Pro price maps to the Pro plan (server catalog, not client input)', async () => {
    const { ctx, captured } = makeSaasCtx();
    const result = await handler(saasSubEvent('price_pro_real'), ctx);
    expect(result.status).toBe('processed');
    expect(captured.churchUpdate).toMatchObject({ subscription_plan: 'pro', subscription_status: 'active' });
    expect(captured.subUpsert).toMatchObject({ stripe_price_id: 'price_pro_real', plan_slug: 'pro' });
  });
});

// ── 5. Duplicate fulfillment (ledger dedup) ──────────────────────────
describe('duplicate fulfillment does not double-credit the ledger', () => {
  function ledgerMock(existing: Set<string>) {
    return {
      from() {
        return {
          insert: (row: { source: string; source_event_id: string }) => ({
            select: () => ({
              single: () => {
                const key = `${row.source}:${row.source_event_id}`;
                if (existing.has(key)) return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value' } });
                existing.add(key);
                return Promise.resolve({ data: { id: `led_${existing.size}` }, error: null });
              },
            }),
          }),
        };
      },
    };
  }
  const entry = {
    churchId: CHURCH, source: 'stripe' as const, sourceEventId: 'evt_dup',
    kind: 'donation' as const, direction: 'credit' as const, amountMicroUsd: 5_000_000,
    occurredAt: new Date('2026-07-23T00:00:00Z'),
  };

  it('first append inserts, second append with same (source,event id) is a dedup no-op', async () => {
    const seen = new Set<string>();
    const supabase = ledgerMock(seen) as never;
    const first = await appendLedgerEntry(supabase, entry);
    const second = await appendLedgerEntry(supabase, entry);
    expect(first).toMatchObject({ inserted: true, duplicate: false });
    expect(second).toMatchObject({ inserted: false, duplicate: true });
    expect(seen.size).toBe(1); // only one ledger row ever created
  });
});

// ── 6. Cancelled / expired subscription retains access? — NO ─────────
describe('gate denies access once the subscription is no longer trial/active', () => {
  function gateMock(status: string | null, plan: string | null) {
    return {
      from() {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { subscription_status: status, subscription_plan: plan }, error: null }) }) }) };
      },
    } as never;
  }

  it('canceled → 403 subscription_inactive (access removed)', async () => {
    const r = await requirePlanGate(CHURCH, 'cardProgram', gateMock('canceled', 'enterprise'));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(403); expect(r.error).toBe('subscription_inactive'); }
  });

  it('past_due → 403 subscription_inactive', async () => {
    const r = await requirePlanGate(CHURCH, 'cardProgram', gateMock('past_due', 'enterprise'));
    expect(r.ok).toBe(false);
  });

  it('unpaid → 403 subscription_inactive', async () => {
    const r = await requirePlanGate(CHURCH, 'cardProgram', gateMock('unpaid', 'enterprise'));
    expect(r.ok).toBe(false);
  });

  it('active + entitled plan → allowed (positive control)', async () => {
    const r = await requirePlanGate(CHURCH, 'cardProgram', gateMock('active', 'enterprise'));
    expect(r.ok).toBe(true);
  });

  it('active but plan lacks the gate → 402 plan_required (no silent grant)', async () => {
    const r = await requirePlanGate(CHURCH, 'cardProgram', gateMock('active', 'starter'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(402);
  });
});
