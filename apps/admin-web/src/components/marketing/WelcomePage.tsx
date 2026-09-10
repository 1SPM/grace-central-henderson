/**
 * /welcome — landing page after Stripe Checkout success, OR after a
 * staff invitation is accepted (api/team/_invite.ts redirects here too).
 *
 * Stripe redirects here with ?session_id=cs_xxx after a successful
 * checkout. We don't validate the session_id (the webhook is the
 * source of truth) — we use the URL param only as a signal that this
 * is a fresh-payment landing, vs a returning user who navigated here.
 *
 * Team invitees land here signed in but with no church_id yet — Clerk
 * copies the invitation's publicMetadata (church_id, role,
 * grace_team_invite_token) onto the new user at signup, so we redeem
 * the token against api/team/_accept-invitation.ts on mount, then do a
 * full navigation into the app so the next JWT fetch picks up the
 * freshly-written claims (avoids reasoning about Clerk's token cache).
 *
 * The goal of this page: tell the user they're in, then give them
 * three concrete first-week actions. The hardest part of new-tenant
 * onboarding is the "now what?" moment after payment — we don't want
 * the user to drop off into a confusing dashboard.
 */

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useAuthContext } from '../../contexts/AuthContext';
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

type TeamInviteState = 'none' | 'redeeming' | 'redeemed' | 'error';
type TeamInviteResult = { state: TeamInviteState; role?: string; error?: string };

/**
 * Owns the useUser() call for team-invite redemption. Split out from
 * WelcomePage so the hook is only ever invoked by a component that's
 * conditionally mounted behind the Clerk-configured check below —
 * calling useUser() unconditionally in WelcomePage itself would throw
 * whenever ClerkProvider isn't mounted (demo mode, Clerk not yet
 * configured), and /welcome has no demo-mode route guard.
 */
function TeamInviteRedeemer({ getAuthToken, onChange }: {
  getAuthToken: () => Promise<string | null>;
  onChange: (result: TeamInviteResult) => void;
}) {
  const { user, isLoaded: userLoaded } = useUser();

  useEffect(() => {
    if (!userLoaded || !user) return;
    const token = user.publicMetadata?.grace_team_invite_token;
    if (typeof token !== 'string' || !token) return;

    let cancelled = false;
    onChange({ state: 'redeeming' });

    (async () => {
      try {
        const authToken = await getAuthToken();
        const res = await fetch('/api/team/accept-invitation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ token }),
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          onChange({ state: 'error', error: body.error || `Could not complete your invitation (HTTP ${res.status}).` });
          return;
        }

        onChange({ state: 'redeemed', role: body.role });
        await user.reload();
        window.location.assign('/');
      } catch (err) {
        if (!cancelled) {
          onChange({ state: 'error', error: err instanceof Error ? err.message : 'Network error.' });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [userLoaded, user]);

  return null;
}

const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function WelcomePage() {
  const { plan, status, trialDaysRemaining, loading } = useChurchPlan();
  const { getAuthToken } = useAuthContext();
  const [showFallback, setShowFallback] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedResult, setSeedResult] = useState<null | { ok: boolean; people: number; giving: number; events: number; skipped?: string; error?: string }>(null);
  const [teamInvite, setTeamInvite] = useState<TeamInviteResult>({ state: 'none' });

  const handleSeedDemo = async () => {
    setSeedBusy(true);
    setSeedResult(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/seed-demo-data', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      if (!res.ok) {
        setSeedResult({ ok: false, people: 0, giving: 0, events: 0, error: body.detail || body.error });
      } else {
        setSeedResult({
          ok: true,
          people: body.people_inserted ?? 0,
          giving: body.giving_inserted ?? 0,
          events: body.events_inserted ?? 0,
          skipped: body.skipped_reason,
        });
      }
    } catch (err) {
      setSeedResult({ ok: false, people: 0, giving: 0, events: 0, error: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setSeedBusy(false);
    }
  };

  // If the webhook hasn't landed yet (Stripe → us is usually <2s but can be longer),
  // show a small "we're confirming" state for the first 5s.
  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const isWebhookProcessed = !loading && (status === 'trial' || status === 'active');

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-12 px-4">
      {isClerkConfigured && (
        <TeamInviteRedeemer getAuthToken={getAuthToken} onChange={setTeamInvite} />
      )}
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
          {teamInvite.state === 'redeeming' ? (
            <p className="text-sm text-gray-500">Setting up your team access…</p>
          ) : teamInvite.state === 'redeemed' ? (
            <p className="text-base text-gray-700">
              You're in as <strong className="capitalize">{teamInvite.role}</strong>. Taking you to the dashboard…
            </p>
          ) : teamInvite.state === 'error' ? (
            <div className="mt-2 mx-auto max-w-md rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 text-left">
              <strong>We couldn't finish setting up your invitation:</strong> {teamInvite.error}
              <br />Ask whoever invited you to send a fresh invite, or write to{' '}
              <a href="mailto:support@grace-crm.app" className="underline">support@grace-crm.app</a>.
            </div>
          ) : loading || (!isWebhookProcessed && !showFallback) ? (
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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Want to see GRACE with sample data?</h3>
          <p className="text-sm text-gray-600 mb-3">
            We can populate your account with 20 sample members, 30 sample gifts, and 10 upcoming
            events so the dashboard isn't empty while you decide. Each sample row is tagged
            "sample-data" — you can bulk-delete them anytime, and they're hidden once you import 5+
            real members.
          </p>
          {seedResult && seedResult.ok && !seedResult.skipped && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 mb-3">
              Seeded {seedResult.people} people, {seedResult.giving} gifts, {seedResult.events} events.
              Refresh the dashboard to see them.
            </div>
          )}
          {seedResult && seedResult.skipped === 'already_populated' && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 mb-3">
              Your church already has data — sample seeding skipped to avoid mixing demo + real records.
            </div>
          )}
          {seedResult && !seedResult.ok && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-3">
              {seedResult.error}
            </div>
          )}
          <button
            onClick={handleSeedDemo}
            disabled={seedBusy || (seedResult?.ok && !seedResult.skipped)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 text-sm"
          >
            {seedBusy ? 'Seeding…' : seedResult?.ok && !seedResult.skipped ? 'Sample data added ✓' : 'Add sample data'}
          </button>
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
