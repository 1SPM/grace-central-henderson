import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../api/giving/text-to-give';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  send: (payload: unknown) => MockResponse;
  setHeader: (name: string, value: string) => MockResponse;
}

function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status: (code: number) => {
      response.statusCode = code;
      return response;
    },
    json: (payload: unknown) => {
      response.body = payload;
      return response;
    },
    send: (payload: unknown) => {
      response.body = payload;
      return response;
    },
    setHeader: (name: string, value: string) => {
      response.headers[name] = value;
      return response;
    },
  };

  return response;
}

describe('text-to-give webhook', () => {
  beforeEach(() => {
    delete process.env.TEXT_TO_GIVE_CHURCH_PHONE_MAP;
    delete process.env.TEXT_TO_GIVE_DEFAULT_CHURCH_ID;
    delete process.env.TEXT_TO_GIVE_HELP_MESSAGE;
    delete process.env.GIVING_PAGE_URL;
    delete process.env.CHURCH_NAME_NORTH_CAMPUS;
    vi.restoreAllMocks();
  });

  it('returns help text for empty message body instead of 400', async () => {
    const req = {
      method: 'POST',
      body: {
        From: '+15551234567',
        To: '+15557654321',
        Body: '',
      },
    } as VercelRequest;
    const res = createMockResponse();

    await handler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/xml');
    expect(String(res.body)).toContain('Text-to-Give Commands');
  });

  it('uses church-specific routing when recipient number matches configured map', async () => {
    process.env.TEXT_TO_GIVE_CHURCH_PHONE_MAP = JSON.stringify({
      '+1 (555) 000-1111': 'north-campus',
    });
    process.env.CHURCH_NAME_NORTH_CAMPUS = 'Grace North';

    const req = {
      method: 'POST',
      body: {
        From: '+15552223333',
        To: '+1 555 000 1111',
        Body: 'hello',
        MessageSid: 'SM123',
      },
    } as VercelRequest;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const res = createMockResponse();

    await handler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain('Grace North');
    expect(logSpy).toHaveBeenCalledWith(
      'Text-to-Give:',
      expect.objectContaining({
        churchId: 'north-campus',
        messagePreview: 'hello',
      })
    );
  });

  it('falls back to default URL when giving page URL is invalid', async () => {
    process.env.GIVING_PAGE_URL = 'not-a-valid-url';

    const req = {
      method: 'POST',
      body: {
        From: '+15551234567',
        To: '+15557654321',
        Body: 'GIVE 25',
      },
    } as VercelRequest;
    const res = createMockResponse();

    await handler(req, res as unknown as VercelResponse);

    expect(String(res.body)).toContain('https://give.example.com/');
    expect(String(res.body)).toContain('amount=25');
  });
});
