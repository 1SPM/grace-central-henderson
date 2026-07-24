import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const checkDispatcherRateLimitMock = vi.fn();
vi.mock('./_lib/dispatcherRateLimit.js', () => ({
  checkDispatcherRateLimit: checkDispatcherRateLimitMock,
}));

vi.mock('./_health.js', () => ({
  default: vi.fn((_req: VercelRequest, res: VercelResponse) => res.status(200).json({ ok: true })),
}));

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
  };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown; headers: Record<string, string> };
}

function mockReq(path: string): VercelRequest {
  return { query: { path }, headers: {} } as unknown as VercelRequest;
}

describe('api/[...path].ts dispatcher', () => {
  beforeEach(() => {
    checkDispatcherRateLimitMock.mockReset();
  });

  it('dispatches to the route handler when under the rate limit', async () => {
    checkDispatcherRateLimitMock.mockReturnValue({ limited: false });
    const { default: handler } = await import('./[...path].js');
    const res = mockRes();
    await handler(mockReq('health'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 429 with a Retry-After header when rate-limited, without calling the route handler', async () => {
    checkDispatcherRateLimitMock.mockReturnValue({ limited: true, retryAfterSeconds: 42 });
    const { default: handler } = await import('./[...path].js');
    const res = mockRes();
    await handler(mockReq('health'), res);

    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('42');
  });

  it('still 404s an unknown route before ever checking the rate limit', async () => {
    checkDispatcherRateLimitMock.mockReturnValue({ limited: false });
    const { default: handler } = await import('./[...path].js');
    const res = mockRes();
    await handler(mockReq('not-a-real-route'), res);

    expect(res.statusCode).toBe(404);
    expect(checkDispatcherRateLimitMock).not.toHaveBeenCalled();
  });
});
