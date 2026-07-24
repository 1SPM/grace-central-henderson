/**
 * Route tests for /api/agents/findings — permission gating on PATCH/POST
 * (agents.manage) and that dismiss actually sets a suppression window.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

const FINDING_ID = '11111111-2222-4333-8444-555555555555';

const EXISTING_FINDING = {
  id: FINDING_ID,
  church_id: FIXTURE_CHURCH_ID,
  agent_id: 'stewardship',
  status: 'open',
  severity: 'high',
  title: 'Lapsed giver',
  detail: null,
};

function makeReq(method: string, body?: unknown) {
  return {
    method,
    headers: { authorization: 'Bearer valid-token' },
    body,
  } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function supabaseForStaffWithPermissions(permissionKeys: string[]) {
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: permissionKeys.map(key => ({ permissions: { key } })) }),
      agent_findings: (op: string) => {
        if (op === 'select') return { data: EXISTING_FINDING };
        return { data: { ...EXISTING_FINDING, status: 'dismissed' } };
      },
      platform_events: () => ({ data: { id: 'evt-1' } }),
      audit_logs: () => ({ data: null }),
    },
  });
}

beforeEach(async () => {
  vi.resetModules();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  const { verifyToken } = await import('@clerk/backend');
  (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    sub: FIXTURE_STAFF_USER.clerk_id,
    app_metadata: { church_id: FIXTURE_CHURCH_ID },
  });
});

describe('PATCH /api/agents/findings — permission gating', () => {
  it('403s a caller without agents.manage and never writes an update', async () => {
    const handler = (await import('./_findings.js')).default;
    const supabase = supabaseForStaffWithPermissions(['agents.view']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq('PATCH', { id: FINDING_ID, action: 'dismiss' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const updateCalls = supabase.__calls.filter(c => c.table === 'agent_findings' && c.op === 'update');
    expect(updateCalls).toHaveLength(0);
  });

  it('dismiss sets status=dismissed and a suppress_until in the future (default 7 days)', async () => {
    const handler = (await import('./_findings.js')).default;
    const supabase = supabaseForStaffWithPermissions(['agents.manage']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq('PATCH', { id: FINDING_ID, action: 'dismiss', dismissed_reason: 'False positive' });
    const res = makeRes();
    await handler(req, res);

    const updateCalls = supabase.__calls.filter(c => c.table === 'agent_findings' && c.op === 'update');
    expect(updateCalls).toHaveLength(1);
    const payload = updateCalls[0].payload as Record<string, unknown>;
    expect(payload.status).toBe('dismissed');
    expect(payload.dismissed_reason).toBe('False positive');
    expect(typeof payload.suppress_until).toBe('string');
    expect(new Date(payload.suppress_until as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('triage sets status=triaged and records the triaging user', async () => {
    const handler = (await import('./_findings.js')).default;
    const supabase = supabaseForStaffWithPermissions(['agents.manage']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq('PATCH', { id: FINDING_ID, action: 'triage' });
    const res = makeRes();
    await handler(req, res);

    const updateCalls = supabase.__calls.filter(c => c.table === 'agent_findings' && c.op === 'update');
    const payload = updateCalls[0].payload as Record<string, unknown>;
    expect(payload.status).toBe('triaged');
    expect(payload.triaged_by_user_id).toBeTruthy();
  });
});

describe('POST /api/agents/findings (convert_to_work_order) — permission gating', () => {
  it('403s a caller without agents.manage and never creates a Work Order', async () => {
    const handler = (await import('./_findings.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'agents.view' } }] }),
        agent_findings: () => ({ data: EXISTING_FINDING }),
        work_orders: () => ({ data: { id: 'wo-1' } }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq('POST', { id: FINDING_ID, action: 'convert_to_work_order' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const woCalls = supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'insert');
    expect(woCalls).toHaveLength(0);
  });
});
