/**
 * Handler tests for the nightly WorkOS agent sweep.
 *
 * The run mechanics are covered in api/_lib/workosAgentRunner.test.ts;
 * what is unique to the handler is the auth gate and church-level
 * isolation — one tenant's bad data must not cost every other tenant its
 * nightly scan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq(authorization?: string) {
  return {
    method: 'GET',
    headers: authorization ? { authorization } : {},
  } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & {
    status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>;
  };
}

function supabaseWithChurches(churchIds: string[]) {
  return createMockSupabase({
    tables: {
      churches: () => ({ data: churchIds.map(id => ({ id })) }),
      agent_runs: () => ({ data: { id: 'run-1' } }),
      agent_actions: () => ({ data: null }),
      agent_findings: () => ({ data: [] }),
      platform_events: () => ({ data: { id: 'evt-1' } }),
      cron_runs: () => ({ data: null }),
      tasks: () => ({ data: [] }),
      work_orders: () => ({ data: [] }),
      approvals: () => ({ data: [] }),
      people: () => ({ data: [] }),
      care_requests: () => ({ data: [] }),
      data_subject_requests: () => ({ data: [] }),
      ledger_entries: () => ({ data: [] }),
    },
  });
}

beforeEach(() => {
  vi.resetModules();
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

describe('GET /api/cron/workos-agents', () => {
  it('rejects a request without the cron secret and touches nothing', async () => {
    const handler = (await import('./_workos-agents.js')).default;
    const supabase = supabaseWithChurches(['church-1']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('Bearer wrong-secret'), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(supabase.__calls.filter(c => c.table === 'agent_runs')).toHaveLength(0);
  });

  it('sweeps every church and records the run in the cron ledger', async () => {
    const handler = (await import('./_workos-agents.js')).default;
    const supabase = supabaseWithChurches(['church-1', 'church-2']);
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq('Bearer test-cron-secret'), res);

    const body = res.json.mock.calls.at(-1)?.[0] as { churches: number; agents_run: number; agents_failed: number };
    expect(body.churches).toBe(2);
    // Every implemented agent, for every church.
    const { implementedAgentKeys } = await import('../_lib/workosAgentRunner.js');
    expect(body.agents_run).toBe(implementedAgentKeys().length * 2);
    expect(body.agents_failed).toBe(0);

    // The pastor-facing automation ledger sees this job like any other.
    const ledger = supabase.__calls.filter(c => c.table === 'cron_runs' && c.op === 'insert');
    expect(ledger).toHaveLength(1);
    expect((ledger[0].payload as Record<string, unknown>).job).toBe('workos-agents');
  });

  it('503s when Supabase is not configured rather than half-running', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const handler = (await import('./_workos-agents.js')).default;

    const res = makeRes();
    await handler(makeReq('Bearer test-cron-secret'), res);

    expect(res.status).toHaveBeenCalledWith(503);
  });
});
