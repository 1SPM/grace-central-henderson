/**
 * Server-side plan-gate enforcement.
 *
 * The client also enforces these via src/lib/plans.ts hasGate(), but
 * the client is untrusted. Every endpoint that exposes a gated feature
 * must call requirePlanGate() before doing work.
 *
 * Resolves the church's current plan from churches.subscription_plan
 * (kept in sync by the Stripe webhook handler).
 *
 * Returns a discriminated union — same pattern as requireClerkAuth.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PLANS, type PlanSlug } from './plans';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type GateKey = keyof typeof PLANS.starter.gates;

export interface GateOk {
  ok: true;
  plan: PlanSlug;
  status: string | null;
}

export interface GateFail {
  ok: false;
  status: 402 | 403 | 503;
  error: 'plan_required' | 'subscription_inactive' | 'service_not_configured';
  detail: string;
  required_gate: GateKey;
  required_plan: PlanSlug;
  current_plan: PlanSlug | null;
  current_status: string | null;
}

export type GateResult = GateOk | GateFail;

/**
 * Check whether the given church's current plan includes a gate. Use
 * this BEFORE doing the work the endpoint exposes.
 *
 * Returns 402 (Payment Required) when the church is on a plan that
 * doesn't include the gate — clear signal to the client to surface
 * the upgrade flow.
 *
 * Returns 403 when the church's subscription is canceled / unpaid —
 * different remediation (re-subscribe vs upgrade).
 */
export async function requirePlanGate(
  churchId: string,
  gate: GateKey,
  supabaseClient?: SupabaseClient,
): Promise<GateResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      ok: false,
      status: 503,
      error: 'service_not_configured',
      detail: 'Supabase service-role key not set; cannot evaluate plan gates.',
      required_gate: gate,
      required_plan: 'pro',
      current_plan: null,
      current_status: null,
    };
  }

  const supabase = supabaseClient ?? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase
    .from('churches')
    .select('subscription_plan, subscription_status')
    .eq('id', churchId)
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 402,
      error: 'plan_required',
      detail: 'Could not resolve church plan; treating as no entitlement.',
      required_gate: gate,
      required_plan: firstPlanWithGate(gate),
      current_plan: null,
      current_status: null,
    };
  }

  const currentPlan = (data.subscription_plan as PlanSlug | null) ?? null;
  const currentStatus = data.subscription_status as string | null;

  // Inactive subscriptions are 403, not 402 — different UX.
  // 'trial' and 'active' are the only states that earn entitlements.
  if (currentStatus !== 'trial' && currentStatus !== 'active') {
    return {
      ok: false,
      status: 403,
      error: 'subscription_inactive',
      detail: `Subscription status is "${currentStatus ?? 'none'}" — payment required.`,
      required_gate: gate,
      required_plan: firstPlanWithGate(gate),
      current_plan: currentPlan,
      current_status: currentStatus,
    };
  }

  if (!currentPlan || !PLANS[currentPlan]?.gates[gate]) {
    return {
      ok: false,
      status: 402,
      error: 'plan_required',
      detail: `Feature requires a plan that includes ${gate}.`,
      required_gate: gate,
      required_plan: firstPlanWithGate(gate),
      current_plan: currentPlan,
      current_status: currentStatus,
    };
  }

  return { ok: true, plan: currentPlan, status: currentStatus };
}

/** Lowest-tier plan that includes a given gate. Used to tell client what to upgrade to. */
function firstPlanWithGate(gate: GateKey): PlanSlug {
  const order: PlanSlug[] = ['starter', 'pro', 'enterprise'];
  for (const slug of order) {
    if (PLANS[slug].gates[gate]) return slug;
  }
  return 'enterprise';
}
