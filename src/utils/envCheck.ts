/**
 * Environment Variable Validation
 *
 * Runs at app startup to surface missing configuration early
 * instead of failing silently at runtime.
 */

import { createLogger } from './logger';

const log = createLogger('env-check');

interface EnvCheckResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function checkEnvironment(): EnvCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required for any data persistence
  if (!import.meta.env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');

  // Required for production auth
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    if (import.meta.env.PROD) {
      missing.push('VITE_CLERK_PUBLISHABLE_KEY (required in production)');
    } else {
      warnings.push('VITE_CLERK_PUBLISHABLE_KEY not set - running in demo mode');
    }
  }

  // Optional but important
  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    warnings.push('VITE_STRIPE_PUBLISHABLE_KEY not set - online giving disabled');
  }

  // Demo mode note: whether the auth bypass is actually active no longer
  // depends on this raw flag in production — see isDemoModeActive in
  // config/tenant.ts, which derives it from the resolved tenant (hostname)
  // instead. This is left set only as a reminder that the var is now
  // inert in production and can be removed from Vercel entirely.
  if (import.meta.env.VITE_ENABLE_DEMO_MODE === 'true' && import.meta.env.PROD) {
    warnings.push('VITE_ENABLE_DEMO_MODE is set but no longer controls demo-mode auth in production (see isDemoModeActive in config/tenant.ts) - safe to remove from Vercel');
  }

  // Log results
  if (missing.length > 0) {
    log.error('Missing required environment variables', missing);
  }
  for (const w of warnings) {
    log.warn(w);
  }
  if (missing.length === 0 && warnings.length === 0) {
    log.info('All environment variables configured');
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  };
}
