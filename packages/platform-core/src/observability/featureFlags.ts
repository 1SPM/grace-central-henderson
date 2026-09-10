/**
 * Feature flags — typed registry.
 *
 * Add new flags here so the call sites are searchable and the names
 * cannot drift. Flags are evaluated by PostHog at runtime via
 * `isFeatureEnabled` / `getFeatureFlag`.
 */

import { isFeatureEnabled, getFeatureFlag } from './posthog';

export const FLAGS = {
  /** Disables all writes app-wide. Used as a kill switch during incidents. */
  READ_ONLY_MODE: 'read-only-mode',
  /** Legacy financial feature flag retained for compatibility with older telemetry. */
  FINANCIAL_HUB: 'financial-hub',
  /** Switches the interchange data source from mock to real i2c (Sprint 6). */
  I2C_LIVE: 'i2c-live',
} as const;

export type FeatureFlag = (typeof FLAGS)[keyof typeof FLAGS];

export function flagEnabled(flag: FeatureFlag): boolean {
  return isFeatureEnabled(flag);
}

export function flagValue(flag: FeatureFlag): string | boolean | undefined {
  return getFeatureFlag(flag);
}
