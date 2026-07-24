import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest } from '@vercel/node';

// Import fresh per-test so the module reads env at load time for the
// Upstash-configured cases.
async function loadLimiter() {
  return import('./limiter.js');
}

describe('rateLimit — in-memory fallback (no Upstash env)', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
  });

  it('allows up to max, then limits with a Retry-After', async () => {
    const { rateLimit } = await loadLimiter();
    const key = `mem-${Math.random()}`;
    expect((await rateLimit(key, 2, 60)).limited).toBe(false); // 1
    expect((await rateLimit(key, 2, 60)).limited).toBe(false); // 2
    const third = await rateLimit(key, 2, 60);                 // 3 → over
    expect(third.limited).toBe(true);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    expect(third.backend).toBe('memory');
  });

  it('reports remaining and uses separate buckets per key', async () => {
    const { rateLimit } = await loadLimiter();
    const a = await rateLimit(`A-${Math.random()}`, 5, 60);
    expect(a.remaining).toBe(4);
    const b = await rateLimit(`B-${Math.random()}`, 5, 60);
    expect(b.limited).toBe(false);
  });

  it('isDurableRateLimitConfigured() is false without env', async () => {
    const { isDurableRateLimitConfigured } = await loadLimiter();
    expect(isDurableRateLimitConfigured()).toBe(false);
  });
});

describe('rateLimit — Upstash path', () => {
  const OLD_FETCH = globalThis.fetch;
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    vi.resetModules();
  });
  afterEach(() => {
    globalThis.fetch = OLD_FETCH;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('parses the pipeline result: count <= max → allowed', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify([{ result: 'OK' }, { result: 1 }, { result: 60 }]),
      { status: 200 },
    )) as unknown as typeof fetch;
    const { rateLimit } = await loadLimiter();
    const r = await rateLimit('u:1', 5, 60);
    expect(r.backend).toBe('upstash');
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(4);
  });

  it('count > max → limited with Retry-After from TTL', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify([{ result: null }, { result: 6 }, { result: 42 }]),
      { status: 200 },
    )) as unknown as typeof fetch;
    const { rateLimit } = await loadLimiter();
    const r = await rateLimit('u:1', 5, 60);
    expect(r.limited).toBe(true);
    expect(r.retryAfterSeconds).toBe(42);
    expect(r.remaining).toBe(0);
  });

  it('falls back to memory (does not throw / fail the request) when Upstash errors', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    const { rateLimit } = await loadLimiter();
    const r = await rateLimit(`fallback-${Math.random()}`, 3, 60);
    expect(r.limited).toBe(false);      // request still served
    expect(r.backend).toBe('memory');   // via the fallback
  });

  it('falls back to memory on a non-200 Upstash response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const { rateLimit } = await loadLimiter();
    const r = await rateLimit(`fallback5xx-${Math.random()}`, 3, 60);
    expect(r.backend).toBe('memory');
  });
});

describe('enforceRateLimit', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
  });
  function mockRes() {
    const res = { statusCode: 0, headers: {} as Record<string, string>, body: undefined as unknown,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      status(c: number) { this.statusCode = c; return this; },
      json(p: unknown) { this.body = p; return this; } };
    return res;
  }
  it('returns false and sends nothing while under the limit', async () => {
    const { enforceRateLimit } = await loadLimiter();
    const res = mockRes();
    const limited = await enforceRateLimit(res as never, `enf-${Math.random()}`, 2, 60);
    expect(limited).toBe(false);
    expect(res.statusCode).toBe(0);
  });
  it('returns true and sends a 429 + Retry-After once over the limit', async () => {
    const { enforceRateLimit } = await loadLimiter();
    const key = `enf-over-${Math.random()}`;
    const res = mockRes();
    await enforceRateLimit(res as never, key, 1, 60); // 1 ok
    const limited = await enforceRateLimit(res as never, key, 1, 60); // 2 → over
    expect(limited).toBe(true);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeDefined();
    expect((res.body as { error: string }).error).toBe('rate_limited');
  });
});

describe('clientIp', () => {
  it('prefers x-real-ip; ignores spoofable leftmost XFF', async () => {
    const { clientIp } = await loadLimiter();
    const req = { headers: { 'x-real-ip': '203.0.113.7', 'x-forwarded-for': 'spoof, 203.0.113.7' } } as unknown as VercelRequest;
    expect(clientIp(req)).toBe('203.0.113.7');
  });
  it('falls back to rightmost XFF when x-real-ip absent', async () => {
    const { clientIp } = await loadLimiter();
    const req = { headers: { 'x-forwarded-for': 'spoof, 198.51.100.9' } } as unknown as VercelRequest;
    expect(clientIp(req)).toBe('198.51.100.9');
  });
  it('returns "unknown" with no IP headers', async () => {
    const { clientIp } = await loadLimiter();
    expect(clientIp({ headers: {} } as unknown as VercelRequest)).toBe('unknown');
  });
});
