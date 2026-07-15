/**
 * "Give & Impact Card" — Members Portal.
 *
 * Giving: real gifts, created through the same public, already-working
 * Stripe Connect endpoints the public /give/<slug> page uses
 * (/api/giving/create-payment-intent, /create-subscription), just with
 * the member's own person_id attached for attribution. Gift history and
 * recurring-gift management read/write real rows via /api/portal/giving.
 * Statement download is intentionally absent — no provider generates a
 * PDF anywhere in this codebase (see /api/portal/giving's
 * unsupported_functions).
 *
 * Impact Card: reads /api/neobank?resource=me (existing, real endpoint).
 * In demo mode that call has no Clerk session and returns null by design
 * (see usePortalImpactCard) — this page shows an honest "not available
 * in demo mode" state rather than fabricating card data.
 */
import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js/pure';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Gift, Repeat, History, CreditCard, ShieldCheck } from 'lucide-react';
import { usePortalGiving, type RecurringGiftEntry } from '../hooks/usePortalGiving';
import { usePortalImpactCard } from '../hooks/usePortalImpactCard';
import { microUsdToDollars } from '../../lib/services/impactCard';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const PRESET_AMOUNTS = [25, 50, 100, 250];
const FUND_OPTIONS = ['General', 'Building', 'Missions', 'Youth', 'Benevolence'];
/** Mirrors useImpactCardProgram.ts IMPACT_ROUTE_OPTIONS (admin hook) — kept
 * as a small local copy so this member-facing page doesn't import from an
 * admin-only hook module. */
const IMPACT_ROUTE_OPTIONS = [
  { label: 'Food Pantry', fund: 'benevolence' },
  { label: 'Tithe', fund: 'tithe' },
  { label: 'Missions', fund: 'missions' },
  { label: 'Building Fund', fund: 'building' },
  { label: 'Youth Ministry', fund: 'youth' },
];

type Frequency = 'one-time' | 'weekly' | 'monthly' | 'yearly';

export function PortalGiving() {
  const giving = usePortalGiving();
  const impactCard = usePortalImpactCard();

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Give &amp; Impact Card</h1>
        <p className="text-sm text-stone-500 mt-1">Make a gift, manage recurring giving, and check your Impact Card.</p>
      </div>

      <GiveSection giving={giving} />
      <RecurringSection giving={giving} />
      <HistorySection giving={giving} />
      <ImpactCardSection impactCard={impactCard} />
    </div>
  );
}

// ---- Give -----------------------------------------------------------

