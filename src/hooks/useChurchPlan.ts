/**
 * useChurchPlan — single source of truth for the current church's plan
 * status. Reads churches.subscription_plan + .subscription_status +
 * .trial_ends_at and exposes a typed shape + entitlement gates.
 *
 * The webhook handler keeps these fields in sync via Stripe events
 * (api/_lib/webhooks/stripe-handlers.ts:handleSaasSubscriptionLifecycle).
 *
 * Returns the safe defaults (starter, no gates, no trial) while
 * loading or for churches with no subscription row — fail closed.
 */

import { useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CLIENT_PLANS, planFor, type PlanSlug } from '../lib/plans';

export interface ChurchPlanState {
  loading: boolean;
  plan: ReturnType<typeof planFor>;
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | null;
  trialEndsAt: Date | null;
  trialDaysRemaining: number | null;
  isInTrial: boolean;
  isActive: boolean;
  isPastDue: boolean;
}

const FALLBACK: ChurchPlanState = {
  loading: true,
  plan: CLIENT_PLANS.starter,
  status: null,
  trialEndsAt: null,
  trialDaysRemaining: null,
  isInTrial: false,
  isActive: false,
  isPastDue: false,
};

export function useChurchPlan(): ChurchPlanState {
  const { churchId } = useAuthContext();
  const [state, setState] = useState<ChurchPlanState>(FALLBACK);

  useEffect(() => {
    if (!churchId || churchId === 'demo-church' || !supabase) {
      setState({ ...FALLBACK, loading: false });
      return;
    }

    let cancelled = false;
    const client = supabase;
    (async () => {
      const { data, error } = await client
        .from('churches')
        .select('subscription_plan, subscription_status, trial_ends_at')
        .eq('id', churchId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setState({ ...FALLBACK, loading: false });
        return;
      }

      const planSlug = (data.subscription_plan as PlanSlug | null) ?? 'starter';
      const status = data.subscription_status as ChurchPlanState['status'];
      const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
      const now = Date.now();
      const trialDaysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86_400_000))
        : null;

      setState({
        loading: false,
        plan: planFor(planSlug),
        status,
        trialEndsAt,
        trialDaysRemaining,
        isInTrial: status === 'trial',
        isActive: status === 'active' || status === 'trial',
        isPastDue: status === 'past_due',
      });
    })();

    return () => { cancelled = true; };
  }, [churchId]);

  return state;
}
