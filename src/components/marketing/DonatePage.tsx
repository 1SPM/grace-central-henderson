/**
 * Public donation page at /give/<church_slug>.
 *
 * Three steps:
 *   1. Pick amount + fund + (optional) email
 *   2. PaymentElement renders Stripe Elements
 *   3. Thank-you confirmation
 *
 * Auth: none. Members hit a URL the church publishes; no login.
 *
 * The PaymentIntent is created via /api/giving/create-payment-intent
 * which routes through the church's connected Stripe account with our
 * platform fee deducted (PR #96 set up the Connect side).
 */

import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js/pure';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

const PRESET_AMOUNTS = [25, 50, 100, 250, 500, 1000];
const FUND_OPTIONS = ['General', 'Building', 'Missions', 'Youth', 'Benevolence'];

type Step = 'pick' | 'pay' | 'done';

interface DonatePageProps {
  /** From the URL path /give/<slug> */
  churchSlug: string;
}

export function DonatePage({ churchSlug }: DonatePageProps) {
  const [step, setStep] = useState<Step>('pick');
  const [amountUsd, setAmountUsd] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [fund, setFund] = useState('General');
  const [email, setEmail] = useState('');
  const [donorName, setDonorName] = useState('');
  const [note, setNote] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [churchName, setChurchName] = useState<string | null>(null);
  const [platformFeeCents, setPlatformFeeCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const handleContinue = async () => {
    if (effectiveAmountCents < 100) {
      setError('Minimum donation is $1.');
      return;
    }
    if (effectiveAmountCents > 5_000_000) {
      setError('Maximum donation is $50,000 — for larger gifts please contact the church directly.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/giving/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          church_slug: churchSlug,
          amount_cents: effectiveAmountCents,
          fund,
          email: email.trim() || undefined,
          donor_name: donorName.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.error === 'giving_not_active') {
          setError('This church hasn\'t finished setting up online giving yet. Please check back soon.');
        } else if (body.error === 'church_not_found') {
          setError('Church not found. The link may be outdated.');
        } else {
          setError(body.detail || body.error || `Could not start payment (HTTP ${res.status})`);
        }
        return;
      }
      setClientSecret(body.client_secret);
      setChurchName(body.church_name);
      setPlatformFeeCents(body.platform_fee_cents);
      setStep('pay');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  };

  if (!PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 px-4">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-md text-center">
          <h1 className="text-xl font-medium text-gray-900 mb-2">Donations temporarily unavailable</h1>
          <p className="text-sm text-gray-600">
            Online giving is not yet configured. Please contact the church directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-10 px-4">
      <div className="max-w-lg mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-light text-gray-900 mb-1" style={{ fontFamily: 'Fraunces, serif' }}>
            Give to {churchName ?? 'the church'}
          </h1>
          <p className="text-sm text-gray-600">
            Secured by Stripe · 100% goes to the church (minus standard processing fees)
          </p>
        </header>

        {step === 'pick' && (
          <PickStep
            amountUsd={amountUsd}
            setAmountUsd={(v) => { setAmountUsd(v); setCustomAmount(''); }}
            customAmount={customAmount}
            setCustomAmount={(v) => { setCustomAmount(v); }}
            fund={fund}
            setFund={setFund}
            email={email}
            setEmail={setEmail}
            donorName={donorName}
            setDonorName={setDonorName}
            note={note}
            setNote={setNote}
            error={error}
            busy={busy}
            onContinue={handleContinue}
            effectiveAmountCents={effectiveAmountCents}
          />
        )}

        {step === 'pay' && stripePromise && clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: 'stripe', variables: { colorPrimary: '#c08a2d' } },
            }}
          >
            <PayStep
              amountCents={effectiveAmountCents}
              platformFeeCents={platformFeeCents}
              fund={fund}
              onBack={() => setStep('pick')}
              onSuccess={() => setStep('done')}
            />
          </Elements>
        )}

        {step === 'done' && (
          <DoneStep amountCents={effectiveAmountCents} fund={fund} email={email} />
        )}
      </div>
    </div>
  );
}

// ---- subcomponents ----------------------------------------------------

function PickStep({
  amountUsd,
  setAmountUsd,
  customAmount,
  setCustomAmount,
  fund,
  setFund,
  email,
  setEmail,
  donorName,
  setDonorName,
  note,
  setNote,
  error,
  busy,
  onContinue,
  effectiveAmountCents,
}: {
  amountUsd: number;
  setAmountUsd: (v: number) => void;
  customAmount: string;
  setCustomAmount: (v: string) => void;
  fund: string;
  setFund: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  donorName: string;
  setDonorName: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  error: string | null;
  busy: boolean;
  onContinue: () => void;
  effectiveAmountCents: number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmountUsd(preset)}
              className={[
                'py-2 rounded-lg text-sm font-medium border',
                amountUsd === preset && customAmount === ''
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400',
              ].join(' ')}
            >
              ${preset}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-gray-500">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Custom amount"
            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Fund</label>
        <select
          value={fund}
          onChange={(e) => setFund(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {FUND_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="For the receipt"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-xs text-gray-400">(for receipt)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note <span className="text-xs text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='e.g. "In memory of…"'
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={onContinue}
        disabled={busy || effectiveAmountCents < 100}
        className="w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Preparing payment…' : `Continue to give ${effectiveAmountCents >= 100 ? `$${(effectiveAmountCents / 100).toFixed(2)}` : ''}`}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Card spending is not a tax-deductible charitable contribution.
        Online donations through this form are tax-deductible per IRS rules.
      </p>
    </div>
  );
}

function PayStep({
  amountCents,
  platformFeeCents,
  fund,
  onBack,
  onSuccess,
}: {
  amountCents: number;
  platformFeeCents: number;
  fund: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try a different card.');
      setSubmitting(false);
      return;
    }
    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      onSuccess();
      return;
    }
    setError('Unexpected payment state. Please try again or contact support.');
    setSubmitting(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        <div className="flex justify-between mb-1">
          <span>Amount</span>
          <strong>${(amountCents / 100).toFixed(2)}</strong>
        </div>
        <div className="flex justify-between text-amber-700 text-xs">
          <span>Fund</span>
          <span>{fund}</span>
        </div>
        <div className="flex justify-between text-amber-700 text-xs">
          <span>Platform fee (already included)</span>
          <span>${(platformFeeCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={handlePay}
          disabled={submitting}
          className="flex-1 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {submitting ? 'Processing…' : `Give $${(amountCents / 100).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

function DoneStep({ amountCents, fund, email }: { amountCents: number; fund: string; email: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-medium text-gray-900">Thank you for your gift</h2>
      <p className="text-sm text-gray-700">
        Your <strong>${(amountCents / 100).toFixed(2)}</strong> donation to the <strong>{fund}</strong> fund
        is being processed.
      </p>
      {email && (
        <p className="text-sm text-gray-600">
          A receipt will land in <strong>{email}</strong> within a few minutes.
        </p>
      )}
      <p className="text-xs text-gray-500 pt-4">
        Powered by GRACE — <a href="/" className="text-amber-700 hover:text-amber-900">Learn more about online giving for your church</a>
      </p>
    </div>
  );
}

