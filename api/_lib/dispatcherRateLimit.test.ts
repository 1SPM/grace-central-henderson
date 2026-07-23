import { describe, it, expect } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { checkDispatcherRateLimit } from './dispatcherRateLimit.js';

function makeReq(ip: string): VercelRequest {
  return { headers: { 'x-forwarded-for': ip } } as unknown as VercelRequest;
}

describe('checkDispatcherRateLimit', () => {
  it('allows requests under the limit', () => {
    const req = makeReq('1.2.3.4');
    for (let i = 0; i < 5; i++) {
      expect(checkDispatcherRateLimit(req, 'test-route-a', 5).limited).toBe(false);
    }
  });

  it('blocks once the limit is exceeded within the window, with a Retry-After hint', () => {
    const req = makeReq('5.6.7.8');
    for (let i = 0; i < 3; i++) {
      expect(checkDispatcherRateLimit(req, 'test-route-b', 3).limited).toBe(false);
    }
    const result = checkDispatcherRateLimit(req, 'test-route-b', 3);
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('scopes limits per route — hitting the cap on one route does not affect another', () => {
    const req = makeReq('9.9.9.9');
    for (let i = 0; i < 3; i++) {
      checkDispatcherRateLimit(req, 'route-x', 3);
    }
    expect(checkDispatcherRateLimit(req, 'route-x', 3).limited).toBe(true);
    expect(checkDispatcherRateLimit(req, 'route-y', 3).limited).toBe(false);
  });

  it('scopes limits per client IP — one caller hitting the cap does not affect another', () => {
    const reqA = makeReq('10.0.0.1');
    const reqB = makeReq('10.0.0.2');
    for (let i = 0; i < 3; i++) {
      checkDispatcherRateLimit(reqA, 'shared-route', 3);
    }
    expect(checkDispatcherRateLimit(reqA, 'shared-route', 3).limited).toBe(true);
    expect(checkDispatcherRateLimit(reqB, 'shared-route', 3).limited).toBe(false);
  });

  it('falls back to "unknown" without throwing when there is no x-forwarded-for header', () => {
    const req = { headers: {} } as unknown as VercelRequest;
    expect(() => checkDispatcherRateLimit(req, 'no-ip-route', 5)).not.toThrow();
  });
});
