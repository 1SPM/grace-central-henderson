import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const requireClerkAuthMock = vi.fn();
vi.mock('../_lib/auth-helper.js', () => ({
  requireClerkAuth: requireClerkAuthMock,
}));

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown };
}

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    body: { to: 'member@example.com', subject: 'Hello', text: 'Hi there' },
    ...overrides,
  } as unknown as VercelRequest;
}

describe('POST /api/email/send', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    requireClerkAuthMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
  });

  it('rejects unauthenticated requests before ever calling Resend', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: false, status: 401, error: 'missing bearer token' });
    const { default: handler } = await import('./_send.js');
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a valid token that lacks a staff role', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const { default: handler } = await import('./_send.js');
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the email once an authenticated staff member is confirmed', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: true, churchId: 'church-1', role: 'admin', clerkUserId: 'u1', sessionId: 's1' });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'email_123' }) });
    const { default: handler } = await import('./_send.js');
    const res = mockRes();
    await handler(mockReq(), res);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, messageId: 'email_123' });
  });

  it('still rejects non-POST methods regardless of auth', async () => {
    const { default: handler } = await import('./_send.js');
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);

    expect(res.statusCode).toBe(405);
    expect(requireClerkAuthMock).not.toHaveBeenCalled();
  });
});
