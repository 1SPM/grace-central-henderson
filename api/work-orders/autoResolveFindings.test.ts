/**
 * Route test for PATCH /api/work-orders — the auto-resolve hook: when a
 * Work Order transitions to 'completed', any agent_finding linked to it
 * (status 'actioned', work_order_id = this Work Order) should flip to
 * 'resolved' without any separate manual action.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

const WORK_ORDER_ID = '11111111-2222-4333-8444-666666666666';
const FINDING_ID = '11111111-2222-4333-8444-777777777777';

const EXISTING_WORK_ORDER = {
  id: WORK_ORDER_ID,
  church_id: FIXTURE_CHURCH_ID,
  status: 'under_review',
  ministry: null,
  metadata: null,
};

function makeReq(query: Record<string, string>, body: unknown) {
  return {
    method: 'PATCH',
    headers: { authorization: 'Bearer valid-token' },
    query,
    body,
  } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
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

describe('PATCH /api/work-orders — auto-resolve linked findings on completion', () => {
  it('resolves an actioned finding linked to this Work Order when it transitions to completed', async () => {
    const handler = (await import('./_index.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'work_orders.manage' } }] }),
        work_orders: (op: string) => {
          if (op === 'select') return { data: EXISTING_WORK_ORDER };
          return { data: { ...EXISTING_WORK_ORDER, status: 'completed' } };
        },
        agent_findings: (op: string) => {
          if (op === 'select') return { data: [{ id: FINDING_ID }] };
          return { data: null };
        },
        platform_events: () => ({ data: { id: 'evt-1' } }),
        audit_logs: () => ({ data: null }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ id: WORK_ORDER_ID }, { status: 'completed' });
    const res = makeRes();
    await handler(req, res);

    const findingUpdateCalls = supabase.__calls.filter(c => c.table === 'agent_findings' && c.op === 'update');
    expect(findingUpdateCalls).toHaveLength(1);
    const payload = findingUpdateCalls[0].payload as Record<string, unknown>;
    expect(payload.status).toBe('resolved');
    expect(typeof payload.resolved_at).toBe('string');
  });

  it('does not touch agent_findings when transitioning to a non-completed status', async () => {
    const handler = (await import('./_index.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'work_orders.manage' } }] }),
        work_orders: (op: string) => {
          if (op === 'select') return { data: { ...EXISTING_WORK_ORDER, status: 'in_progress' } };
          return { data: { ...EXISTING_WORK_ORDER, status: 'blocked' } };
        },
        agent_findings: () => ({ data: [] }),
        platform_events: () => ({ data: { id: 'evt-1' } }),
        audit_logs: () => ({ data: null }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ id: WORK_ORDER_ID }, { status: 'blocked' });
    const res = makeRes();
    await handler(req, res);

    const findingCalls = supabase.__calls.filter(c => c.table === 'agent_findings');
    expect(findingCalls).toHaveLength(0);
  });
});
