/**
 * Route tests for the agent-action approvals consumer.
 *
 * This closes the loop PR #153 deliberately left open: an agent proposes,
 * an approvals row carries it to a human, and the decision — and only the
 * decision — turns it into a change. The properties worth pinning:
 *
 *  - a favourable decision executes the action exactly once
 *  - an unfavourable decision rejects it and mutates nothing
 *  - a failed execution is recorded as 'failed' with a reason, never
 *    silently reported as done
 *  - deciding twice cannot execute twice
 *
 * SINCE MIGRATION 070 the execution itself is one Postgres function call,
 * so the assertions moved with it. The endpoint no longer writes the
 * work_orders row, the agent_actions status, or the mutation's audit row
 * on the success path — the function commits all three together. What
 * this file now guards is that the endpoint does NOT repeat any of them
 * (a second audit row would double-record one change) while still doing
 * all of it on the paths where the function did nothing.
 *
 * What a mocked RPC cannot prove is what happens inside the transaction.
 * That is tools/agent-atomic-audit-smoke.test.ts, against a real database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';
import { ASSIGN_OWNER_RPC } from '../_lib/agentActionExecutors.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

const APPROVAL_ID = '00000000-0000-4000-8000-0000000000a1';
const ACTION_ID = '00000000-0000-4000-8000-0000000000a2';
const WORK_ORDER_ID = '00000000-0000-4000-8000-0000000000a3';
const OWNER_ID = '00000000-0000-4000-8000-0000000000a4';

function makeReq(decision: string) {
  return {
    method: 'PATCH',
    query: { id: APPROVAL_ID },
    headers: { authorization: 'Bearer valid-token' },
    body: { decision },
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

const PENDING_APPROVAL = {
  id: APPROVAL_ID,
  church_id: FIXTURE_CHURCH_ID,
  entity_type: 'agent_action',
  entity_id: ACTION_ID,
  status: 'pending',
  work_order_id: null,
  requested_by_agent: 'verity',
};

const PROPOSED_ACTION = {
  id: ACTION_ID,
  church_id: FIXTURE_CHURCH_ID,
  action_type: 'assign_work_order_owner',
  target_entity_type: 'work_order',
  target_entity_id: WORK_ORDER_ID,
  payload: { owner_user_id: OWNER_ID, work_order_title: 'Youth retreat planning' },
  status: 'proposed',
};

/** What migration 070's function returns when it did the work. */
const RPC_EXECUTED = {
  ok: true,
  detail: `Assigned owner ${OWNER_ID} to work order ${WORK_ORDER_ID}`,
  work_order_id: WORK_ORDER_ID,
  owner_user_id: OWNER_ID,
};

function supabaseFor(opts: {
  approvalStatus?: string;
  actionStatus?: string;
  /** Stand in for whatever the function decided — refusal or breakage. */
  rpcResult?: { data?: unknown; error?: { message: string; code?: string } };
} = {}) {
  return createMockSupabase({
    rpcs: {
      [ASSIGN_OWNER_RPC]: () => opts.rpcResult ?? { data: RPC_EXECUTED },
    },
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: [{ permissions: { key: 'approvals.decide' } }] }),
      approvals: (op: string) => {
        if (op === 'select') {
          return { data: { ...PENDING_APPROVAL, status: opts.approvalStatus ?? 'pending' } };
        }
        return { data: { ...PENDING_APPROVAL, status: 'decided', decision: 'approve' } };
      },
      agent_actions: (op: string) => {
        if (op === 'select') {
          return { data: { ...PROPOSED_ACTION, status: opts.actionStatus ?? 'proposed', approval_id: APPROVAL_ID, requires_approval: true } };
        }
        // The non-atomic status write-back is conditional + re-read, so it
        // must resolve a row for a successful write.
        return { data: { id: ACTION_ID } };
      },
      work_orders: () => ({ data: { id: WORK_ORDER_ID, owner_user_id: null, status: 'planning' } }),
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

async function decide(supabase: ReturnType<typeof supabaseFor>, decision: string) {
  const handler = (await import('./_index.js')).default;
  const { createClient } = await import('@supabase/supabase-js');
  vi.mocked(createClient).mockReturnValue(supabase as never);
  const res = makeRes();
  await handler(makeReq(decision), res);
  return res;
}

const rpcCalls = (supabase: ReturnType<typeof supabaseFor>) =>
  supabase.__calls.filter(c => c.table === ASSIGN_OWNER_RPC && c.op === 'rpc');
const auditInserts = (supabase: ReturnType<typeof supabaseFor>) =>
  supabase.__calls.filter(c => c.table === 'audit_logs' && c.op === 'insert');
const actionUpdates = (supabase: ReturnType<typeof supabaseFor>) =>
  supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'update');

