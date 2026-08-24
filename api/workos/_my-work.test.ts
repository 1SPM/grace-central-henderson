/**
 * Route tests for /api/workos/my-work — the self-scoped "what's on my
 * plate" surface. Deliberately requires no work_orders.view/agents.view
 * grant (pastor-only since migration 068): a caller can only ever see or
 * flag what they themselves own, which needs no broad permission at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq(method: 'GET' | 'POST', body?: unknown) {
  return { method, headers: { authorization: 'Bearer valid-token' }, body } as unknown as import('@vercel/node').VercelRequest;
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

describe('GET /api/workos/my-work', () => {
  it('requires no work_orders.view/agents.view grant — any active staff member gets their own data', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        work_orders: () => ({ data: [] }),
        ministry_assignments: () => ({ data: [] }),
        agent_runs: () => ({ data: [] }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ work_orders: [], areas: [] });
  });

  it('pairs an owned Work Order with its latest agent run', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        work_orders: () => ({
          data: [{ id: 'wo-1', title: 'Reconcile July giving', status: 'in_progress', priority: 'high', ministry: 'Finance', due_date: null }],
        }),
        ministry_assignments: () => ({ data: [] }),
        agent_runs: () => ({
          data: [{ agent_key: 'verity', status: 'succeeded', started_at: null, finished_at: '2026-08-01T00:00:00.000Z', output: { summary: 'Found 2 mismatches.' }, error: null, work_order_id: 'wo-1' }],
        }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    const body = res.json.mock.calls[0][0];
    expect(body.work_orders).toHaveLength(1);
    expect(body.work_orders[0].agent_activity).toEqual({
      agent_key: 'verity', agent_name: 'Verity', status: 'succeeded',
      finished_at: '2026-08-01T00:00:00.000Z', summary: 'Found 2 mismatches.', error: null,
    });
  });

  it('pairs an owned ministry area with its agent\'s latest run', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        work_orders: () => ({ data: [] }),
        ministry_assignments: () => ({ data: [{ area_key: 'giving', agent_key: 'steward' }] }),
        agent_runs: () => ({
          data: [{ agent_key: 'steward', status: 'running', started_at: '2026-08-24T00:00:00.000Z', finished_at: null, output: null, error: null, work_order_id: null }],
        }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    const body = res.json.mock.calls[0][0];
    expect(body.areas).toHaveLength(1);
    expect(body.areas[0].area_key).toBe('giving');
    expect(body.areas[0].agent_activity?.status).toBe('running');
  });

  it('shows an owned area with no agent as agent_activity: null, not an error', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        work_orders: () => ({ data: [] }),
        ministry_assignments: () => ({ data: [{ area_key: 'children', agent_key: null }] }),
        agent_runs: () => ({ data: [] }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    const body = res.json.mock.calls[0][0];
    expect(body.areas[0].agent_activity).toBeNull();
  });
});

describe('POST /api/workos/my-work (flag)', () => {
  it('403s a work_order flag when the caller does not own it', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        work_orders: () => ({ data: { id: 'wo-1', owner_user_id: 'someone-else' } }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('POST', { subject_type: 'work_order', subject_id: '11111111-1111-1111-1111-111111111111', note: 'x' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'not_your_work_order' }));
  });

  it('403s a ministry_area flag when the caller is not the assigned owner', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        ministry_assignments: () => ({ data: { owner_user_id: 'someone-else', agent_key: 'verity' } }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('POST', { subject_type: 'ministry_area', area_key: 'giving', note: 'x' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'not_your_ministry_area' }));
  });

  it('400s a flag on an owned item with no agent to flag', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
        ministry_assignments: () => ({ data: { owner_user_id: FIXTURE_STAFF_USER.id, agent_key: null } }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    // "children" has no defaultAgentKey either (api/_lib/ministryAreas.ts), so this stays null end to end.
    await handler(makeReq('POST', { subject_type: 'ministry_area', area_key: 'children', note: 'x' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'no_agent_assigned' }));
  });

  it('inserts an agent_findings row and an audit entry for a valid owned+agent-supported flag', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active', first_name: 'Taylor', last_name: 'Testworthy' } }),
        ministry_assignments: () => ({ data: { owner_user_id: FIXTURE_STAFF_USER.id, agent_key: 'verity' } }),
        agent_findings: () => ({ data: null }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('POST', { subject_type: 'ministry_area', area_key: 'giving', note: 'This looks off, please check.' }), res);

    expect(res.status).toHaveBeenCalledWith(201);

    const findingInsert = supabase.__calls.find(c => c.table === 'agent_findings' && c.op === 'insert');
    expect(findingInsert).toBeDefined();
    const payload = findingInsert!.payload as Record<string, unknown>;
    expect(payload.church_id).toBe(FIXTURE_CHURCH_ID);
    expect(payload.agent_id).toBe('verity');
    expect(payload.source).toBe('staff_flag');
    expect(payload.subject_type).toBe('ministry_area');
    expect(payload.subject_id).toBe('giving');
    expect(payload.detail).toBe('This looks off, please check.');

    const auditInsert = supabase.__calls.find(c => c.table === 'audit_logs' && c.op === 'insert');
    expect(auditInsert).toBeDefined();
    expect((auditInsert!.payload as { action: string }).action).toBe('agent_activity_flagged');
  });

  it('400s an unknown subject_type', async () => {
    const handler = (await import('./_my-work.js')).default;
    const supabase = createMockSupabase({ tables: { users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }) } });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('POST', { subject_type: 'something_else', note: 'x' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'invalid_subject_type' }));
  });
});
