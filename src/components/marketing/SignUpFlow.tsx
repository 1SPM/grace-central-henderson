/**
 * SignUpFlow — the end-to-end onboarding for a new church.
 *
 * Three steps, all on the /signup route:
 *   1. Clerk SignUp form (email + password OR social → verified email)
 *   2. Church name + admin name form → POST /api/billing/create-church
 *   3. Plan confirmation → POST /api/billing/create-checkout-session
 *      → window.location = checkout_url (redirects to Stripe Checkout)
 *
 * After Stripe Checkout succeeds, Stripe redirects to /welcome which
 * is handled by the main app — the user is now signed in (Clerk),
 * has a church (Supabase), and has an active trial (church_subscriptions
 * via webhook).
 *
 * Failure modes we handle inline:
 *   - Clerk sign-up fails → Clerk renders its own error UI
 *   - create-church 503 (service not configured) → show admin-friendly
 *     error with link to support
 *   - create-checkout-session 503 (Stripe price IDs not set in env) →
 *     show "we'll be in touch" with mailto fallback
 *   - User abandons mid-flow → we recover via idempotency on next visit
 *     (create-church returns the existing church if one is already linked)
 */

import React, { useState, useEffect } from 'react';
import { SignUp, useAuth, useUser } from '@clerk/clerk-react';

type Step = 'auth' | 'church-details' | 'plan-confirm' | 'redirecting';

interface SignUpFlowProps {
  initialPlan?: 'starter' | 'pro' | 'enterprise';
}

const PLAN_LABELS: Record<string, { name: string; price: number }> = {
  starter: { name: 'Starter', price: 49 },
  pro: { name: 'Pro', price: 199 },
  enterprise: { name: 'Enterprise', price: 499 },
};

export function SignUpFlow({ initialPlan = 'pro' }: SignUpFlowProps) {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [step, setStep] = useState<Step>('auth');
  const [plan] = useState<'starter' | 'pro' | 'enterprise'>(initialPlan);

  const [churchName, setChurchName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');

  const [churchId, setChurchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once Clerk auth lands, advance past the auth step.
  useEffect(() => {
    if (isSignedIn && step === 'auth') {
      setStep('church-details');
      // Pre-fill admin name from Clerk if available
      if (user?.fullName) setAdminName(user.fullName);
    }
  }, [isSignedIn, step, user?.fullName]);

  const handleCreateChurch = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/billing/create-church', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          church_name: churchName.trim(),
          admin_full_name: adminName.trim(),
          city: city.trim() || undefined,
          state: stateCode.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail || body.error || 'Failed to create church.');
        return;
      }
      setChurchId(body.church_id);
      setStep('plan-confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!churchId) return;
    setBusy(true);
    setError(null);
    setStep('redirecting');
    try {
      const token = await getToken();
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          church_id: churchId,
          plan_slug: plan,
          success_path: '/welcome',
          cancel_path: '/signup',
        }),
      });
      const body = await res.json();

      // When Stripe is not configured (dev / staging / demo environments),
      // fall back to a direct trial activation and skip Stripe entirely.
      if (res.status === 503 && body.error === 'stripe_not_configured') {
        const trialRes = await fetch('/api/billing/activate-trial', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (trialRes.ok) {
          window.location.assign('/welcome');
          return;
        }
        const trialBody = await trialRes.json().catch(() => ({}));
        setError(trialBody.detail || 'Could not activate trial. Contact support@grace-crm.app.');
        setStep('plan-confirm');
        return;
      }

      if (!res.ok) {
        setError(body.detail || body.error || 'Failed to start checkout.');
        setStep('plan-confirm');
        return;
      }
      window.location.assign(body.checkout_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
      setStep('plan-confirm');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-10 px-4">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>
            Start your 14-day trial
          </h1>
          <p className="text-sm text-gray-600">
            Selected plan: <strong>{PLAN_LABELS[plan].name}</strong> · ${PLAN_LABELS[plan].price}/mo
          </p>
        </header>

        <StepIndicator current={step} />

        {step === 'auth' && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
            <SignUp
              signInUrl="/signin"
              afterSignUpUrl="/signup"
              afterSignInUrl="/signup"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none border-none',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                },
              }}
            />
          </div>
        )}

        {step === 'church-details' && (
          <form onSubmit={handleCreateChurch} className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Tell us about your church</h2>
            <FormField label="Church name" required value={churchName} onChange={setChurchName} placeholder="Grace Community Church" />
            <FormField label="Your full name" required value={adminName} onChange={setAdminName} placeholder="Pastor Alex Rivera" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="City" value={city} onChange={setCity} placeholder="Austin" />
              <FormField label="State" value={stateCode} onChange={setStateCode} placeholder="TX" />
            </div>
            {error && <ErrorBanner message={error} />}
            <button
              type="submit"
              disabled={busy || !churchName.trim() || !adminName.trim()}
              className="w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Creating church…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'plan-confirm' && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Confirm your plan</h2>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{PLAN_LABELS[plan].name}</div>
                  <div className="text-xs text-gray-500">Billed monthly after 14-day free trial</div>
                </div>
                <div className="text-2xl font-light text-gray-900">${PLAN_LABELS[plan].price}/mo</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              You'll be redirected to Stripe to enter payment details. No charges until your trial ends.
              Cancel anytime from Settings → Billing.
            </p>
            {error && <ErrorBanner message={error} />}
            <button
              onClick={handleConfirmPlan}
              disabled={busy}
              className="w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Setting up checkout…' : 'Continue to Stripe'}
            </button>
          </div>
        )}

        {step === 'redirecting' && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mx-auto mb-4" />
            <p className="text-gray-700">Redirecting to Stripe…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'auth', label: 'Account' },
    { id: 'church-details', label: 'Church' },
    { id: 'plan-confirm', label: 'Plan' },
  ];
  const currentIdx = steps.findIndex((s) => s.id === current);
  const effectiveIdx = current === 'redirecting' ? 2 : currentIdx;
  return (
    <ol className="flex justify-center gap-2 mb-6">
      {steps.map((s, idx) => (
        <li
          key={s.id}
          className={[
            'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium',
            idx <= effectiveIdx
              ? 'bg-amber-100 text-amber-800'
              : 'bg-gray-100 text-gray-400',
          ].join(' ')}
        >
          <span
            className={[
              'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
              idx < effectiveIdx ? 'bg-amber-600 text-white' :
              idx === effectiveIdx ? 'bg-amber-200 text-amber-900' :
              'bg-gray-200 text-gray-500',
            ].join(' ')}
          >
            {idx + 1}
          </span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function FormField({ label, value, onChange, placeholder, required }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-amber-600">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
      />
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
      {message}
    </div>
  );
}