describe('PATCH /api/approvals — agent action execution', () => {
  it('a favourable decision executes the action exactly once and reports it executed', async () => {
    const supabase = supabaseFor();
    const res = await decide(supabase, 'approve');

    expect(rpcCalls(supabase)).toHaveLength(1);
    const body = res.json.mock.calls.at(-1)?.[0] as { agent_action?: { status: string } };
    expect(body.agent_action?.status).toBe('executed');
  });

  it('does not repeat the writes the function already committed', async () => {
    // The whole value of migration 070 is that the mutation, the status
    // write and the audit row share one transaction. Writing any of them
    // again here would double-record the change and defeat the point.
    const supabase = supabaseFor();
    await decide(supabase, 'approve');

    expect(supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update')).toHaveLength(0);
    expect(actionUpdates(supabase)).toHaveLength(0);
    const entityTypes = auditInserts(supabase).map(a => (a.payload as Record<string, unknown>).entity_type);
    expect(entityTypes).toContain('approval'); // the decision is still audited here
    expect(entityTypes, 'the mutation audit belongs to the transaction, not this handler')
      .not.toContain('work_order');
  });

  it('hands the function everything the audit row needs, including the shared correlation id', async () => {
    // The mutation's audit row is written inside the function, so anything
    // missing from these parameters is missing from the trail permanently.
    // The correlation id in particular must match the decision's own audit
    // row, or the chain cannot be read back as one operation.
    const supabase = supabaseFor();
    await decide(supabase, 'approve');

    const params = rpcCalls(supabase)[0].payload as Record<string, unknown>;
    expect(params.p_action_id).toBe(ACTION_ID);
    expect(params.p_church_id).toBe(FIXTURE_CHURCH_ID);
    expect(params.p_approval_id).toBe(APPROVAL_ID);
    expect(params.p_actor_user_id).toBe(FIXTURE_STAFF_USER.id);
    // The deciding human is the actor; the proposing agent is named in the
    // reason, so both halves of "who did this" survive on one row.
    expect(String(params.p_reason)).toContain('verity');

    const approvalAudit = auditInserts(supabase)
      .find(a => (a.payload as Record<string, unknown>).entity_type === 'approval')!
      .payload as Record<string, unknown>;
    expect(params.p_correlation_id).toBe(approvalAudit.correlation_id);
    expect(params.p_correlation_id).toBeTruthy();
  });

  it('an unfavourable decision rejects the action and never calls the function', async () => {
    for (const decision of ['reject', 'return_for_revision', 'escalate']) {
      const supabase = supabaseFor();
      await decide(supabase, decision);

      expect(rpcCalls(supabase), decision).toHaveLength(0);
      expect(actionUpdates(supabase), decision).toHaveLength(1);
      expect((actionUpdates(supabase)[0].payload as Record<string, unknown>).status).toBe('rejected');
    }
  });

  it('records a refused execution as failed with the reason the function gave', async () => {
    // A precondition the function refused on — e.g. the Work Order gained
    // an owner between proposal and approval. It wrote nothing, so the
    // endpoint owes the 'failed' status write.
    const supabase = supabaseFor({ rpcResult: { data: { ok: false, reason: 'already_owned' } } });
    const res = await decide(supabase, 'approve');

    const updates = actionUpdates(supabase);
    expect(updates).toHaveLength(1);
    expect((updates[0].payload as Record<string, unknown>).status).toBe('failed');
    expect((updates[0].payload as Record<string, unknown>).executed_at).toBeNull();

    const body = res.json.mock.calls.at(-1)?.[0] as { agent_action?: { status: string; reason?: string } };
    expect(body.agent_action?.status).toBe('failed');
    expect(body.agent_action?.reason).toBe('already_owned');
  });

  it('writes no mutation audit when the execution refused', async () => {
    const supabase = supabaseFor({ rpcResult: { data: { ok: false, reason: 'already_owned' } } });
    await decide(supabase, 'approve');

    expect(auditInserts(supabase).map(a => (a.payload as Record<string, unknown>).entity_type))
      .not.toContain('work_order');
  });

  it('fails loudly, not silently, when migration 070 is missing', async () => {
    // Code deployed ahead of the migration. This must read as a failure
    // the decider can see — not as a quiet fallback to the non-atomic
    // path, and above all not as a success.
    const supabase = supabaseFor({
      rpcResult: { error: { code: 'PGRST202', message: 'Could not find the function' } },
    });
    const res = await decide(supabase, 'approve');

    const body = res.json.mock.calls.at(-1)?.[0] as { agent_action?: { status: string; reason?: string } };
    expect(body.agent_action?.status).toBe('failed');
    expect(body.agent_action?.reason).toBe('atomic_executor_unavailable');
    expect(supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update')).toHaveLength(0);
  });

  it('an already-decided approval 409s and cannot execute a second time', async () => {
    const supabase = supabaseFor({ approvalStatus: 'decided' });
    const res = await decide(supabase, 'approve');

    expect(res.status).toHaveBeenCalledWith(409);
    expect(rpcCalls(supabase)).toHaveLength(0);
    expect(actionUpdates(supabase)).toHaveLength(0);
  });

  it('does not re-execute an action that is no longer proposed', async () => {
    const supabase = supabaseFor({ actionStatus: 'executed' });
    await decide(supabase, 'approve');

    expect(rpcCalls(supabase)).toHaveLength(0);
    expect(actionUpdates(supabase)).toHaveLength(0);
  });
});
