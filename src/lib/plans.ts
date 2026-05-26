/**
 * Plan catalog mirror for the client. Same shape as
 * api/_lib/billing/plans.ts — kept in sync by hand for now. If we
 * grow more plans, generate this from a single TS source.
 *
 * Gates here drive UI visibility (hide Pro features from Starter).
 * Server endpoints ALSO enforce the same gates — never trust the
 * client to honor an entitlement.
 */

export type PlanSlug = 'starter' | 'pro' | 'enterprise';

export interface PlanGate {
  financialHub: boolean;
  serverAgents: boolean;
  customDomain: boolean;
  cardProgram: boolean;
}

export interface PlanLimits {
  members: number | null;
  aiCallsPerMonth: number;
  storageGb: number;
}

export interface ClientPlanDefinition {
  slug: PlanSlug;
  name: string;
  priceUsdMonthly: number;
  gates: PlanGate;
  limits: PlanLimits;
}

export const CLIENT_PLANS: Record<PlanSlug, ClientPlanDefinition> = {
  starter: {
    slug: 'starter',
    name: 'Starter',
    priceUsdMonthly: 49,
    gates: { financialHub: false, serverAgents: false, customDomain: false, cardProgram: false },
    limits: { members: 100, aiCallsPerMonth: 1000, storageGb: 5 },
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    priceUsdMonthly: 199,
    gates: { financialHub: true, serverAgents: true, customDomain: false, cardProgram: false },
    limits: { members: 1_000, aiCallsPerMonth: 10_000, storageGb: 50 },
  },
  enterprise: {
    slug: 'enterprise',
    name: 'Enterprise',
    priceUsdMonthly: 499,
    gates: { financialHub: true, serverAgents: true, customDomain: true, cardProgram: true },
    limits: { members: null, aiCallsPerMonth: 100_000, storageGb: 500 },
  },
};

export const PLAN_RANK: Record<PlanSlug, number> = {
  starter: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Returns true if the given plan slug includes the given gate.
 * Unknown plan = no gates (most restrictive — fail closed).
 */
export function hasGate(plan: PlanSlug | string | null | undefined, gate: keyof PlanGate): boolean {
  if (!plan) return false;
  const def = CLIENT_PLANS[plan as PlanSlug];
  if (!def) return false;
  return def.gates[gate];
}

/** Get plan definition by slug, with safe fallback to starter. */
export function planFor(slug: PlanSlug | string | null | undefined): ClientPlanDefinition {
  if (slug && slug in CLIENT_PLANS) {
    return CLIENT_PLANS[slug as PlanSlug];
  }
  return CLIENT_PLANS.starter;
}

/**
 * Returns the next plan up from the given one (for "upgrade to unlock"
 * UX), or null if at the top.
 */
export function nextPlanUp(slug: PlanSlug | string | null | undefined): ClientPlanDefinition | null {
  if (!slug || !(slug in CLIENT_PLANS)) return CLIENT_PLANS.pro;  // unknown → suggest Pro
  const rank = PLAN_RANK[slug as PlanSlug];
  if (rank >= 2) return null;
  const nextSlug = rank === 0 ? 'pro' : 'enterprise';
  return CLIENT_PLANS[nextSlug];
}