function GiveSection({ giving }: { giving: ReturnType<typeof usePortalGiving> }) {
  const [open, setOpen] = useState(false);
  const [amountUsd, setAmountUsd] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('one-time');
  const [fund, setFund] = useState('General');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const effectiveAmountCents = useMemo(() => {
    if (customAmount.trim() !== '') {
      const n = Number(customAmount.replace(/[,$]/g, ''));
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.round(n * 100);
    }
    return amountUsd * 100;
  }, [amountUsd, customAmount]);

  const stripePromise = useMemo(() => {
    if (!PUBLISHABLE_KEY || !clientSecret) return null;
    return loadStripe(PUBLISHABLE_KEY);
  }, [clientSecret]);

  if (!giving.data) return null;

  if (!giving.data.giving_active) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-900 mb-1 flex items-center gap-1.5"><Gift size={16} /> Give</h2>
        <p className="text-sm text-stone-500">Online giving isn't set up for {giving.data.church_name ?? 'your church'} yet.</p>
      </section>
    );
  }

  if (!PUBLISHABLE_KEY) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-900 mb-1 flex items-center gap-1.5"><Gift size={16} /> Give</h2>
        <p className="text-sm text-stone-500">Online giving is not yet configured on this deployment.</p>
      </section>
    );
  }

  async function handleContinue() {
    if (effectiveAmountCents < 100) { setError('Minimum gift is $1.'); return; }
    setError(null);
    setBusy(true);
    try {
      const isRecurring = frequency !== 'one-time';
      const endpoint = isRecurring ? '/api/giving/create-subscription' : '/api/giving/create-payment-intent';
      const body: Record<string, unknown> = {
        church_slug: giving.data!.church_slug,
        amount_cents: effectiveAmountCents,
        fund,
        person_id: giving.data!.person_id,
      };
      if (isRecurring) body.frequency = frequency;
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const respBody = await res.json();
      if (!res.ok) {
        setError(respBody.detail || respBody.error || `Could not start payment (HTTP ${res.status})`);
        return;
      }
      setClientSecret(respBody.client_secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="portal-give" className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 id="portal-give" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><Gift size={16} /> Give</h2>

      {done ? (
        <p className="text-sm text-emerald-600">Thank you! Your gift is being processed.</p>
      ) : !open ? (
        <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium">Make a gift</button>
      ) : clientSecret && stripePromise ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <PayInner
            amountCents={effectiveAmountCents}
            onSuccess={() => { setDone(true); setClientSecret(null); void giving.refresh(); }}
            onError={setError}
          />
        </Elements>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-stone-600">Frequency</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {(['one-time', 'weekly', 'monthly', 'yearly'] as Frequency[]).map(f => (
                <button key={f} type="button" onClick={() => setFrequency(f)}
                  className={`py-1.5 rounded-lg text-xs font-medium border ${frequency === f ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-stone-700 border-stone-300'}`}>
                  {f === 'one-time' ? 'One-time' : f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Amount</label>
            <div className="grid grid-cols-4 gap-2 mt-1 mb-2">
              {PRESET_AMOUNTS.map(preset => (
                <button key={preset} type="button" onClick={() => { setAmountUsd(preset); setCustomAmount(''); }}
                  className={`py-1.5 rounded-lg text-xs font-medium border ${amountUsd === preset && customAmount === '' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-stone-700 border-stone-300'}`}>
                  ${preset}
                </button>
              ))}
            </div>
            <input type="text" inputMode="decimal" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
              placeholder="Custom amount" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="give-fund" className="text-xs font-medium text-stone-600">Fund</label>
            <select id="give-fund" value={fund} onChange={e => setFund(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1">
              {FUND_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-700">Cancel</button>
            <button onClick={handleContinue} disabled={busy || effectiveAmountCents < 100} className="flex-1 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
              {busy ? 'Preparing…' : `Continue — $${(effectiveAmountCents / 100).toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PayInner({ amountCents, onSuccess, onError }: { amountCents: number; onSuccess: () => void; onError: (msg: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handlePay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href }, redirect: 'if_required' });
    if (error) { onError(error.message ?? 'Payment failed.'); setSubmitting(false); return; }
    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') { onSuccess(); return; }
    onError('Unexpected payment state. Please try again.');
    setSubmitting(false);
  }

  return (
    <div className="space-y-3">
      <PaymentElement />
      <button onClick={handlePay} disabled={submitting} className="w-full py-2.5 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
        {submitting ? 'Processing…' : `Give $${(amountCents / 100).toFixed(2)}`}
      </button>
    </div>
  );
}

// ---- Recurring --------------------------------------------------------

function RecurringSection({ giving }: { giving: ReturnType<typeof usePortalGiving> }) {
  if (!giving.data || giving.data.recurring_gifts.length === 0) return null;
  const active = giving.data.recurring_gifts.filter((r: RecurringGiftEntry) => r.status === 'active');

  return (
    <section aria-labelledby="portal-recurring" className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 id="portal-recurring" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5">
        <Repeat size={16} /> Recurring gifts
        {giving.data.giving_tier && (
          <span className="ml-1 inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700" data-testid="giving-tier-badge">
            {giving.data.giving_tier.label}
          </span>
        )}
      </h2>
      <ul className="space-y-2">
        {giving.data.recurring_gifts.map(r => (
          <li key={r.id} className="flex items-center justify-between text-sm">
            <div>
              <span className="text-stone-700">${Number(r.amount).toFixed(2)} / {r.frequency} — {r.fund}</span>
              <span className="block text-xs text-stone-400">
                {r.status === 'active' ? `Next: ${new Date(r.next_date).toLocaleDateString()}` : r.status}
                {r.payment_method_last4 ? ` · ${r.payment_method_brand ?? 'card'} ••••${r.payment_method_last4}` : ''}
              </span>
            </div>
            {r.status === 'active' && (
              <button
                onClick={() => giving.cancelRecurring(r.id)}
                disabled={giving.isCancelling}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>
      {active.length === 0 && <p className="text-xs text-stone-400 mt-1">No active recurring gifts.</p>}
    </section>
  );
}

// ---- History ------------------------------------------------------------

function HistorySection({ giving }: { giving: ReturnType<typeof usePortalGiving> }) {
  if (!giving.data) return null;
  return (
    <section aria-labelledby="portal-history" className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 id="portal-history" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><History size={16} /> Gift history</h2>
      {giving.data.gift_history.length === 0 ? (
        <p className="text-sm text-stone-400">No gifts on record yet.</p>
      ) : (
        <ul className="space-y-1.5" data-testid="gift-history-list">
          {giving.data.gift_history.map(g => (
            <li key={g.id} className="flex items-center justify-between text-sm">
              <span className="text-stone-700">{g.fund} {g.is_recurring && <span className="text-xs text-stone-400">(recurring)</span>}</span>
              <span className="text-stone-500">${Number(g.amount).toFixed(2)} · {new Date(g.date).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-stone-400 mt-3">Statement download isn't available yet — {giving.data.unsupported_functions.download_statement}</p>
    </section>
  );
}

// ---- Impact Card --------------------------------------------------------

function ImpactCardSection({ impactCard }: { impactCard: ReturnType<typeof usePortalImpactCard> }) {
  const { data, state, errorMessage, isSavingRoute, setImpactRoute } = impactCard;

  return (
    <section aria-labelledby="portal-impact-card" className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 id="portal-impact-card" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><CreditCard size={16} /> Impact Card</h2>

      {state === 'loading' && <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />}

      {state === 'signed_out' && (
        <p className="text-sm text-stone-500">Sign in to view your Impact Card status. (Not available in demo mode yet.)</p>
      )}

      {state === 'unavailable' && (
        <p className="text-sm text-stone-500">{errorMessage || 'Impact Card is not available right now.'}</p>
      )}

      {state === 'ready' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-stone-500">Application status</p>
              <p className="font-medium text-stone-900 capitalize">{data.kyc?.status.replace('_', ' ') ?? 'Not started'}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Card status</p>
              <p className="font-medium text-stone-900 capitalize">{data.cards[0]?.status ?? 'None issued'}</p>
            </div>
          </div>

          {data.account && (
            <div className="flex items-center gap-1.5 text-sm text-stone-700">
              <ShieldCheck size={14} className="text-emerald-600" />
              Available balance: ${microUsdToDollars(data.account.available_balance_micro_usd).toFixed(2)}
            </div>
          )}

          {data.person_id && (
            <div>
              <label htmlFor="impact-route" className="text-xs font-medium text-stone-600">Cause routing</label>
              <select
                id="impact-route"
                value={data.impact_route?.route_label ?? ''}
                disabled={isSavingRoute}
                onChange={e => {
                  const opt = IMPACT_ROUTE_OPTIONS.find(o => o.label === e.target.value);
                  if (opt && data.person_id) void setImpactRoute(data.person_id, opt.label, opt.fund);
                }}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1"
              >
                <option value="" disabled>Choose where your Impact Card impact goes</option>
                {IMPACT_ROUTE_OPTIONS.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
              </select>
            </div>
          )}

          {data.transactions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-stone-500 mb-1.5">Recent activity</p>
              <ul className="space-y-1">
                {data.transactions.slice(0, 5).map(t => (
                  <li key={t.id} className="flex items-center justify-between text-xs text-stone-600">
                    <span>{t.merchant_name ?? t.event_type}</span>
                    <span>${microUsdToDollars(t.amount_micro_usd).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
