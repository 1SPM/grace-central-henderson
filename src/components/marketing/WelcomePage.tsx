/**
 * /welcome — landing page after Stripe Checkout success.
 *
 * Stripe redirects here with ?session_id=cs_xxx after a successful
 * checkout. We don't validate the session_id (the webhook is the
 * source of truth) — we use the URL param only as a signal that this
 * is a fresh-payment landing, vs a returning user who navigated here.
 *
 * The goal of this page: tell the user they're in, then give them
 * three concrete first-week actions. The hardest part of new-tenant
 * onboarding is the "now what?" moment after payment — we don't want
 * the user to drop off into a confusing dashboard.
 */

import { useEffect, useState } from 'react';
import { useChurchPlan } from '../../hooks/useChurchPlan';

interface FirstStep {
  title: string;
  description: string;
  cta: string;
  href: string;
}

const FIRST_STEPS: FirstStep[] = [
  {
    title: 'Import your people',
    description:
      'Bring over your existing roster from Planning Center, Breeze, ChurchTrac, or any spreadsheet. The CSV wizard auto-detects column names — most uploads are one click.',
    cta: 'Open the importer',
    href: '/import',
  },
  {
    title: 'Set up online giving',
    description:
      'Stripe is already connected for your subscription. Add your church-side Stripe Connect account so members can give directly to your fund, with VWS taking only the platform fee per donation.',
    cta: 'Configure giving',
    href: '/#settings',
  },
  {
    title: 'Invite your team',
    description:
      'Add other pastors, staff, and trusted volunteer leaders. Each gets their own login with the right role — admins see everything; staff see only what they need.',
    cta: 'Open invitations',
    href: '/#settings',
  },
];

export function WelcomePage() {
  const { plan, status, trialDaysRemaining, loading } = useChurchPlan();
  const [showFallback, setShowFallback] = useState(false);

  // If the webhook hasn't landed yet (Stripe → us is usually <2s but can be longer),
  // show a small "we're confirming" state for the first 5s.
  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const isWebhookProcessed = !loading && (status === 'trial' || status === 'active');

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>
            Welcome to GRACE
          </h1>
          {loading || (!isWebhookProcessed && !showFallback) ? (
            <p className="text-sm text-gray-500">Confirming your subscription…</p>
          ) : isWebhookProcessed ? (
            <p className="text-base text-gray-700">
              You're on the <strong>{plan.name}</strong> plan
              {status === 'trial' && trialDaysRemaining !== null && (
                <> with <strong>{trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'}</strong> left in your free trial</>
              )}.
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              Your payment is confirmed. We're finalizing your account — should be ready in a few seconds.
              You can continue setting things up below; the trial indicator will update automatically.
            </p>
          )}
        </header>

        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-1">First three things</h2>
          <p className="text-sm text-gray-500 mb-6">
            These take about 15 minutes total. The order doesn't matter — do whichever calls to you first.
          </p>
          <ol className="space-y-5">
            {FIRST_STEPS.map((step, idx) => (
              <li key={step.title} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-semibold flex items-center justify-center text-sm">
                  {idx + 1}
                </div>
                <div className="flex-grow">
                  <h3 className="font-medium text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                  <a
                    href={step.href}
                    className="text-sm font-medium text-amber-700 hover:text-amber-900"
                  >
                    {step.cta} →
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <h3 className="text-sm font-medium text-amber-900 mb-2">Getting stuck?</h3>
          <p className="text-sm text-amber-800 mb-3">
            Reply to your welcome email or write to{' '}
            <a href="mailto:support@grace-crm.app" className="underline">support@grace-crm.app</a>.
            We answer every message from a real person within 48 hours.
          </p>
          <a
            href="/"
            className="inline-block text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            Skip ahead to the dashboard →
          </a>
        </div>
      </div>
    </div>
  );
}
