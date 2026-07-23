import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const requireClerkAuthMock = vi.fn();
vi.mock('../_lib/auth-helper.js', () => ({
  requireClerkAuth: requireClerkAuthMock,
}));

const sendSmsMock = vi.fn();
vi.mock('../_lib/sms/send.js', () => ({
  sendSms: sendSmsMock,
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
  return { method: 'POST', headers: {}, body: { to: '+15551234567', message: 'hi' }, ...overrides } as unknown as VercelRequest;
}

describe('POST /api/sms/send', () => {
  beforeEach(() => {
    requireClerkAuthMock.mockReset();
    sendSmsMock.mockReset();
  });

  it('rejects unauthenticated requests before ever touching Twilio', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: false, status: 401, error: 'missing bearer token' });
    const { default: handler } = await import('./_send.js');
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(401);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it('rejects a valid token that lacks a staff role', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const { default: handler } = await import('./_send.js');
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(403);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it('sends the SMS once an authenticated staff member is confirmed', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: true, churchId: 'church-1', role: 'pastor', clerkUserId: 'u1', sessionId: 's1' });
    sendSmsMock.mockResolvedValue({ ok: true, message_id: 'sm_123', status: 'queued' });
    const { default: handler } = await import('./_send.js');
    const res = mockRes();
    await handler(mockReq(), res);

    expect(sendSmsMock).toHaveBeenCalledWith({ to: '+15551234567', message: 'hi' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, messageId: 'sm_123' });
  });

  it('still rejects non-POST methods regardless of auth', async () => {
    const { default: handler } = await import('./_send.js');
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);

    expect(res.statusCode).toBe(405);
    expect(requireClerkAuthMock).not.toHaveBeenCalled();
  });
});
