/**
 * Settings → Online Giving section.
 *
 * Single-call status (GET /api/billing/connect-status) tells us where
 * the church is in the Stripe Connect flow:
 *
 *   - Not connected         → big "Connect Stripe to accept giving" button
 *   - Onboarding in progress → "Continue onboarding" + list of currently_due
 *   - Connected + active    → green check, "Manage in Stripe" link
 *   - Connected + disabled  → red banner with disabled_reason + "Resume onboarding"
 *
 * The platform fee % is shown so admins know the math up front — no
 * surprises later.
 */

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Check, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

interface ConnectStatus {
  connected: boolean;
  account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  currently_due: string[];
  disabled_reason: string | null;
  details_submitted?: boolean;
  church_slug: string | null;
}

const PLATFORM_FEE_PERCENT = 2.5;   // VWS platform fee on donations. Match the number in api/giving/* when wired.

export function SettingsGiving() {
  const { getAuthToken } = useAuthContext();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/billing/connect-status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail || body.error || `HTTP ${res.status}`);
        return;
      }
      setStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    refresh();
    // If the URL has ?stripe_connect=ok (returned from onboarding), refresh
    // immediately to pick up the new state.
    if (typeof window !== 'undefined' && window.location.search.includes('stripe_connect=ok')) {
      // small delay to let the Stripe webhook arrive
      const t = setTimeout(refresh, 1500);
      return () => clearTimeout(t);
    }
  }, [refresh]);

  const startOnboarding = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/billing/connect-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const body = await res.json();
      if (!res.ok || !body.onboarding_url) {
        setError(body.detail || body.error || `HTTP ${res.status}`);
        return;
      }
      window.location.assign(body.onboarding_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard size={18} className="text-gray-500" />
        <h2 className="font-semibold text-gray-900 dark:text-dark-100">Online giving</h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking your Stripe Connect status…
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && status && !status.connected && (
        <NotConnectedState
          busy={busy}
          onStart={startOnboarding}
          platformFee={PLATFORM_FEE_PERCENT}
        />
      )}

      {!loading && status && status.connected && status.charges_enabled && (
        <ActiveState
          accountId={status.account_id!}
          payoutsEnabled={status.payouts_enabled}
          platformFee={PLATFORM_FEE_PERCENT}
          churchSlug={status.church_slug}
          onRefresh={refresh}
        />
      )}

      {!loading && status && status.connected && !status.charges_enabled && (
        <InProgressState
          currentlyDue={status.currently_due}
          disabledReason={status.disabled_reason}
          busy={busy}
          onResume={startOnboarding}
        />
      )}
    </section>
  );
}

function NotConnectedState({ busy, onStart, platformFee }: { busy: boolean; onStart: () => void; platformFee: number }) {
  return (
    <>
      <p className="text-sm text-gray-700 dark:text-dark-200">
        Connect a Stripe account to let your members give online. Donations go directly
        to your church account; Stripe handles payment processing.
      </p>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        <div className="font-medium mb-1">Platform fee: {platformFee}% per donation</div>
        <div className="text-amber-800">
          Plus standard Stripe processing fees (2.9% + 30¢). No setup cost, no minimums.
        </div>
      </div>
      <button
        onClick={onStart}
        disabled={busy}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        {busy ? 'Preparing…' : 'Connect Stripe'}
        <ExternalLink size={14} />
      </button>
      <p className="text-xs text-gray-500 dark:text-dark-400">
        You'll be redirected to Stripe to enter your church's business info, EIN, and bank
        account. Takes about 10 minutes.
      </p>
    </>
  );
}

function ActiveState({
  accountId,
  payoutsEnabled,
  platformFee,
  churchSlug,
  onRefresh,
}: {
  accountId: string;
  payoutsEnabled: boolean;
  platformFee: number;
  churchSlug: string | null;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const donateUrl = churchSlug && typeof window !== 'undefined'
    ? `${window.location.origin}/give/${churchSlug}`
    : null;

  const copyDonateUrl = async () => {
    if (!donateUrl) return;
    try {
      await navigator.clipboard.writeText(donateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail on insecure contexts — fall through silently;
      // the user can still select + copy the URL manually.
    }
  };

  return (
    <>
      <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-start gap-2">
        <Check size={16} className="text-green-700 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-green-800">
          <div className="font-medium">Online giving is active.</div>
          <div className="text-green-700">
            Account <span className="font-mono text-xs">{accountId}</span>
            {' · '}
            {payoutsEnabled ? 'Payouts enabled' : 'Payouts pending (Stripe verification)'}
          </div>
        </div>
      </div>

      {donateUrl && (
        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-2">
            Your church's public donate page
          </h3>
          <p className="text-xs text-gray-600 dark:text-dark-300 mb-3">
            Share this link in your bulletin, email signature, social posts, and on your website's
            "Give" button. Members can donate one-time or set up recurring gifts (weekly, monthly,
            or yearly) directly from this page.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-[200px] px-3 py-2 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-lg text-sm text-gray-800 dark:text-dark-100 break-all">
              {donateUrl}
            </code>
            <button
              onClick={copyDonateUrl}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 text-sm inline-flex items-center gap-2"
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <a
              href={donateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-dark-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-dark-600 text-sm inline-flex items-center gap-2"
            >
              Preview <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-700 dark:text-dark-200">
        VWS takes a <strong>{platformFee}%</strong> platform fee on each donation. Stripe takes
        their standard processing fee (2.9% + 30¢). The remainder goes to your account on Stripe's
        standard 2-day payout schedule.
      </div>
      <div className="flex gap-3">
        <a
          href={`https://dashboard.stripe.com/${accountId.startsWith('acct_test_') ? 'test/' : ''}connect/accounts/${accountId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-dark-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-dark-700 inline-flex items-center gap-2"
        >
          Open in Stripe <ExternalLink size={14} />
        </a>
        <button
          onClick={onRefresh}
          className="px-4 py-2 text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-dark-100"
        >
          Refresh status
        </button>
      </div>
    </>
  );
}

function InProgressState({
  currentlyDue,
  disabledReason,
  busy,
  onResume,
}: {
  currentlyDue: string[];
  disabledReason: string | null;
  busy: boolean;
  onResume: () => void;
}) {
  return (
    <>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
        <AlertCircle size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-900">
          <div className="font-medium">Stripe needs more information.</div>
          {disabledReason && (
            <div className="text-amber-800 mt-1">Reason: <code className="text-xs">{disabledReason}</code></div>
          )}
        </div>
      </div>
      {currentlyDue.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-2">Outstanding items</h3>
          <ul className="text-sm text-gray-700 dark:text-dark-200 list-disc list-inside space-y-1">
            {currentlyDue.slice(0, 10).map((item) => (
              <li key={item}><code className="text-xs">{item}</code></li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={onResume}
        disabled={busy}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        {busy ? 'Preparing…' : 'Resume onboarding'}
        <ExternalLink size={14} />
      </button>
    </>
  );
}
