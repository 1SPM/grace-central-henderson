import { describe, it, expect, vi, afterEach } from 'vitest';
import { requireCronAuth } from './cronAuth.js';

function makeReq(headers: Record<string, string> = {}) {
  return { headers } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('requireCronAuth', () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original) process.env.CRON_SECRET = original;
    else delete process.env.CRON_SECRET;
  });

  it('503s with cron_secret_not_configured when CRON_SECRET is unset — never fails open', () => {
    delete process.env.CRON_SECRET;
    const res = makeRes();
    const result = requireCronAuth(makeReq(), res);
    expect(result).toBe(503);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'cron_secret_not_configured' });
  });

  it('401s when no Authorization header is present', () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = makeRes();
    const result = requireCronAuth(makeReq(), res);
    expect(result).toBe(401);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('401s a spoofed x-vercel-cron header with no bearer token — the header is never trusted', () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = makeRes();
    const result = requireCronAuth(makeReq({ 'x-vercel-cron': '1' }), res);
    expect(result).toBe(401);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('401s on a wrong bearer token', () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = makeRes();
    const result = requireCronAuth(makeReq({ authorization: 'Bearer wrong-secret' }), res);
    expect(result).toBe(401);
  });

  it('authorizes on the correct bearer token — returns null, writes no response', () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = makeRes();
    const result = requireCronAuth(makeReq({ authorization: 'Bearer test-secret' }), res);
    expect(result).toBeNull();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('authorizes the correct bearer token even alongside a spoofed x-vercel-cron header', () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = makeRes();
    const result = requireCronAuth(makeReq({ authorization: 'Bearer test-secret', 'x-vercel-cron': '1' }), res);
    expect(result).toBeNull();
  });
});
