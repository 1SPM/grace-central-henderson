/**
 * Route tests for /api/agents/workos-run — the registered-but-not-
 * implemented 501 path (the Steve bug shipped through this guard with no
 * endpoint coverage) and the unknown-agent 404. Asserts the endpoint
 * never fabricates a run: a 501/404 must write no agent_runs row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq(body?: unknown) {
  return {
    method: 'POST',
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
      agent_runs: () => ({ data: { id: 'run-1' } }),
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

describe('POST /api/agents/workos-run — not-implemented and unknown agents', () => {
  it('501s a registered-but-unimplemented agent and records no run', async () => {
    const handler = (await import('./_workos-run.js')).default;
    const supabase = supabaseForStaffWithPermissions(['agents.manage']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ agent_key: 'steve' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(501);
    expect(res.json).toHaveBeenCalledWith({ error: 'agent_not_implemented', agent_key: 'steve' });
    const runInserts = supabase.__calls.filter(c => c.table === 'agent_runs' && c.op === 'insert');
    expect(runInserts).toHaveLength(0);
  });

  it('404s an unknown agent key and records no run', async () => {
    const handler = (await import('./_workos-run.js')).default;
    const supabase = supabaseForStaffWithPermissions(['agents.manage']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ agent_key: 'nonexistent' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'unknown_agent' });
    const runInserts = supabase.__calls.filter(c => c.table === 'agent_runs' && c.op === 'insert');
    expect(runInserts).toHaveLength(0);
  });

  it('fails the run closed when a workflow emits a requires_approval finding (no approvals consumer exists yet)', async () => {
    vi.doMock('../_lib/agentWorkflows.js', async importOriginal => {
      const actual = await importOriginal<typeof import('../_lib/agentWorkflows.js')>();
      return {
        ...actual,
        getWorkflow: () => async () => ({
          findings: [{
            action_type: 'propose_reassign',
            target_entity_type: 'work_order',
            target_entity_id: 'wo-1',
            payload: {},
            requires_approval: true,
          }],
          summary: 'proposes a mutation',
        }),
      };
    });
    const handler = (await import('./_workos-run.js')).default;
    const supabase = supabaseForStaffWithPermissions(['agents.manage']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ agent_key: 'grace' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'agent_run_failed' });
    // No proposed action row is stranded, and the run is marked failed.
    const actionInserts = supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'insert');
    expect(actionInserts).toHaveLength(0);
    const runUpdates = supabase.__calls.filter(c => c.table === 'agent_runs' && c.op === 'update');
    expect(runUpdates).toHaveLength(1);
    expect((runUpdates[0].payload as Record<string, unknown>).status).toBe('failed');
    vi.doUnmock('../_lib/agentWorkflows.js');
  });

  it('403s a caller without agents.manage before touching any agent state', async () => {
    const handler = (await import('./_workos-run.js')).default;
    const supabase = supabaseForStaffWithPermissions(['agents.view']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ agent_key: 'grace' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const runInserts = supabase.__calls.filter(c => c.table === 'agent_runs' && c.op === 'insert');
    expect(runInserts).toHaveLength(0);
  });
});
