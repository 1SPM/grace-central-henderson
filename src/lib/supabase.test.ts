import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clerkAwareFetch,
  setClerkTokenProvider,
  getClerkTokenProvider,
} from './supabase';

describe('clerkAwareFetch', () => {
  const originalFetch = global.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchSpy as unknown as typeof fetch;
    setClerkTokenProvider(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setClerkTokenProvider(null);
  });

  it('passes the request through untouched when no Clerk provider is registered', async () => {
    await clerkAwareFetch('https://x.supabase.co/rest/v1/people', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    // No Authorization header was injected
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('attaches Authorization: Bearer when the provider returns a token', async () => {
    setClerkTokenProvider(async () => 'clerk-jwt-token');
    await clerkAwareFetch('https://x.supabase.co/rest/v1/people', { method: 'GET' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer clerk-jwt-token');
  });

  it('falls back to default fetch when the provider returns null', async () => {
    setClerkTokenProvider(async () => null);
    await clerkAwareFetch('https://x.supabase.co/rest/v1/people');
    const [, init] = fetchSpy.mock.calls[0];
    // null token means no header override; original headers preserved
    expect(init?.headers).toBeUndefined();
  });

  it('falls back when the provider throws — request must still go out', async () => {
    setClerkTokenProvider(async () => { throw new Error('clerk down'); });
    const res = await clerkAwareFetch('https://x.supabase.co/rest/v1/people');
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('setClerkTokenProvider / getClerkTokenProvider round-trip', () => {
    expect(getClerkTokenProvider()).toBeNull();
    const p = async () => 'x';
    setClerkTokenProvider(p);
    expect(getClerkTokenProvider()).toBe(p);
    setClerkTokenProvider(null);
    expect(getClerkTokenProvider()).toBeNull();
  });
});
