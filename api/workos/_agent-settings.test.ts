/**
 * Route tests for /api/workos/agent-settings — the pastor's per-agent
 * instructions/tasks overlay on the static agent registry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq(method: 'GET' | 'PUT', body?: unknown) {
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

function withPermissions(permissionKeys: string[], tables: Record<string, () => { data: unknown; error?: unknown }> = {}) {
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: permissionKeys.map(key => ({ permissions: { key } })) }),
      ...tables,
    },
  });
}

describe('GET /api/workos/agent-settings', () => {
  it('403s a caller without agents.view', async () => {
    const handler = (await import('./_agent-settings.js')).default;
    const supabase = withPermissions([]);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns every registry agent, honestly null/empty when nothing has been configured', async () => {
    const handler = (await import('./_agent-settings.js')).default;
    const supabase = withPermissions(['agents.view'], {
      agent_configs: () => ({ data: [] }),
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.configs.length).toBeGreaterThan(10); // full AGENT_REGISTRY, not just configured ones
    const grace = body.configs.find((c: { agent_key: string }) => c.agent_key === 'grace');
    expect(grace).toEqual({ agent_key: 'grace', instructions: null, tasks: [], updated_at: null });
  });

  it('layers a saved config onto its matching registry entry', async () => {
    const handler = (await import('./_agent-settings.js')).default;
    const supabase = withPermissions(['agents.view'], {
      agent_configs: () => ({
        data: [{ agent_key: 'shepherd', instructions: 'Prioritize crisis flags.', tasks: ['Review queue AM', 'Review queue PM'], updated_at: '2026-08-01T00:00:00.000Z' }],
      }),
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('GET'), res);

    const body = res.json.mock.calls[0][0];
    const shepherd = body.configs.find((c: { agent_key: string }) => c.agent_key === 'shepherd');
    expect(shepherd).toEqual({
      agent_key: 'shepherd', instructions: 'Prioritize crisis flags.',
      tasks: ['Review queue AM', 'Review queue PM'], updated_at: '2026-08-01T00:00:00.000Z',
    });
  });
});

describe('PUT /api/workos/agent-settings', () => {
  it('403s a caller without agents.manage even if they hold agents.view', async () => {
    const handler = (await import('./_agent-settings.js')).default;
    const supabase = withPermissions(['agents.view']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('PUT', { agent_key: 'grace', instructions: 'x', tasks: [] }), res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('400s an unknown agent_key rather than silently writing a garbage row', async () => {
    const handler = (await import('./_agent-settings.js')).default;
    const supabase = withPermissions(['agents.manage']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('PUT', { agent_key: 'not-a-real-agent', instructions: 'x', tasks: [] }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'unknown_agent_key' }));
    const upsertCalls = supabase.__calls.filter(c => c.table === 'agent_configs' && c.op === 'upsert');
    expect(upsertCalls).toHaveLength(0);
  });

  it('upserts instructions/tasks and audits the change for a valid agent_key', async () => {
    const handler = (await import('./_agent-settings.js')).default;
    const supabase = withPermissions(['agents.manage'], {
      agent_configs: (op: string) => {
        if (op === 'select') return { data: { instructions: null, tasks: [] } }; // "before" lookup
        return { data: { agent_key: 'verity', instructions: 'Flag anomalies over $500.', tasks: ['Reconcile weekly'], updated_at: '2026-08-24T00:00:00.000Z' } };
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('PUT', { agent_key: 'verity', instructions: 'Flag anomalies over $500.', tasks: ['Reconcile weekly'] }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.config.agent_key).toBe('verity');
    expect(body.config.instructions).toBe('Flag anomalies over $500.');

    const upsertCall = supabase.__calls.find(c => c.table === 'agent_configs' && c.op === 'upsert');
    expect(upsertCall).toBeDefined();
    expect((upsertCall!.payload as { agent_key: string }).agent_key).toBe('verity');
    expect((upsertCall!.payload as { church_id: string }).church_id).toBe(FIXTURE_CHURCH_ID);

    const auditInsert = supabase.__calls.find(c => c.table === 'audit_logs' && c.op === 'insert');
    expect(auditInsert).toBeDefined();
    expect((auditInsert!.payload as { action: string }).action).toBe('agent_settings_updated');
  });

  it('rejects a request body with an oversized task list', async () => {
    const handler = (await import('./_agent-settings.js')).default;
    const supabase = withPermissions(['agents.manage']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    const tooManyTasks = Array.from({ length: 31 }, (_, i) => `Task ${i}`);
    await handler(makeReq('PUT', { agent_key: 'grace', instructions: '', tasks: tooManyTasks }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
