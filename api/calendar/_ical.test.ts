import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Structurally real (unsigned) JWTs — enough to exercise isAnonKey's
// decode logic. Never real secrets; fabricated fixture values only.
const ANON_KEY_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.fakesignature';
const SERVICE_ROLE_KEY_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ.fakesignature';

const churchesMaybeSingle = vi.fn();
const eventsOrder = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from(table: 'churches' | 'calendar_events') {
      if (table === 'churches') {
        return { select: () => ({ eq: () => ({ maybeSingle: churchesMaybeSingle }) }) };
      }
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: eventsOrder,
            }),
          }),
        }),
      };
    },
  })),
}));

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    send(payload: unknown) { this.body = payload; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
  };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown; headers: Record<string, string> };
}

function mockReq(query: Record<string, string>): VercelRequest {
  return { method: 'GET', query } as unknown as VercelRequest;
}

describe('GET /api/calendar/ical', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    churchesMaybeSingle.mockReset();
    eventsOrder.mockReset();
  });

  it('refuses to query when the configured key is not anon-role (e.g. service_role by mistake)', async () => {
    process.env.VITE_SUPABASE_ANON_KEY = SERVICE_ROLE_KEY_JWT;
    const { default: handler } = await import('./_ical.js');
    const res = mockRes();
    await handler(mockReq({ churchId: '11111111-1111-1111-1111-111111111111' }), res);

    expect(res.statusCode).toBe(200);
    expect(churchesMaybeSingle).not.toHaveBeenCalled();
    expect(String(res.body)).toContain('BEGIN:VCALENDAR');
    expect(String(res.body)).not.toContain('BEGIN:VEVENT');
  });

  it('returns an empty calendar (no query) when churchId matches no real church', async () => {
    process.env.VITE_SUPABASE_ANON_KEY = ANON_KEY_JWT;
    churchesMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { default: handler } = await import('./_ical.js');
    const res = mockRes();
    await handler(mockReq({ churchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }), res);

    expect(res.statusCode).toBe(200);
    expect(eventsOrder).not.toHaveBeenCalled();
    expect(String(res.body)).not.toContain('BEGIN:VEVENT');
  });

  it('queries and returns events for a real church with a real anon key', async () => {
    process.env.VITE_SUPABASE_ANON_KEY = ANON_KEY_JWT;
    churchesMaybeSingle.mockResolvedValue({ data: { id: '11111111-1111-1111-1111-111111111111' }, error: null });
    eventsOrder.mockResolvedValue({
      data: [{
        id: 'evt-1',
        title: 'Sunday Service',
        description: null,
        start_date: '2026-08-02T10:00:00.000Z',
        end_date: null,
        all_day: false,
        location: null,
        category: null,
      }],
      error: null,
    });
    const { default: handler } = await import('./_ical.js');
    const res = mockRes();
    await handler(mockReq({ churchId: '11111111-1111-1111-1111-111111111111' }), res);

    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain('BEGIN:VEVENT');
    expect(String(res.body)).toContain('SUMMARY:Sunday Service');
  });

  it('rejects a request with no churchId before ever touching Supabase', async () => {
    process.env.VITE_SUPABASE_ANON_KEY = ANON_KEY_JWT;
    const { default: handler } = await import('./_ical.js');
    const res = mockRes();
    await handler(mockReq({}), res);

    expect(res.statusCode).toBe(400);
    expect(churchesMaybeSingle).not.toHaveBeenCalled();
  });
});
