import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../_lib/grace-tts.js', () => ({
  MAX_TTS_TEXT_LEN: 1000,
  isTtsConfigured: () => true,
  synthesizeSpeech: async () => Buffer.from('audio'),
}));
const requireClerkAuthMock = vi.fn();
vi.mock('../_lib/auth-helper.js', () => ({ requireClerkAuth: requireClerkAuthMock }));
const isDemoModeActiveMock = vi.fn();
vi.mock('../_lib/authz.js', () => ({ isDemoModeActive: isDemoModeActiveMock }));
vi.mock('../_lib/rateLimit/limiter.js', () => ({
  clientIp: () => '1.2.3.4',
  enforceRateLimit: async () => false, // not rate-limited
}));

function mockRes() {
  const res = { statusCode: 0, body: undefined as unknown, ended: false,
    setHeader() {}, status(c: number) { this.statusCode = c; return this; },
    json(p: unknown) { this.body = p; return this; }, end() { this.ended = true; return this; } };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown; ended: boolean };
}
function mockReq(headers: Record<string, string>): VercelRequest {
  return { method: 'POST', headers, body: { text: 'hello grace' } } as unknown as VercelRequest;
}

describe('grace/tts auth gate', () => {
  beforeEach(() => { requireClerkAuthMock.mockReset(); isDemoModeActiveMock.mockReset(); });

  it('401s an anonymous non-demo caller (no token)', async () => {
    isDemoModeActiveMock.mockReturnValue(false);
    const { default: handler } = await import('./_tts.js');
    const res = mockRes();
    await handler(mockReq({}), res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: 'auth_required' });
  });

  it('allows the anonymous public demo (no token, demo mode)', async () => {
    isDemoModeActiveMock.mockReturnValue(true);
    const { default: handler } = await import('./_tts.js');
    const res = mockRes();
    await handler(mockReq({}), res);
    expect(res.statusCode).toBe(200);
    expect(res.ended).toBe(true);        // audio streamed
    expect(requireClerkAuthMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid bearer token', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: false, status: 401, error: 'invalid token' });
    const { default: handler } = await import('./_tts.js');
    const res = mockRes();
    await handler(mockReq({ authorization: 'Bearer bad' }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: 'invalid token' });
  });

  it('allows a valid signed-in user', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: true, clerkUserId: 'u1', churchId: 'c1' });
    const { default: handler } = await import('./_tts.js');
    const res = mockRes();
    await handler(mockReq({ authorization: 'Bearer good' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.ended).toBe(true);
  });
});
