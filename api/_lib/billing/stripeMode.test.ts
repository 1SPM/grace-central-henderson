/**
 * #4 — test/live Stripe credential-mixing guard.
 */

import { describe, it, expect } from 'vitest';
import { stripeKeyMode, checkStripeEnvSafety } from './stripeMode.js';

describe('stripeKeyMode', () => {
  it('classifies live / test / restricted / unknown', () => {
    expect(stripeKeyMode('sk_live_abc')).toBe('live');
    expect(stripeKeyMode('rk_live_abc')).toBe('live');
    expect(stripeKeyMode('sk_test_abc')).toBe('test');
    expect(stripeKeyMode('rk_test_abc')).toBe('test');
    expect(stripeKeyMode('whsec_abc')).toBe('unknown');
    expect(stripeKeyMode(undefined)).toBe('unknown');
    expect(stripeKeyMode('')).toBe('unknown');
  });
});

describe('checkStripeEnvSafety', () => {
  it('FATAL: live key in a non-production deploy (preview / development)', () => {
    for (const env of ['preview', 'development', undefined, null]) {
      const r = checkStripeEnvSafety({ secretKey: 'sk_live_x', vercelEnv: env });
      expect(r.ok).toBe(false);
      expect(r.mode).toBe('live');
      expect(r.reason).toMatch(/live Stripe key/i);
    }
  });

  it('OK: live key in production', () => {
    const r = checkStripeEnvSafety({ secretKey: 'sk_live_x', vercelEnv: 'production' });
    expect(r.ok).toBe(true);
    expect(r.warning).toBeUndefined();
  });

  it('OK+warning: test key in production (not actually billing)', () => {
    const r = checkStripeEnvSafety({ secretKey: 'sk_test_x', vercelEnv: 'production' });
    expect(r.ok).toBe(true);
    expect(r.warning).toMatch(/no real charges/i);
  });

  it('OK: test key in preview/dev (the normal case)', () => {
    expect(checkStripeEnvSafety({ secretKey: 'sk_test_x', vercelEnv: 'preview' }).ok).toBe(true);
    expect(checkStripeEnvSafety({ secretKey: 'sk_test_x', vercelEnv: 'development' }).warning).toBeUndefined();
  });

  it('OK+warning: unrecognized key prefix', () => {
    const r = checkStripeEnvSafety({ secretKey: 'weird_key', vercelEnv: 'production' });
    expect(r.ok).toBe(true);
    expect(r.warning).toMatch(/unrecognized prefix/i);
  });

  it('OK: no key set (handled by the caller\'s not-configured 503)', () => {
    const r = checkStripeEnvSafety({ secretKey: undefined, vercelEnv: 'production' });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('unknown');
  });
});
