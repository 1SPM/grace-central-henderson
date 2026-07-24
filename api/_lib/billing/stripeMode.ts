/**
 * Test/live Stripe credential-mixing guard.
 *
 * The only server-side Stripe value that encodes its mode is the secret
 * key (`sk_test_…` / `sk_live_…`); the webhook secret (`whsec_…`) and price
 * IDs (`price_…`) don't. So the meaningful cross-check is the secret key
 * against the DEPLOY environment (Vercel's VERCEL_ENV):
 *
 *   - a LIVE key in a non-production deploy (preview/development) → FATAL:
 *     a preview build must never be able to create real charges.
 *   - a TEST key in production → warning: you aren't actually billing.
 *
 * Pure + exported for tests; callers decide whether to 503 on `!ok`.
 */

export type StripeMode = 'test' | 'live' | 'unknown';

export function stripeKeyMode(key: string | undefined | null): StripeMode {
  if (!key) return 'unknown';
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  return 'unknown';
}

export interface StripeEnvCheck {
  /** false = fatal misconfiguration; the caller must refuse to run. */
  ok: boolean;
  mode: StripeMode;
  reason?: string;    // present when !ok
  warning?: string;   // present when ok but noteworthy
}

export function checkStripeEnvSafety(opts: {
  secretKey?: string | null;
  vercelEnv?: string | null;
}): StripeEnvCheck {
  const mode = stripeKeyMode(opts.secretKey);
  const env = opts.vercelEnv ?? 'development';

  if (mode === 'live' && env !== 'production') {
    return {
      ok: false,
      mode,
      reason: `live Stripe key detected in non-production environment "${env}" — refusing to avoid real charges from a non-prod deploy`,
    };
  }
  if (mode === 'test' && env === 'production') {
    return { ok: true, mode, warning: 'test Stripe key in production — no real charges will be made' };
  }
  if (mode === 'unknown' && opts.secretKey) {
    return { ok: true, mode, warning: 'STRIPE_SECRET_KEY has an unrecognized prefix (expected sk_test_/sk_live_)' };
  }
  return { ok: true, mode };
}
