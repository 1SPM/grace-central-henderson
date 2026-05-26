/**
 * SaaS plan catalog. Source of truth for what we sell.
 *
 * Each plan maps to a Stripe Price ID via environment variables — the
 * actual Stripe Price objects are created out-of-band (Stripe Dashboard
 * or `stripe prices create` CLI). We keep slug + display data here.
 *
 * Environment vars expected (set in Vercel):
 *   STRIPE_PRICE_STARTER     = price_xxx (monthly $49)
 *   STRIPE_PRICE_PRO         = price_xxx (monthly $199)
 *   STRIPE_PRICE_ENTERPRISE  = price_xxx (monthly $499)
 *
 * In demo / dev (no Stripe price IDs set), getPriceId() returns null
 * and the checkout endpoint returns a structured 503 — never a stack
 * trace.
 */

export type PlanSlug = 'starter' | 'pro' | 'enterprise';

export interface PlanDefinition {
  slug: PlanSlug;
  name: string;
  /** Display price. The Stripe Price ID is the source of truth for billing. */
  priceUsdMonthly: number;
  /** What this plan unlocks. Strings are user-facing. */
  features: string[];
  /** Hard caps used for entitlement checks (rough; real enforcement is via PostHog flags + RLS). */
  limits: {
    members: number | null;     // null = unlimited
    aiCallsPerMonth: number;    // soft cap; gateway hard-cuts above
    storageGb: number;
  };
  /** Entitlement gates — used by feature flags + UI to enable/disable areas. */
  gates: {
    financialHub: boolean;
    serverAgents: boolean;
    customDomain: boolean;
    cardProgram: boolean;       // enterprise only; gates the i2c flow
  };
}

export const PLANS: Record<PlanSlug, PlanDefinition> = {
  starter: {
    slug: 'starter',
    name: 'Starter',
    priceUsdMonthly: 49,
    features: [
      'AI-powered church CRM',
      'Online giving via Stripe',
      'Up to 100 members',
      'Ask Grace assistant',
      'Email support',
    ],
    limits: { members: 100, aiCallsPerMonth: 1000, storageGb: 5 },
    gates: { financialHub: false, serverAgents: false, customDomain: false, cardProgram: false },
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    priceUsdMonthly: 199,
    features: [
      'Everything in Starter',
      'Up to 1,000 members',
      'Financial Hub dashboard',
      'Daily AI care agents (member care, stewardship, operations)',
      'Stripe Connect with platform fee',
      'Priority support (24-hr response)',
    ],
    limits: { members: 1_000, aiCallsPerMonth: 10_000, storageGb: 50 },
    gates: { financialHub: true, serverAgents: true, customDomain: false, cardProgram: false },
  },
  enterprise: {
    slug: 'enterprise',
    name: 'Enterprise',
    priceUsdMonthly: 499,
    features: [
      'Everything in Pro',
      'Unlimited members',
      'Custom domain (your.church)',
      'Member card program (i2c neobanking)',
      'White-label branding',
      'Dedicated success manager',
      'SOC 2 evidence on request',
    ],
    limits: { members: null, aiCallsPerMonth: 100_000, storageGb: 500 },
    gates: { financialHub: true, serverAgents: true, customDomain: true, cardProgram: true },
  },
};

export const PLAN_SLUGS: PlanSlug[] = ['starter', 'pro', 'enterprise'];

/**
 * Map plan slug to the Stripe Price ID from env. Returns null in
 * demo/dev mode so callers can render the "Stripe not configured" path
 * instead of crashing.
 */
export function getStripePriceId(slug: PlanSlug): string | null {
  const env = process.env[`STRIPE_PRICE_${slug.toUpperCase()}`];
  return env && env.startsWith('price_') ? env : null;
}

export function getPlanBySlug(slug: string): PlanDefinition | null {
  return PLAN_SLUGS.includes(slug as PlanSlug) ? PLANS[slug as PlanSlug] : null;
}

/**
 * Reverse lookup: given a Stripe Price ID from a webhook event, return
 * the matching plan slug. Used by the subscription webhook handler.
 */
export function planSlugForPriceId(priceId: string): PlanSlug | null {
  for (const slug of PLAN_SLUGS) {
    if (getStripePriceId(slug) === priceId) return slug;
  }
  return null;
}
