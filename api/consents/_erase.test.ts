import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const requirePermissionMock = vi.fn();
vi.mock('../_lib/authz.js', () => ({ requirePermission: requirePermissionMock }));
const recordAuditMock = vi.fn(async () => {});
vi.mock('../_lib/workosAudit.js', () => ({ recordAudit: recordAuditMock }));
const deleteUserMock = vi.fn(async () => {});
vi.mock('@clerk/backend', () => ({ createClerkClient: () => ({ users: { deleteUser: deleteUserMock } }) }));

// ── supabase mock: people select(...).eq.eq.maybeSingle and delete(...).eq.eq ──
let personRow: unknown = null;
let deleteError: { message: string } | null = null;
const calls = { deleted: false };
function peopleQb() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.delete = () => { calls.deleted = true; return b; };
  b.eq = () => b;
  b.maybeSingle = () => Promise.resolve({ data: personRow, error: null });
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ error: deleteError });
  return b;
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => peopleQb() }) }));

function mockRes() {
  const res = { statusCode: 0, body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(p: unknown) { this.body = p; return this; } };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown };
}
function mockReq(body: unknown): VercelRequest {
  return { method: 'POST', headers: {}, body } as unknown as VercelRequest;
}

const ACTOR = { userId: 'admin-1', clerkUserId: 'ck_admin', churchId: 'church-1', permissions: new Set(['admin.manage_settings']) };
const PID = 'aaaaaaaa-0000-0000-0000-000000000001';

describe('POST /api/consents/erase', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://t.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    requirePermissionMock.mockReset(); recordAuditMock.mockReset(); deleteUserMock.mockReset();
    deleteUserMock.mockResolvedValue(undefined);
    personRow = null; deleteError = null; calls.deleted = false;
  });

  it('rejects a caller without admin.manage_settings (403)', async () => {
    requirePermissionMock.mockImplementation(async (_r, res) => { res.status(403).json({ error: 'insufficient_permission' }); return null; });
    const { default: handler } = await import('./_erase.js');
    const res = mockRes();
    await handler(mockReq({ person_id: PID, confirm: true }), res);
    expect(res.statusCode).toBe(403);
    expect(calls.deleted).toBe(false);
  });

  it('requires explicit confirm=true (400, nothing deleted)', async () => {
    requirePermissionMock.mockResolvedValue(ACTOR);
    const { default: handler } = await import('./_erase.js');
    const res = mockRes();
    await handler(mockReq({ person_id: PID, confirm: false }), res);
    expect(res.statusCode).toBe(400);
    expect(calls.deleted).toBe(false);
  });

  it('404s when the person is not in the caller church', async () => {
    requirePermissionMock.mockResolvedValue(ACTOR);
    personRow = null;
    const { default: handler } = await import('./_erase.js');
    const res = mockRes();
    await handler(mockReq({ person_id: PID, confirm: true }), res);
    expect(res.statusCode).toBe(404);
    expect(calls.deleted).toBe(false);
  });

  it('erases: deletes people row, deletes the Clerk user, returns the treatment summary', async () => {
    requirePermissionMock.mockResolvedValue(ACTOR);
    personRow = { id: PID, clerk_user_id: 'user_clerk_123' };
    const { default: handler } = await import('./_erase.js');
    const res = mockRes();
    await handler(mockReq({ person_id: PID, confirm: true, request_id: 'bbbbbbbb-0000-0000-0000-000000000002' }), res);

    expect(res.statusCode).toBe(200);
    expect(calls.deleted).toBe(true);                       // DB row hard-deleted
    expect(deleteUserMock).toHaveBeenCalledWith('user_clerk_123'); // Clerk account deleted
    const body = res.body as { erased: boolean; processors: Record<string, string>; anonymized: string[]; retained_by_law: string[] };
    expect(body.erased).toBe(true);
    expect(body.processors.clerk).toBe('deleted');
    expect(body.anonymized).toContain('giving');
    expect(body.retained_by_law).toContain('financial_ledger');
  });

  it('audit entry is PII-FREE (person id + processors only — no name/email)', async () => {
    requirePermissionMock.mockResolvedValue(ACTOR);
    personRow = { id: PID, clerk_user_id: 'user_clerk_123' };
    const { default: handler } = await import('./_erase.js');
    await handler(mockReq({ person_id: PID, confirm: true }), mockRes());

    expect(recordAuditMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'person.erased', entityType: 'person', entityId: PID, reason: 'right_to_be_forgotten',
    }));
    const auditArg = recordAuditMock.mock.calls[0][1] as Record<string, unknown>;
    const serialized = JSON.stringify(auditArg);
    expect(serialized).not.toMatch(/@/);          // no email
    expect(serialized).not.toContain('clerk_user_id'); // no auth identifier in the durable log
  });

  it('a Clerk deletion failure is best-effort — DB erasure still succeeds (200)', async () => {
    requirePermissionMock.mockResolvedValue(ACTOR);
    personRow = { id: PID, clerk_user_id: 'user_clerk_123' };
    deleteUserMock.mockRejectedValue(new Error('clerk 500'));
    const { default: handler } = await import('./_erase.js');
    const res = mockRes();
    await handler(mockReq({ person_id: PID, confirm: true }), res);

    expect(res.statusCode).toBe(200);
    expect(calls.deleted).toBe(true);
    const body = res.body as { processors: Record<string, string> };
    expect(body.processors.clerk).toMatch(/^error:/);
  });

  it('a person with no Clerk account still erases cleanly', async () => {
    requirePermissionMock.mockResolvedValue(ACTOR);
    personRow = { id: PID, clerk_user_id: null };
    const { default: handler } = await import('./_erase.js');
    const res = mockRes();
    await handler(mockReq({ person_id: PID, confirm: true }), res);
    expect(res.statusCode).toBe(200);
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect((res.body as { processors: Record<string, string> }).processors.clerk).toBe('not_linked');
  });
});
