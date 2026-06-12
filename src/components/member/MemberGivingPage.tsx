import { useMemo, useState } from 'react';
import {
  Heart,
  DollarSign,
  CreditCard,
  Repeat,
  CheckCircle,
  AlertCircle,
  Gift,
  History,
  ChevronRight,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js/pure';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { GIVING_FUNDS, RECURRING_INTERVALS } from '../../lib/services/payments';
import { logMemberActivity } from '../../lib/services/memberActivity';
import type { Giving } from '../../types';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

interface MemberGivingPageProps {
  giving?: Giving[];
  personId?: string;
  churchName?: string;
  /** Slug for the Stripe Connect giving endpoints. Absent in demo mode. */
  churchSlug?: string | null;
  churchId?: string;
  memberEmail?: string;
  memberName?: string;
}

type GivingView = 'main' | 'give' | 'history';
type GivingStep = 'amount' | 'details' | 'payment' | 'success';

const PRESET_AMOUNTS = [25, 50, 100, 250];

/** API expects weekly|monthly|yearly; quarterly is not offered for card subs. */
const STRIPE_FREQUENCIES: Record<string, string> = {
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
};

export function MemberGivingPage({
  giving = [],
  personId,
  churchName = 'Grace Church',
  churchSlug,
  churchId,
  memberEmail,
  memberName,
}: MemberGivingPageProps) {
  const [view, setView] = useState<GivingView>('main');

  // Calculate giving stats
  const currentYear = new Date().getFullYear();
  const yearGiving = giving.filter(g =>
    g.personId === personId && new Date(g.date).getFullYear() === currentYear
  );
  const totalThisYear = yearGiving.reduce((sum, g) => sum + g.amount, 0);
  const lastGift = yearGiving.length > 0
    ? yearGiving.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  if (view === 'give') {
    return (
      <GiveForm
        churchName={churchName}
        churchSlug={churchSlug}
        churchId={churchId}
        personId={personId}
        memberEmail={memberEmail}
        memberName={memberName}
        onBack={() => setView('main')}
      />
    );
  }

  if (view === 'history') {
    return <GivingHistory giving={giving} personId={personId} onBack={() => setView('main')} />;
  }

  return (
    <div className="p-4">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Heart size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Online Giving</h2>
            <p className="text-white/80 text-sm">{churchName}</p>
          </div>
        </div>

        {personId && (
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/70 text-xs mb-1">Your giving this year</p>
            <p className="text-2xl font-bold">${totalThisYear.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Quick Give Button */}
      <button
        onClick={() => setView('give')}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-2 mb-4 active:scale-[0.98] transition-transform shadow-lg shadow-green-500/25"
      >
        <Gift size={20} />
        Give Now
      </button>

      {/* Quick Actions */}
      <div className="space-y-3">
        {personId && (
          <button
            onClick={() => setView('history')}
            className="w-full bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-lg flex items-center justify-center">
              <History className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900 dark:text-white">Giving History</p>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                {lastGift
                  ? `Last gift: $${lastGift.amount} on ${new Date(lastGift.date).toLocaleDateString()}`
                  : 'View your donations'
                }
              </p>
            </div>
            <ChevronRight className="text-gray-400" size={20} />
          </button>
        )}

        <button
          onClick={() => setView('give')}
          className="w-full bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-500/10 rounded-lg flex items-center justify-center">
            <Repeat className="text-slate-600 dark:text-slate-400" size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-gray-900 dark:text-white">Set Up Recurring</p>
            <p className="text-sm text-gray-500 dark:text-dark-400">Automate your giving</p>
          </div>
          <ChevronRight className="text-gray-400" size={20} />
        </button>
      </div>

      {/* Funds Info */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300 mb-3">Available Funds</h3>
        <div className="grid grid-cols-2 gap-2">
          {GIVING_FUNDS.slice(0, 6).map((fund) => (
            <div
              key={fund.id}
              className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3"
            >
              <p className="font-medium text-gray-900 dark:text-white text-sm">{fund.name}</p>
              <p className="text-xs text-gray-500 dark:text-dark-400">{fund.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Give Form Component — real Stripe Connect checkout when the church has
// giving configured (slug + publishable key); simulated success otherwise
// so demo mode keeps working.
function GiveForm({
  churchName,
  churchSlug,
  churchId,
  personId,
  memberEmail,
  memberName,
  onBack,
}: {
  churchName: string;
  churchSlug?: string | null;
  churchId?: string;
  personId?: string;
  memberEmail?: string;
  memberName?: string;
  onBack: () => void;
}) {
  const [step, setStep] = useState<GivingStep>('amount');
  const [amount, setAmount] = useState<string>('');
  const [customAmount, setCustomAmount] = useState(false);
  const [fund, setFund] = useState('tithe');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('month');
  const [email, setEmail] = useState(memberEmail ?? '');
  const [firstName, setFirstName] = useState(memberName?.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(memberName?.split(' ').slice(1).join(' ') ?? '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverFees, setCoverFees] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const canUseStripe = !!PUBLISHABLE_KEY && !!churchSlug;
  const recurringOptions = canUseStripe
    ? RECURRING_INTERVALS.filter(i => i.id in STRIPE_FREQUENCIES)
    : RECURRING_INTERVALS;

  const numericAmount = parseFloat(amount) || 0;
  const processingFee = numericAmount * 0.029 + 0.30;
  const totalAmount = coverFees ? numericAmount + processingFee : numericAmount;

  const stripePromise = useMemo(() => {
    if (!PUBLISHABLE_KEY || !clientSecret) return null;
    return loadStripe(PUBLISHABLE_KEY);
  }, [clientSecret]);

  const handlePresetAmount = (value: number) => {
    setAmount(value.toString());
    setCustomAmount(false);
  };

  const recordGiftActivity = () => {
    if (!churchId) return;
    logMemberActivity({
      churchId,
      personId,
      eventType: 'gift',
      metadata: {
        amount: Number(totalAmount.toFixed(2)),
        fund,
        recurring: isRecurring,
        frequency: isRecurring ? frequency : null,
        source: 'portal',
      },
    });
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      if (!canUseStripe) {
        // Demo fallback — no Stripe configured.
        await new Promise(resolve => setTimeout(resolve, 1500));
        recordGiftActivity();
        setStep('success');
        return;
      }

      const amountCents = Math.round(totalAmount * 100);
      const endpoint = isRecurring ? '/api/giving/create-subscription' : '/api/giving/create-payment-intent';
      const reqBody: Record<string, unknown> = {
        church_slug: churchSlug,
        amount_cents: amountCents,
        fund,
        email: email.trim() || undefined,
        donor_name: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
        person_id: personId || undefined,
      };
      if (isRecurring) {
        reqBody.frequency = STRIPE_FREQUENCIES[frequency] ?? 'monthly';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.error === 'giving_not_active') {
          setError('Online giving is not fully set up yet. Please contact the church office.');
        } else {
          setError(body.detail || body.error || `Could not start payment (HTTP ${res.status})`);
        }
        return;
      }
      setClientSecret(body.client_secret);
      setStep('payment');
    } catch {
      setError('Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="p-4 text-center">
        <div className="py-8">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-white" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Thank You!</h2>
          <p className="text-gray-500 dark:text-dark-400">
            Your gift of <span className="font-bold text-green-600">${totalAmount.toFixed(2)}</span> has been received
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4 text-left space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount</span>
            <span className="font-medium text-gray-900 dark:text-white">${totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Fund</span>
            <span className="font-medium text-gray-900 dark:text-white capitalize">{fund}</span>
          </div>
          {isRecurring && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Frequency</span>
              <span className="font-medium text-slate-600 capitalize">{frequency}ly</span>
            </div>
          )}
          {email && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Receipt</span>
              <span className="font-medium text-gray-900 dark:text-white">{email}</span>
            </div>
          )}
        </div>

        <button
          onClick={onBack}
          className="w-full py-3 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 font-medium rounded-xl"
        >
          Done
        </button>
      </div>
    );
  }

  if (step === 'payment' && stripePromise && clientSecret) {
    return (
      <div className="p-4">
        <button
          onClick={() => { setClientSecret(null); setStep('details'); }}
          className="text-sm text-gray-500 mb-4"
        >
          ← Back
        </button>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Payment</h2>
        <p className="text-gray-500 dark:text-dark-400 text-sm mb-6">
          ${totalAmount.toFixed(2)} to {churchName}{isRecurring ? ` · ${frequency}ly` : ''} — secured by Stripe
        </p>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: 'stripe', variables: { colorPrimary: '#059669' } },
          }}
        >
          <PortalPayStep
            amount={totalAmount}
            onSuccess={() => {
              recordGiftActivity();
              setStep('success');
            }}
          />
        </Elements>
      </div>
    );
  }

  if (step === 'details') {
    return (
      <div className="p-4">
        <button
          onClick={() => setStep('amount')}
          className="text-sm text-gray-500 mb-4"
        >
          ← Back
        </button>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Your Information</h2>
        <p className="text-gray-500 dark:text-dark-400 text-sm mb-6">For your receipt</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl bg-stone-100 dark:bg-dark-800 text-gray-900 dark:text-white text-base"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl bg-stone-100 dark:bg-dark-800 text-gray-900 dark:text-white text-base"
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl bg-stone-100 dark:bg-dark-800 text-gray-900 dark:text-white text-base"
              placeholder="john@example.com"
            />
          </div>

          <label className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
            <input
              type="checkbox"
              checked={coverFees}
              onChange={(e) => setCoverFees(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-amber-500"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white text-sm">
                Cover processing fees (+${processingFee.toFixed(2)})
              </p>
              <p className="text-xs text-gray-500">100% goes to the church</p>
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!email || !firstName || !lastName || isProcessing}
          className="w-full mt-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {canUseStripe ? 'Preparing payment…' : 'Processing...'}
            </>
          ) : (
            <>
              <CreditCard size={20} />
              {canUseStripe ? `Continue to Pay $${totalAmount.toFixed(2)}` : `Pay $${totalAmount.toFixed(2)}`}
            </>
          )}
        </button>
      </div>
    );
  }

  // Amount step
  return (
    <div className="p-4">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 mb-4"
      >
        ← Back
      </button>

      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Heart className="text-white" size={28} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Give to {churchName}</h2>
      </div>

      {/* Fund Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
          Select Fund
        </label>
        <div className="grid grid-cols-3 gap-2">
          {GIVING_FUNDS.slice(0, 6).map((f) => (
            <button
              key={f.id}
              onClick={() => setFund(f.id)}
              className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                fund === f.id
                  ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-400'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
          Amount
        </label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {PRESET_AMOUNTS.map((value) => (
            <button
              key={value}
              onClick={() => handlePresetAmount(value)}
              className={`py-3 rounded-xl border-2 font-bold transition-all ${
                amount === value.toString() && !customAmount
                  ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300'
              }`}
            >
              ${value}
            </button>
          ))}
        </div>

        <div
          onClick={() => setCustomAmount(true)}
          className={`p-3 rounded-xl border-2 transition-all ${
            customAmount
              ? 'border-green-500 bg-green-50 dark:bg-green-500/10'
              : 'border-gray-200 dark:border-dark-600'
          }`}
        >
          {customAmount ? (
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full pl-8 bg-transparent text-center font-bold focus:outline-none text-gray-900 dark:text-white text-lg"
                autoFocus
                min="1"
                step="0.01"
              />
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-dark-400">Custom Amount</p>
          )}
        </div>
      </div>

      {/* Recurring Toggle */}
      <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="text-slate-500" size={18} />
            <span className="font-medium text-gray-900 dark:text-white text-sm">Make recurring</span>
          </div>
          <button
            onClick={() => setIsRecurring(!isRecurring)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isRecurring ? 'bg-slate-500' : 'bg-gray-300 dark:bg-dark-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                isRecurring ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {isRecurring && (
          <div className={`mt-3 grid gap-2 ${recurringOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {recurringOptions.map((interval) => (
              <button
                key={interval.id}
                onClick={() => setFrequency(interval.id)}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  frequency === interval.id
                    ? 'bg-slate-500 text-white'
                    : 'bg-stone-100 dark:bg-dark-700 text-gray-600 dark:text-dark-400 border border-gray-200 dark:border-dark-600'
                }`}
              >
                {interval.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setStep('details')}
        disabled={numericAmount < 1}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50"
      >
        Continue with ${numericAmount.toFixed(2)} {isRecurring && `/ ${frequency}`}
      </button>
    </div>
  );
}

// Stripe Elements confirmation step (must render inside <Elements>).
function PortalPayStep({ amount, onSuccess }: { amount: number; onSuccess: () => void }) {
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
    setError('Unexpected payment state. Please try again or contact the church office.');
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <PaymentElement />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={submitting}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard size={20} />
            Give ${amount.toFixed(2)}
          </>
        )}
      </button>
    </div>
  );
}

// Giving History Component
function GivingHistory({
  giving,
  personId,
  onBack
}: {
  giving: Giving[];
  personId?: string;
  onBack: () => void;
}) {
  const myGiving = personId
    ? giving.filter(g => g.personId === personId).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    : [];

  const currentYear = new Date().getFullYear();
  const totalThisYear = myGiving
    .filter(g => new Date(g.date).getFullYear() === currentYear)
    .reduce((sum, g) => sum + g.amount, 0);

  return (
    <div className="p-4">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 mb-4"
      >
        ← Back
      </button>

      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Giving History</h2>
      <p className="text-gray-500 dark:text-dark-400 text-sm mb-4">Your donations this year</p>

      {/* Summary */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white mb-6">
        <p className="text-white/80 text-sm">Total {currentYear}</p>
        <p className="text-3xl font-bold">${totalThisYear.toFixed(2)}</p>
        <p className="text-white/70 text-xs mt-1">{myGiving.filter(g => new Date(g.date).getFullYear() === currentYear).length} donations</p>
      </div>

      {/* History List */}
      {myGiving.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-dark-400">
          <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No giving history found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myGiving.map((gift) => (
            <div
              key={gift.id}
              className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-900 dark:text-white">${gift.amount.toFixed(2)}</span>
                <span className="text-xs text-gray-500 dark:text-dark-400">
                  {new Date(gift.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-dark-700 rounded capitalize text-gray-600 dark:text-dark-400">
                  {gift.fund}
                </span>
                <span className="text-xs text-gray-500 dark:text-dark-500 capitalize">
                  {gift.method}
                </span>
                {gift.isRecurring && (
                  <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-500/10 rounded text-slate-600 dark:text-slate-400">
                    Recurring
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
