import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatPhoneNumber, isValidPhone, sendSms } from './send.js';

describe('isValidPhone', () => {
  it('accepts a 10-digit US number', () => {
    expect(isValidPhone('5551234567')).toBe(true);
  });

  it('rejects a too-short number', () => {
    expect(isValidPhone('123')).toBe(false);
  });
});

describe('formatPhoneNumber', () => {
  it('adds +1 to a bare 10-digit number', () => {
    expect(formatPhoneNumber('5551234567')).toBe('+15551234567');
  });

  it('adds + to an 11-digit number already starting with 1', () => {
    expect(formatPhoneNumber('15551234567')).toBe('+15551234567');
  });

  it('leaves an already-E.164 number unchanged', () => {
    expect(formatPhoneNumber('+15551234567')).toBe('+15551234567');
  });
});

describe('sendSms (not configured)', () => {
  const original = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER,
  };
  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });
  afterEach(() => {
    if (original.sid) process.env.TWILIO_ACCOUNT_SID = original.sid;
    if (original.token) process.env.TWILIO_AUTH_TOKEN = original.token;
    if (original.from) process.env.TWILIO_FROM_NUMBER = original.from;
  });

  it('skips with reason=not_configured when Twilio env vars are absent', async () => {
    const result = await sendSms({ to: '5551234567', message: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok && result.skipped) {
      expect(result.reason).toBe('not_configured');
    }
  });
});

describe('sendSms (configured)', () => {
  const original = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER,
  };
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_FROM_NUMBER = '+15559999999';
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    if (original.sid) process.env.TWILIO_ACCOUNT_SID = original.sid; else delete process.env.TWILIO_ACCOUNT_SID;
    if (original.token) process.env.TWILIO_AUTH_TOKEN = original.token; else delete process.env.TWILIO_AUTH_TOKEN;
    if (original.from) process.env.TWILIO_FROM_NUMBER = original.from; else delete process.env.TWILIO_FROM_NUMBER;
    vi.unstubAllGlobals();
  });

  it('skips with reason=invalid_phone for a malformed number', async () => {
    const result = await sendSms({ to: '123', message: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok && result.skipped) {
      expect(result.reason).toBe('invalid_phone');
    }
  });

  it('returns ok with message_id on 200/201 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ sid: 'SM_xxx', status: 'queued' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    const result = await sendSms({ to: '5551234567', message: 'hi' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message_id).toBe('SM_xxx');
      expect(result.status).toBe('queued');
    }
  });

  it('returns failure on non-2xx with error message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'invalid from number' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }));
    const result = await sendSms({ to: '5551234567', message: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok && !result.skipped) {
      expect(result.status).toBe(400);
      expect(result.error).toBe('invalid from number');
    }
  });

  it('returns failure on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await sendSms({ to: '5551234567', message: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok && !result.skipped) {
      expect(result.error).toMatch(/ECONNREFUSED/);
    }
  });
});
