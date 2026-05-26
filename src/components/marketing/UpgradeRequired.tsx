/**
 * UpgradeRequired — friendly upsell when a user lands on a feature
 * gated above their current plan. Surfaces:
 *   - what the feature is
 *   - what plan unlocks it
 *   - the price delta from current plan
 *   - one-click jump to the billing portal (existing customer) or
 *     pricing page (free trial / no card yet)
 *
 * Used by ViewRenderer when a 'pro+'-gated view is requested on a
 * Starter tenant.
 */

import { useChurchPlan } from '../../hooks/useChurchPlan';
import { CLIENT_PLANS, nextPlanUp, type PlanSlug } from '../../lib/plans';

interface UpgradeRequiredProps {
  featureName: string;
  requiredPlan: PlanSlug;
  description?: string;
  onBack?: () => void;
}

export function UpgradeRequired({ featureName, requiredPlan, description, onBack }: UpgradeRequiredProps) {
  const { plan: currentPlan, status, loading } = useChurchPlan();

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        Checking plan…
      </div>
    );
  }

  const required = CLIENT_PLANS[requiredPlan];
  const suggested = nextPlanUp(currentPlan.slug) ?? required;
  const priceDelta = suggested.priceUsdMonthly - currentPlan.priceUsdMonthly;
  const hasCustomer = status !== null;   // has gone through checkout before

  const handleUpgrade = async () => {
    if (hasCustomer) {
      // Existing customer: open billing portal
      try {
        const res = await fetch('/api/billing/portal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const body = await res.json();
        if (body.portal_url) {
          window.location.assign(body.portal_url);
          return;
        }
      } catch {
        // Fall through to pricing page
      }
    }
    window.location.assign(`/pricing`);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-2xl border border-amber-200 shadow-md p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-light text-gray-900 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>
          {featureName}
        </h2>
        <p className="text-sm text-gray-600 mb-1">
          Available on the <strong>{required.name}</strong> plan and above.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          You're currently on the <strong>{currentPlan.name}</strong> plan.
        </p>

        {description && (
          <p className="text-gray-700 mb-6 max-w-md mx-auto">{description}</p>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-w-md mx-auto text-left">
          <div className="flex justify-between items-baseline">
            <div>
              <div className="text-sm text-gray-600">Upgrade to {suggested.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                Pro-rated for the rest of the billing cycle
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-light text-gray-900">+${priceDelta}</div>
              <div className="text-xs text-gray-500">/month</div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleUpgrade}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700"
          >
            {hasCustomer ? 'Open billing portal' : 'See pricing'}
          </button>
        </div>
      </div>
    </div>
  );
}
