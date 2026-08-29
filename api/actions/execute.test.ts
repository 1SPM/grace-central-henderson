/**
 * The immediate-execution door (TD-061, second half).
 *
 * Two properties matter here, and they pull in opposite directions:
 *
 *  1. It must actually DO the thing — server-side, so it produces an audit
 *     row a client cannot skip.
 *  2. It must REFUSE anything the catalog says needs a human decision.
 *
 * (2) is the one worth engineering against: an endpoint that quietly runs a
 * gated action routes straight around the approvals lifecycle that
 * api/actions/propose exists to enforce.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

const TASK_ID = '00000000-0000-4000-8000-0000000000c1';

function makeReq(body: unknown) {
  return {
    method: 'POST', query: {},
    headers: { authorization: 'Bearer valid-token' },
    body,
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

function supabaseFor(opts: { permission?: string; taskMissing?: boolean; deleteHitsNothing?: boolean } = {}) {
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: [{ permissions: { key: opts.permission ?? 'tasks.manage' } }] }),
      tasks: (op: string) => {
        if (op === 'select') {
          return opts.taskMissing
            ? { data: null }
            : { data: { id: TASK_ID, title: 'Call the Riveras', person_id: null, due_date: '2026-09-01', priority: 'medium', completed: false } };
        }
        return { data: opts.deleteHitsNothing ? null : { id: TASK_ID } };
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

async function execute(supabase: ReturnType<typeof supabaseFor>, body: unknown) {
  const handler = (await import('./_execute.js')).default;
  const { createClient } = await import('@supabase/supabase-js');
  vi.mocked(createClient).mockReturnValue(supabase as never);
  const res = makeRes();
  await handler(makeReq(body), res);
  return res;
}

const body = (over: Record<string, unknown> = {}) =>
  ({ action_type: 'delete_task', target_entity_id: TASK_ID, ...over });

describe('POST /api/actions/execute', () => {
  it('deletes the task and writes an audit row carrying what was lost', async () => {
    const supabase = supabaseFor();
    const res = await execute(supabase, body());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(supabase.__calls.filter(c => c.table === 'tasks' && c.op === 'delete')).toHaveLength(1);

    const audits = supabase.__calls.filter(c => c.table === 'audit_logs' && c.op === 'insert');
    expect(audits).toHaveLength(1);
    const row = audits[0].payload as Record<string, unknown>;
    expect(row.entity_type).toBe('task');
    expect(row.entity_id).toBe(TASK_ID);
    expect(row.after).toBeNull();
    // The snapshot is the whole point: after the delete there is nothing left
    // to describe, so an audit row without `before` records that something
    // was deleted while being unable to say what.
    expect((row.before as Record<string, unknown>).title).toBe('Call the Riveras');
  });

  it('REFUSES an action the catalog says needs approval', async () => {
    // delete_person is gated. Running it here would bypass the pastor.
    const supabase = supabaseFor({ permission: 'people.manage' });
    const res = await execute(supabase, body({ action_type: 'delete_person' }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json.mock.calls.at(-1)?.[0] as { error: string }).error).toBe('action_requires_approval');
    expect(supabase.__calls.filter(c => c.op === 'delete')).toHaveLength(0);
  });

  it('refuses a catalog action that has no executor', async () => {
    // add_task is ungated but not server-executable. Returning success for
    // an action nothing performed would be the worst possible answer.
    const supabase = supabaseFor();
    const res = await execute(supabase, body({ action_type: 'add_task' }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json.mock.calls.at(-1)?.[0] as { error: string }).error).toBe('action_not_directly_executable');
  });

  it('refuses a caller without the action permission', async () => {
    const supabase = supabaseFor({ permission: 'care.view' });
    const res = await execute(supabase, body());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(supabase.__calls.filter(c => c.table === 'tasks' && c.op === 'delete')).toHaveLength(0);
  });

  it('reports a refusal instead of claiming success', async () => {
    const supabase = supabaseFor({ taskMissing: true });
    const res = await execute(supabase, body());

    expect(res.status).toHaveBeenCalledWith(409);
    expect((res.json.mock.calls.at(-1)?.[0] as { reason: string }).reason).toBe('task_not_found');
    expect(supabase.__calls.filter(c => c.table === 'audit_logs' && c.op === 'insert')).toHaveLength(0);
  });

  it('does not report success for a delete that changed nothing', async () => {
    // supabase-js reports no error for a zero-row delete, so without
    // re-reading the written row this would claim a deletion that never
    // happened — the same trap PR #166 fixed on the work-order path.
    const supabase = supabaseFor({ deleteHitsNothing: true });
    const res = await execute(supabase, body());

    expect(res.status).toHaveBeenCalledWith(409);
    expect((res.json.mock.calls.at(-1)?.[0] as { reason: string }).reason).toBe('task_already_removed');
  });

  it('rejects an unknown action type', async () => {
    const supabase = supabaseFor();
    const res = await execute(supabase, body({ action_type: 'drop_database' }));
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
