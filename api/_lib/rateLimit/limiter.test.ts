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
