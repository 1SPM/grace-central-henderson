import { describe, it, expect } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { checkDispatcherRateLimit } from './dispatcherRateLimit.js';

function makeReq(ip: string): VercelRequest {
  return { headers: { 'x-real-ip': ip } } as unknown as VercelRequest;
}

// No UPSTASH_* env in tests → the shared limiter uses its in-memory fallback,
// so these assert the same behaviour the dispatcher relies on when Upstash
// isn't provisioned.
describe('checkDispatcherRateLimit', () => {
  it('allows requests under the limit', async () => {
    const req = makeReq('1.2.3.4');
    for (let i = 0; i < 5; i++) {
      expect((await checkDispatcherRateLimit(req, 'test-route-a', 5)).limited).toBe(false);
    }
  });

  it('blocks once the limit is exceeded within the window, with a Retry-After hint', async () => {
    const req = makeReq('5.6.7.8');
    for (let i = 0; i < 3; i++) {
      expect((await checkDispatcherRateLimit(req, 'test-route-b', 3)).limited).toBe(false);
    }
    const result = await checkDispatcherRateLimit(req, 'test-route-b', 3);
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('scopes limits per route — hitting the cap on one route does not affect another', async () => {
    const req = makeReq('9.9.9.9');
    for (let i = 0; i < 3; i++) {
      await checkDispatcherRateLimit(req, 'route-x', 3);
    }
    expect((await checkDispatcherRateLimit(req, 'route-x', 3)).limited).toBe(true);
    expect((await checkDispatcherRateLimit(req, 'route-y', 3)).limited).toBe(false);
  });

  it('scopes limits per client IP — one caller hitting the cap does not affect another', async () => {
    const reqA = makeReq('10.0.0.1');
    const reqB = makeReq('10.0.0.2');
    for (let i = 0; i < 3; i++) {
      await checkDispatcherRateLimit(reqA, 'shared-route', 3);
    }
    expect((await checkDispatcherRateLimit(reqA, 'shared-route', 3)).limited).toBe(true);
    expect((await checkDispatcherRateLimit(reqB, 'shared-route', 3)).limited).toBe(false);
  });

  it('falls back to "unknown" without throwing when there is no IP header at all', async () => {
    const req = { headers: {} } as unknown as VercelRequest;
    await expect(checkDispatcherRateLimit(req, 'no-ip-route', 5)).resolves.toBeDefined();
  });

  it('keys on x-real-ip and ignores a spoofed leftmost x-forwarded-for value', async () => {
    const mk = (spoofedXff: string) =>
      ({ headers: { 'x-real-ip': '203.0.113.7', 'x-forwarded-for': `${spoofedXff}, 203.0.113.7` } }) as unknown as VercelRequest;
    for (let i = 0; i < 3; i++) {
      await checkDispatcherRateLimit(mk(`spoof-${i}`), 'spoof-route', 3);
    }
    expect((await checkDispatcherRateLimit(mk('spoof-brand-new'), 'spoof-route', 3)).limited).toBe(true);
  });

  it('falls back to the rightmost (trusted-proxy-added) x-forwarded-for entry when x-real-ip is absent', async () => {
    const mk = (spoofedLeftmost: string) =>
      ({ headers: { 'x-forwarded-for': `${spoofedLeftmost}, 198.51.100.9` } }) as unknown as VercelRequest;
    for (let i = 0; i < 3; i++) {
      await checkDispatcherRateLimit(mk(`x-${i}`), 'xff-fallback-route', 3);
    }
    expect((await checkDispatcherRateLimit(mk('x-new'), 'xff-fallback-route', 3)).limited).toBe(true);
  });
});
