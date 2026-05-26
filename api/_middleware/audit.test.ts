import { describe, it, expect, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  inferEntityType,
  actionFromMethod,
  clientIp,
  requestId,
  userAgent,
  churchIdFromAuth,
  buildAuditRow,
  auditMutations,
} from './audit';
import type { AuthenticatedRequest } from './auth';

function mockReq(over: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    method: 'POST',
    originalUrl: '/api/people/abc-123',
    url: '/api/people/abc-123',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' } as AuthenticatedRequest['socket'],
    auth: { userId: 'user_clerk_1', sessionId: 's', role: 'staff' },
    ...over,
  } as AuthenticatedRequest;
}

function mockRes(): { res: Response; finishHandlers: Array<() => void>; runFinish: () => void } {
  const handlers: Array<() => void> = [];
  const res = {
    statusCode: 200,
    on(event: string, cb: () => void) {
      if (event === 'finish') handlers.push(cb);
      return this;
    },
  } as unknown as Response;
  return { res, finishHandlers: handlers, runFinish: () => handlers.forEach((h) => h()) };
}

describe('audit — pure helpers', () => {
  it('inferEntityType pulls the first path segment under /api', () => {
    expect(inferEntityType('/api/people/abc')).toBe('people');
    expect(inferEntityType('/api/auth/users/123/role')).toBe('auth');
    expect(inferEntityType('/api/giving')).toBe('giving');
    expect(inferEntityType('/not-api/foo')).toBe('unknown');
    expect(inferEntityType('')).toBe('unknown');
  });

  it('actionFromMethod maps HTTP verbs to audit actions', () => {
    expect(actionFromMethod('POST')).toBe('create');
    expect(actionFromMethod('PUT')).toBe('update');
    expect(actionFromMethod('PATCH')).toBe('update');
    expect(actionFromMethod('DELETE')).toBe('delete');
    expect(actionFromMethod('OPTIONS')).toBe('options');
  });

  it('clientIp respects TRUST_PROXY env var', () => {
    const original = process.env.TRUST_PROXY;
    try {
      process.env.TRUST_PROXY = 'true';
      const req = mockReq({ headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' } });
      expect(clientIp(req)).toBe('203.0.113.1');

      process.env.TRUST_PROXY = 'false';
      expect(clientIp(req)).toBe('127.0.0.1');
    } finally {
      if (original === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = original;
    }
  });

  it('requestId reads X-Request-Id and clamps to 128 chars', () => {
    expect(requestId(mockReq({ headers: { 'x-request-id': 'r1' } }))).toBe('r1');
    expect(requestId(mockReq())).toBeNull();
    const long = 'x'.repeat(200);
    expect(requestId(mockReq({ headers: { 'x-request-id': long } }))).toHaveLength(128);
  });

  it('userAgent reads UA header and clamps to 512 chars', () => {
    expect(userAgent(mockReq({ headers: { 'user-agent': 'jest' } }))).toBe('jest');
    expect(userAgent(mockReq())).toBeNull();
  });

  it('churchIdFromAuth pulls churchId off req.auth when present', () => {
    const withChurch = mockReq();
    (withChurch.auth as { churchId?: string }).churchId = 'church-xyz';
    expect(churchIdFromAuth(withChurch)).toBe('church-xyz');
    expect(churchIdFromAuth(mockReq())).toBeNull();
  });
});

describe('audit — buildAuditRow', () => {
  it('captures the authenticated actor, route, and method', () => {
    const req = mockReq({
      method: 'PATCH',
      originalUrl: '/api/people/abc-123',
      headers: { 'user-agent': 'jest', 'x-request-id': 'req-1' },
    });
    const { res } = mockRes();
    const row = buildAuditRow(req, res, {
      action: 'update',
      entity_type: 'person',
      entity_id: 'abc-123',
    });
    expect(row).toMatchObject({
      action: 'update',
      entity_type: 'person',
      entity_id: 'abc-123',
      actor_clerk_id: 'user_clerk_1',
      actor_role: 'staff',
      route: '/api/people/abc-123',
      method: 'PATCH',
      user_agent: 'jest',
      request_id: 'req-1',
      church_id: null,
    });
  });

  it('prefers explicit church_id in details over req.auth.churchId', () => {
    const req = mockReq();
    (req.auth as { churchId?: string }).churchId = 'church-from-auth';
    const { res } = mockRes();
    const row = buildAuditRow(req, res, {
      action: 'create',
      entity_type: 'person',
      church_id: 'church-from-handler',
    });
    expect(row.church_id).toBe('church-from-handler');
  });

  it('uses req.auth.churchId when details.church_id is undefined', () => {
    const req = mockReq();
    (req.auth as { churchId?: string }).churchId = 'church-from-auth';
    const { res } = mockRes();
    const row = buildAuditRow(req, res, { action: 'create', entity_type: 'person' });
    expect(row.church_id).toBe('church-from-auth');
  });
});

describe('audit — auditMutations middleware', () => {
  function mockSupabase() {
    const insert = vi.fn().mockResolvedValue({ error: null });
    return { insert, client: { from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient };
  }

  it('skips GET / HEAD / OPTIONS', () => {
    const sb = mockSupabase();
    const mw = auditMutations(sb.client);
    const next = vi.fn() as NextFunction;
    const { res, finishHandlers } = mockRes();
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      mw(mockReq({ method }), res, next);
    }
    expect(finishHandlers).toHaveLength(0);
    expect(next).toHaveBeenCalledTimes(3);
    expect(sb.insert).not.toHaveBeenCalled();
  });

  it('writes a row on 2xx response to a non-safe method', async () => {
    const sb = mockSupabase();
    const mw = auditMutations(sb.client);
    const next = vi.fn() as NextFunction;
    const { res, runFinish } = mockRes();
    (res as { statusCode: number }).statusCode = 201;
    mw(mockReq({ method: 'POST', originalUrl: '/api/tasks/t-1' }), res, next);
    runFinish();
    // Flush microtasks so the fire-and-forget insert resolves
    await Promise.resolve();
    expect(sb.client.from).toHaveBeenCalledWith('audit_logs');
    expect(sb.insert).toHaveBeenCalledTimes(1);
    const row = sb.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      action: 'create',
      entity_type: 'tasks',
      method: 'POST',
      route: '/api/tasks/t-1',
    });
  });

  it('does NOT write on 4xx / 5xx responses', async () => {
    const sb = mockSupabase();
    const mw = auditMutations(sb.client);
    const { res, runFinish } = mockRes();
    (res as { statusCode: number }).statusCode = 403;
    mw(mockReq({ method: 'DELETE' }), res, vi.fn() as NextFunction);
    runFinish();
    await Promise.resolve();
    expect(sb.insert).not.toHaveBeenCalled();
  });

  it('audit failures never throw out of the middleware', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const client = { from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient;
    const mw = auditMutations(client);
    const { res, runFinish } = mockRes();
    mw(mockReq({ method: 'POST' }), res, vi.fn() as NextFunction);
    expect(() => runFinish()).not.toThrow();
    await Promise.resolve();
    // Caller never sees the error; it goes to console + Sentry.
  });
});
