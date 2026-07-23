import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const requirePermissionMock = vi.fn();
vi.mock('../_lib/authz.js', () => ({ requirePermission: requirePermissionMock }));
const recordAuditMock = vi.fn(async () => {});
vi.mock('../_lib/workosAudit.js', () => ({ recordAudit: recordAuditMock }));

// ── chainable Supabase mock ───────────────────────────────────────────
const calls: { inserts: Record<string, unknown[]>; updates: Record<string, unknown[]> } = { inserts: {}, updates: {} };
let usersRow: unknown = null;   // what from('users').select(...).maybeSingle() resolves to
let roleRow: unknown = null;    // what from('roles').select(...).maybeSingle() resolves to

function qb(table: string) {
  const chain: Record<string, unknown> = {};
  const ret = () => chain;
  chain.select = ret; chain.eq = ret; chain.is = ret; chain.order = ret; chain.limit = ret;
  chain.maybeSingle = () => Promise.resolve({ data: table === 'roles' ? roleRow : usersRow, error: null });
  chain.single = chain.maybeSingle;
  chain.insert = (row: unknown) => { (calls.inserts[table] ??= []).push(row); return Promise.resolve({ error: null }); };
  chain.update = (row: unknown) => { (calls.updates[table] ??= []).push(row); return { eq: ret, is: ret, then: (r: (v: unknown) => void) => r({ error: null }) }; };
  return chain;
}
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: (t: string) => qb(t) })) }));

function mockRes() {
  const res = { statusCode: 200, body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(p: unknown) { this.body = p; return this; } };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown };
}
function mockReq(body: unknown): VercelRequest {
  return { method: 'POST', headers: {}, body } as unknown as VercelRequest;
}

const ADMIN = { userId: 'aaaaaaaa-0000-0000-0000-000000000001', clerkUserId: 'ck_admin', churchId: 'church-1', role: 'admin', permissions: new Set(['admin.manage_roles']) };

describe('POST /api/team/set-role', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://t.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    requirePermissionMock.mockReset(); recordAuditMock.mockReset();
    calls.inserts = {}; calls.updates = {}; usersRow = null; roleRow = null;
  });

  it('rejects a caller without admin.manage_roles (403 via requirePermission)', async () => {
    requirePermissionMock.mockImplementation(async (_r, res) => { res.status(403).json({ error: 'insufficient_permission' }); return null; });
    const { default: handler } = await import('./_set-role.js');
    const res = mockRes();
    await handler(mockReq({ user_id: '00000000-0000-0000-0000-000000000009', role: 'staff' }), res);
    expect(res.statusCode).toBe(403);
    expect(calls.inserts.user_roles).toBeUndefined();
  });

  it('blocks changing your own role (409)', async () => {
    requirePermissionMock.mockResolvedValue(ADMIN);
    const { default: handler } = await import('./_set-role.js');
    const res = mockRes();
    await handler(mockReq({ user_id: ADMIN.userId, role: 'staff' }), res);
    expect(res.statusCode).toBe(409);
    expect(calls.inserts.user_roles).toBeUndefined();
  });

  it('404s when the target user is not in the caller church (cross-tenant / bad id)', async () => {
    requirePermissionMock.mockResolvedValue(ADMIN);
    usersRow = null; // .eq('church_id', actor.churchId) → no row
    const { default: handler } = await import('./_set-role.js');
    const res = mockRes();
    await handler(mockReq({ user_id: '11111111-1111-1111-1111-111111111111', role: 'staff' }), res);
    expect(res.statusCode).toBe(404);
    expect(calls.inserts.user_roles).toBeUndefined();
  });

  it('assigns the mapped system role: staff → member_services, revokes prior, syncs coarse column, audits', async () => {
    requirePermissionMock.mockResolvedValue(ADMIN);
    usersRow = { id: 'bbbbbbbb-0000-0000-0000-000000000002', role: 'volunteer', church_id: 'church-1' };
    roleRow = { id: 'role-member-services' };
    const { default: handler } = await import('./_set-role.js');
    const res = mockRes();
    await handler(mockReq({ user_id: 'bbbbbbbb-0000-0000-0000-000000000002', role: 'staff' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ user_id: 'bbbbbbbb-0000-0000-0000-000000000002', role: 'staff', system_role: 'member_services' });
    // revoked prior grants, then inserted the new one
    expect(calls.updates.user_roles).toHaveLength(1);
    expect(calls.inserts.user_roles?.[0]).toMatchObject({ church_id: 'church-1', user_id: 'bbbbbbbb-0000-0000-0000-000000000002', role_id: 'role-member-services' });
    // synced the legacy coarse column
    expect(calls.updates.users?.[0]).toMatchObject({ role: 'staff' });
    // audited before/after
    expect(recordAuditMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'user.role_changed', entityId: 'bbbbbbbb-0000-0000-0000-000000000002',
      before: { role: 'volunteer' }, after: { role: 'staff', system_role: 'member_services' },
    }));
  });

  it('maps admin → system_administrator', async () => {
    requirePermissionMock.mockResolvedValue(ADMIN);
    usersRow = { id: 'cccccccc-0000-0000-0000-000000000003', role: 'staff', church_id: 'church-1' };
    roleRow = { id: 'role-sysadmin' };
    const { default: handler } = await import('./_set-role.js');
    const res = mockRes();
    await handler(mockReq({ user_id: 'cccccccc-0000-0000-0000-000000000003', role: 'admin' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ system_role: 'system_administrator' });
  });

  it('rejects an unmapped role value (400 schema)', async () => {
    requirePermissionMock.mockResolvedValue(ADMIN);
    const { default: handler } = await import('./_set-role.js');
    const res = mockRes();
    await handler(mockReq({ user_id: 'dddddddd-0000-0000-0000-000000000004', role: 'member' }), res);
    expect(res.statusCode).toBe(400);
  });
});
