/**
 * Settings → Billing section.
 *
 * - Shows current plan + price + status
 * - Trial countdown if in trial
 * - "Manage subscription" button → Stripe Billing Portal (POST
 *   /api/billing/portal-session, then redirect)
 * - Quick links to compare plans / contact sales for enterprise
 *
 * For tenants in 'past_due' or 'unpaid' status, surfaces a prominent
 * banner asking them to update payment. This is the highest-impact
 * place to surface that warning — it's the one settings page even
 * non-admin staff might land on while exploring.
 */

import { useState } from 'react';
import { CreditCard, AlertTriangle, ExternalLink } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useChurchPlan } from '../../hooks/useChurchPlan';
import { CLIENT_PLANS } from '../../lib/plans';

export function SettingsBilling() {
  const { plan, status, trialEndsAt, trialDaysRemaining, isInTrial, isPastDue, loading } = useChurchPlan();
  const { getAuthToken } = useAuthContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/billing/portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const body = await res.json();
      if (res.ok && body.portal_url) {
        window.location.assign(body.portal_url);
        return;
      }
      if (body.error === 'no_customer') {
        setError('You don\'t have a billing record yet. Pick a plan first.');
        return;
      }
      setError(body.detail || body.error || `Could not open billing portal (HTTP ${res.status})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6">
        <div className="text-sm text-gray-500">Loading plan…</div>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard size={18} className="text-gray-500" />
        <h2 className="font-semibold text-gray-900 dark:text-dark-100">Subscription</h2>
      </div>

      {isPastDue && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800">
            <strong>Payment past due.</strong> Update your payment method to keep your church on GRACE.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Current plan</div>
          <div className="text-xl font-medium text-gray-900 dark:text-dark-100">{plan.name}</div>
          <div className="text-sm text-gray-500">${plan.priceUsdMonthly}/mo</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</div>
          <div className="text-xl font-medium text-gray-900 dark:text-dark-100 capitalize">
            {status ? status.replace('_', ' ') : 'not subscribed'}
          </div>
          {isInTrial && trialDaysRemaining !== null && (
            <div className="text-sm text-amber-700">
              {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'} left in trial
            </div>
          )}
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Next renewal</div>
          <div className="text-xl font-medium text-gray-900 dark:text-dark-100">
            {trialEndsAt ? trialEndsAt.toLocaleDateString() : '—'}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-dark-600 pt-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-dark-200 mb-2">What's included on {plan.name}</h3>
        <ul className="text-sm text-gray-600 dark:text-dark-300 space-y-1">
          <li>· Up to {plan.limits.members === null ? 'unlimited' : plan.limits.members.toLocaleString()} members</li>
          <li>· {plan.limits.aiCallsPerMonth.toLocaleString()} AI calls per month</li>
          <li>· {plan.limits.storageGb} GB storage</li>
          {plan.gates.financialHub && <li>· Impact Campaigns reporting</li>}
          {plan.gates.serverAgents && <li>· Daily AI care agents</li>}
          {plan.gates.customDomain && <li>· Custom domain</li>}
          {plan.gates.cardProgram && <li>· Member card program</li>}
        </ul>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={openPortal}
          disabled={busy}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {busy ? 'Opening…' : 'Manage subscription'}
          <ExternalLink size={14} />
        </button>
        <a
          href="/pricing"
          className="px-4 py-2 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-dark-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-dark-700"
        >
          Compare plans
        </a>
        {plan.slug !== 'enterprise' && (
          <a
            href={`mailto:sales@grace-crm.app?subject=GRACE Enterprise interest&body=We're currently on ${plan.name} ($${plan.priceUsdMonthly}/mo). We'd like to talk about Enterprise.`}
            className="px-4 py-2 text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-dark-100"
          >
            Talk to sales →
          </a>
        )}
      </div>

      <div className="text-xs text-gray-500 dark:text-dark-400 pt-2 border-t border-gray-100 dark:border-dark-700">
        Payments are securely processed by Stripe. We never see or store your card number.
        Cancel anytime — your data stays accessible for 90 days after cancellation.
      </div>
    </section>
  );
}

export const KNOWN_PLAN_SLUGS = Object.keys(CLIENT_PLANS);
