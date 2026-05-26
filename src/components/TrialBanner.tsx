/**
 * Top-of-page banner. Only shown when the church is in a state that
 * benefits from visible nagging:
 *   - Active trial with ≤7 days remaining
 *   - past_due / unpaid (urgent — service may be revoked)
 *
 * Dismissible per-day so we don't annoy users who saw the message.
 * past_due is NOT dismissible — they need to act.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useChurchPlan } from '../hooks/useChurchPlan';

const DISMISS_KEY = 'trial-banner-dismissed';

export function TrialBanner() {
  const { status, trialDaysRemaining, isPastDue, loading } = useChurchPlan();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem(DISMISS_KEY);
    setDismissed(saved === today);
  }, []);

  if (loading) return null;
  if (isPastDue) {
    return (
      <div className="px-4 py-2 bg-red-600 text-white text-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span className="truncate">
            <strong>Payment past due.</strong> Update your card to keep your church on GRACE.
          </span>
        </div>
        <a
          href="/#settings"
          className="flex-shrink-0 px-3 py-1 bg-white text-red-700 rounded font-medium hover:bg-red-50"
        >
          Fix it →
        </a>
      </div>
    );
  }

  if (dismissed) return null;
  if (status !== 'trial') return null;
  if (trialDaysRemaining === null || trialDaysRemaining > 7) return null;

  const handleDismiss = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(DISMISS_KEY, today);
    setDismissed(true);
  };

  const text = trialDaysRemaining === 0
    ? 'Your trial ends today. Add a payment method to keep your account active.'
    : trialDaysRemaining === 1
      ? '1 day left in your free trial — add a payment method to continue.'
      : `${trialDaysRemaining} days left in your free trial.`;

  return (
    <div className="px-4 py-2 bg-amber-100 text-amber-900 text-sm flex items-center justify-between gap-3 border-b border-amber-200">
      <div className="flex items-center gap-2 min-w-0">
        <Clock size={16} className="flex-shrink-0" />
        <span className="truncate">{text}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href="/#settings"
          className="px-3 py-1 bg-amber-700 text-white rounded font-medium hover:bg-amber-800"
        >
          Manage subscription →
        </a>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="p-1 hover:bg-amber-200 rounded"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
