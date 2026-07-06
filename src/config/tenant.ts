/**
 * Tenant configuration — single entry point for church identity.
 *
 * Adaptability step A (UX review 2026-07-06): components must never import a
 * church-specific config module (e.g. centralHenderson.ts) directly. They
 * import the active tenant from here instead, so onboarding a new church is
 * a matter of adding one entry to TENANTS and setting VITE_TENANT — not
 * editing 14+ call sites.
 *
 * Behavior today is unchanged: with no VITE_TENANT set, the active tenant is
 * Central Henderson, exactly as before.
 *
 * NOTE (regression guard): the June 2026 "Faithful" rebrand auto-selected a
 * tenant based on demo-mode being off and turned the Central demo navy
 * (reverted in da078e6). Tenant selection here is EXPLICIT ONLY — env var or
 * nothing. Never derive the tenant from an unrelated flag.
 */
import type { ChurchSettings } from '../hooks/useChurchSettings';
import {
  CENTRAL_HENDERSON_DEFAULT_SETTINGS,
  CENTRAL_HENDERSON_GRACE_FACTS,
  CENTRAL_HENDERSON_TIMEZONE,
  DEMO_ONBOARDING_SKIP,
  churchShortName,
} from './centralHenderson';

export interface TenantConfig {
  /** Stable key — also the valid value for VITE_TENANT. */
  id: string;
  defaultSettings: ChurchSettings;
  timezone: string;
  graceFacts: string;
  demoOnboardingSkip: typeof DEMO_ONBOARDING_SKIP;
}

const TENANTS: Record<string, TenantConfig> = {
  centralHenderson: {
    id: 'centralHenderson',
    defaultSettings: CENTRAL_HENDERSON_DEFAULT_SETTINGS,
    timezone: CENTRAL_HENDERSON_TIMEZONE,
    graceFacts: CENTRAL_HENDERSON_GRACE_FACTS,
    demoOnboardingSkip: DEMO_ONBOARDING_SKIP,
  },
};

const DEFAULT_TENANT_ID = 'centralHenderson';

/** Active tenant. Explicit VITE_TENANT wins; unknown values fall back to the default (with a console warning). */
export function getTenant(): TenantConfig {
  const requested = import.meta.env?.VITE_TENANT as string | undefined;
  if (requested && !TENANTS[requested]) {
    console.warn(`[tenant] Unknown VITE_TENANT "${requested}" — falling back to ${DEFAULT_TENANT_ID}`);
  }
  return TENANTS[requested && TENANTS[requested] ? requested : DEFAULT_TENANT_ID];
}

// Resolved once at module load — mirrors how the old constants behaved.
const ACTIVE = getTenant();

export const TENANT_DEFAULT_SETTINGS = ACTIVE.defaultSettings;
export const TENANT_TIMEZONE = ACTIVE.timezone;
export const TENANT_GRACE_FACTS = ACTIVE.graceFacts;
export const TENANT_DEMO_ONBOARDING_SKIP = ACTIVE.demoOnboardingSkip;

// Tenant-agnostic helper, re-exported so call sites need only this module.
export { churchShortName };
