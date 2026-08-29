/**
 * The chat door's approval gate (TD-061).
 *
 * The property under test is a negative one, which is the hard kind to keep:
 * this endpoint must NEVER perform the action. It records a request and
 * stops. Everything else here — the permission check, the catalog lookup,
 * the duplicate refusal — exists to make that record trustworthy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

const PERSON_ID = '00000000-0000-4000-8000-0000000000b1';
const ACTION_ID = '00000000-0000-4000-8000-0000000000b2';
const APPROVAL_ID = '00000000-0000-4000-8000-0000000000b3';

function makeReq(body: unknown) {
  return {
    method: 'POST',
    query: {},
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

function supabaseFor(opts: { permission?: string; existingProposal?: boolean } = {}) {
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: [{ permissions: { key: opts.permission ?? 'people.manage' } }] }),
      agent_actions: (op: string) => {
        if (op === 'select') return { data: opts.existingProposal ? { id: ACTION_ID, approval_id: APPROVAL_ID } : null };
        return { data: { id: ACTION_ID } };
      },
      approvals: () => ({ data: { id: APPROVAL_ID } }),
      people: () => ({ data: { id: PERSON_ID, first_name: 'Dana', last_name: 'Reyes' } }),
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

async function propose(supabase: ReturnType<typeof supabaseFor>, body: unknown) {
  const handler = (await import('./_propose.js')).default;
  const { createClient } = await import('@supabase/supabase-js');
  vi.mocked(createClient).mockReturnValue(supabase as never);
  const res = makeRes();
  await handler(makeReq(body), res);
  return res;
}

const body = (over: Record<string, unknown> = {}) => ({
  action_type: 'delete_person',
  target_entity_id: PERSON_ID,
  payload: { person_name: 'Dana Reyes' },
  ...over,
});

describe('POST /api/actions/propose', () => {
  it('records a proposal and does NOT delete anyone', async () => {
    const supabase = supabaseFor();
    const res = await propose(supabase, body());

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls.at(-1)?.[0] as { status: string; approval_id: string };
    expect(payload.status).toBe('pending_approval');

    // The whole point. Nothing was carried out.
    expect(supabase.__calls.filter(c => c.table === 'people' && c.op === 'delete')).toHaveLength(0);

    const actionInsert = supabase.__calls.find(c => c.table === 'agent_actions' && c.op === 'insert');
    const row = actionInsert?.payload as Record<string, unknown>;
    expect(row.status).toBe('proposed');
    expect(row.requires_approval).toBe(true);
    expect(row.origin_surface).toBe('chat');
    expect(row.agent_run_id, 'a chat proposal has no agent run — migration 071').toBeNull();
    expect(row.proposed_by_user_id).toBe(FIXTURE_STAFF_USER.id);
  });

  it('audits the request itself, before anything has changed', async () => {
    // If the proposal is later rejected, this row is the only place the
    // asking survives.
    const supabase = supabaseFor();
    await propose(supabase, body());

    const audits = supabase.__calls.filter(c => c.table === 'audit_logs' && c.op === 'insert');
    expect(audits).toHaveLength(1);
    const row = audits[0].payload as Record<string, unknown>;
    expect(row.action).toBe('propose');
    expect(row.entity_type).toBe('agent_action');
  });

  it('refuses a caller without the catalog permission for that action', async () => {
    // The gate the chat door never had. delete_person needs people.manage.
    const supabase = supabaseFor({ permission: 'tasks.manage' });
    const res = await propose(supabase, body());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'insert')).toHaveLength(0);
    expect(supabase.__calls.filter(c => c.table === 'approvals' && c.op === 'insert')).toHaveLength(0);
  });

  it('refuses an action the catalog says runs immediately', async () => {
    // Smuggling an ungated action into the queue would leave it sitting
    // there unexecuted forever — it has no approval path to come back out.
    const supabase = supabaseFor();
    const res = await propose(supabase, body({ action_type: 'add_task' }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls.at(-1)?.[0]).toEqual({ error: 'action_does_not_require_approval' });
  });

  it('refuses an unknown action type', async () => {
    const supabase = supabaseFor();
    const res = await propose(supabase, body({ action_type: 'drop_database' }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls.at(-1)?.[0]).toEqual({ error: 'unknown_action_type' });
  });

  it('does not stack a second identical proposal on the same pastor', async () => {
    const supabase = supabaseFor({ existingProposal: true });
    const res = await propose(supabase, body());

    expect(res.status).toHaveBeenCalledWith(200);
    expect((res.json.mock.calls.at(-1)?.[0] as { status: string }).status).toBe('already_pending');
    expect(supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'insert')).toHaveLength(0);
  });

  it('rejects a request with no target', async () => {
    const supabase = supabaseFor();
    const res = await propose(supabase, body({ target_entity_id: undefined }));
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
