import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const resolveChurchIdForHostMock = vi.fn();
vi.mock('./_lib/resolveChurchByHost.js', () => ({
  resolveChurchIdForHost: resolveChurchIdForHostMock,
}));

const requireClerkAuthMock = vi.fn();
vi.mock('./_lib/auth-helper.js', () => ({
  requireClerkAuth: requireClerkAuthMock,
}));

const insertedRows: Record<string, unknown[]> = { people: [], prayer_requests: [], tasks: [] };

function makeSupabaseMock() {
  return {
    from(table: 'people' | 'prayer_requests' | 'tasks') {
      return {
        insert: (row: Record<string, unknown>) => {
          insertedRows[table].push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: `${table}-1` }, error: null }),
            }),
          };
        },
      };
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => makeSupabaseMock()),
}));

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    end() { return this; },
    setHeader() { return this; },
  };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown };
}

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { host: 'gracecrm-centralhenderson.org' },
    body: { firstName: 'Jane', lastName: 'Doe' },
    ...overrides,
  } as unknown as VercelRequest;
}

describe('POST /api/connect-card', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    resolveChurchIdForHostMock.mockReset();
    requireClerkAuthMock.mockReset();
    insertedRows.people = [];
    insertedRows.prayer_requests = [];
    insertedRows.tasks = [];
  });

  it('inserts under the church resolved from the request Host header', async () => {
    resolveChurchIdForHostMock.mockResolvedValue('11111111-1111-1111-1111-111111111111');
    const { default: handler } = await import('./_connect-card.js');
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(insertedRows.people[0]).toMatchObject({ church_id: '11111111-1111-1111-1111-111111111111' });
  });

  it('ignores a client-supplied churchId entirely — the resolved host wins, not the attacker-chosen tenant', async () => {
    resolveChurchIdForHostMock.mockResolvedValue('11111111-1111-1111-1111-111111111111');
    const { default: handler } = await import('./_connect-card.js');
    const res = mockRes();
    await handler(
      mockReq({
        body: {
          firstName: 'Attacker',
          lastName: 'Payload',
          // A stolen/guessed church_id for a DIFFERENT tenant — must be ignored.
          churchId: '22222222-2222-2222-2222-222222222222',
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(insertedRows.people[0]).toMatchObject({ church_id: '11111111-1111-1111-1111-111111111111' });
    expect(insertedRows.people[0]).not.toMatchObject({ church_id: '22222222-2222-2222-2222-222222222222' });
  });

  it('returns 404 when the Host header matches no known or custom church', async () => {
    resolveChurchIdForHostMock.mockResolvedValue(null);
    const { default: handler } = await import('./_connect-card.js');
    const res = mockRes();
    await handler(mockReq({ headers: { host: 'random-attacker-site.example' } }), res);

    expect(res.statusCode).toBe(404);
    expect(insertedRows.people).toHaveLength(0);
  });

  it('rejects malformed input before ever resolving a church', async () => {
    const { default: handler } = await import('./_connect-card.js');
    const res = mockRes();
    await handler(mockReq({ body: { firstName: '' } }), res);

    expect(res.statusCode).toBe(400);
    expect(resolveChurchIdForHostMock).not.toHaveBeenCalled();
  });

  it('uses the authenticated churchId (JWT) when a bearer token is present — works on any host, no Host lookup', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: true, churchId: '33333333-3333-3333-3333-333333333333', clerkUserId: 'u1', role: 'admin', sessionId: 's1' });
    const { default: handler } = await import('./_connect-card.js');
    const res = mockRes();
    // Host would resolve to null (unregistered), but the authed path wins.
    await handler(
      mockReq({
        headers: { host: 'brand-new-tenant-no-custom-domain.example', authorization: 'Bearer real-staff-token' },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(insertedRows.people[0]).toMatchObject({ church_id: '33333333-3333-3333-3333-333333333333' });
    expect(resolveChurchIdForHostMock).not.toHaveBeenCalled();
  });

  it('rejects a present-but-invalid bearer token rather than silently falling back to the Host path', async () => {
    requireClerkAuthMock.mockResolvedValue({ ok: false, status: 401, error: 'invalid token' });
    const { default: handler } = await import('./_connect-card.js');
    const res = mockRes();
    await handler(
      mockReq({ headers: { host: 'gracecrm-centralhenderson.org', authorization: 'Bearer tampered' } }),
      res,
    );

    expect(res.statusCode).toBe(401);
    expect(resolveChurchIdForHostMock).not.toHaveBeenCalled();
    expect(insertedRows.people).toHaveLength(0);
  });
});
