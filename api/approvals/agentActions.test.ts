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
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

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

function supabaseFor(opts: {
  approvalStatus?: string;
  actionStatus?: string;
  workOrderOwner?: string | null;
  ownerAccountStatus?: string;
} = {}) {
  return createMockSupabase({
    tables: {
      users: (op: string) => {
        // resolveStaffActor looks the caller up; the executor looks the
        // proposed owner up. Both hit `users`; the executor's row is the
        // one carrying account_status for OWNER_ID.
        if (op === 'select') {
          return { data: { id: FIXTURE_STAFF_USER.id, account_status: opts.ownerAccountStatus ?? 'active' } };
        }
        return { data: null };
      },
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
        // The status write-back is conditional + re-read, so it must
        // resolve a row for a successful write.
        return { data: { id: ACTION_ID } };
      },
      work_orders: (op: string) => {
        if (op === 'select') {
          return {
            data: { id: WORK_ORDER_ID, owner_user_id: opts.workOrderOwner ?? null, status: 'planning' },
          };
        }
        // The executor re-reads the row it wrote so a lost race (zero rows
        // updated) is distinguishable from a successful write.
        return { data: { id: WORK_ORDER_ID, owner_user_id: OWNER_ID } };
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

async function decide(supabase: ReturnType<typeof supabaseFor>, decision: string) {
  const handler = (await import('./_index.js')).default;
  const { createClient } = await import('@supabase/supabase-js');
  vi.mocked(createClient).mockReturnValue(supabase as never);
  const res = makeRes();
  await handler(makeReq(decision), res);
  return res;
}

describe('PATCH /api/approvals — agent action execution', () => {
  it('a favourable decision executes the action and records it as executed', async () => {
    const supabase = supabaseFor();
    const res = await decide(supabase, 'approve');

    // The Work Order was actually assigned — the proposal became a change.
    const woUpdates = supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update');
    expect(woUpdates).toHaveLength(1);
    expect((woUpdates[0].payload as Record<string, unknown>).owner_user_id).toBe(OWNER_ID);

    const actionUpdates = supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'update');
    expect(actionUpdates).toHaveLength(1);
    const payload = actionUpdates[0].payload as Record<string, unknown>;
    expect(payload.status).toBe('executed');
    expect(payload.executed_at).toBeTruthy();

    const body = res.json.mock.calls.at(-1)?.[0] as { agent_action?: { status: string } };
    expect(body.agent_action?.status).toBe('executed');
  });

  it('an unfavourable decision rejects the action and changes nothing', async () => {
    for (const decision of ['reject', 'return_for_revision', 'escalate']) {
      const supabase = supabaseFor();
      await decide(supabase, decision);

      expect(supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update')).toHaveLength(0);
      const actionUpdates = supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'update');
      expect(actionUpdates, decision).toHaveLength(1);
      expect((actionUpdates[0].payload as Record<string, unknown>).status).toBe('rejected');
    }
  });

  it('records a failed execution as failed with a reason rather than reporting success', async () => {
    // The Work Order gained an owner between proposal and approval.
    const supabase = supabaseFor({ workOrderOwner: 'someone-else' });
    const res = await decide(supabase, 'approve');

    expect(supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update')).toHaveLength(0);
    const actionUpdates = supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'update');
    expect(actionUpdates).toHaveLength(1);
    const payload = actionUpdates[0].payload as Record<string, unknown>;
    expect(payload.status).toBe('failed');
    expect(payload.executed_at).toBeNull();

    const body = res.json.mock.calls.at(-1)?.[0] as { agent_action?: { status: string; reason?: string } };
    expect(body.agent_action?.status).toBe('failed');
    expect(body.agent_action?.reason).toBe('already_owned');
  });

  it('audits the Work Order change itself, not only the approval decision', async () => {
    // Without this, an agent-driven assignment would be the only Work Order
    // write in the product with no Work Order audit row — reconstructing
    // what the agent changed would mean chaining approvals -> platform
    // events -> agent_actions.payload, and only if you knew to.
    const supabase = supabaseFor();
    await decide(supabase, 'approve');

    const audits = supabase.__calls.filter(c => c.table === 'audit_logs' && c.op === 'insert');
    const entityTypes = audits.map(a => (a.payload as Record<string, unknown>).entity_type);
    expect(entityTypes).toContain('approval');
    expect(entityTypes, 'the mutated entity must have its own audit row').toContain('work_order');

    const woAudit = audits.find(a => (a.payload as Record<string, unknown>).entity_type === 'work_order')!
      .payload as Record<string, unknown>;
    expect(woAudit.entity_id).toBe(WORK_ORDER_ID);
    expect(woAudit.after).toEqual({ owner_user_id: OWNER_ID });
    expect(woAudit.before).toEqual({ owner_user_id: null });
    // The deciding human is the actor; the agent that proposed it is named
    // in the reason, so both halves of "who did this" survive.
    expect(String(woAudit.reason)).toContain('verity');
    // One correlation id ties decision, event, and mutation together.
    const approvalAudit = audits.find(a => (a.payload as Record<string, unknown>).entity_type === 'approval')!
      .payload as Record<string, unknown>;
    expect(woAudit.correlation_id).toBe(approvalAudit.correlation_id);
  });

  it('writes no mutation audit when the execution refused', async () => {
    const supabase = supabaseFor({ workOrderOwner: 'someone-else' });
    await decide(supabase, 'approve');

    const audits = supabase.__calls.filter(c => c.table === 'audit_logs' && c.op === 'insert');
    expect(audits.map(a => (a.payload as Record<string, unknown>).entity_type)).not.toContain('work_order');
  });

  it('an already-decided approval 409s and cannot execute a second time', async () => {
    const supabase = supabaseFor({ approvalStatus: 'decided' });
    const res = await decide(supabase, 'approve');

    expect(res.status).toHaveBeenCalledWith(409);
    expect(supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update')).toHaveLength(0);
    expect(supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'update')).toHaveLength(0);
  });

  it('does not re-execute an action that is no longer proposed', async () => {
    const supabase = supabaseFor({ actionStatus: 'executed' });
    await decide(supabase, 'approve');

    expect(supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update')).toHaveLength(0);
    expect(supabase.__calls.filter(c => c.table === 'agent_actions' && c.op === 'update')).toHaveLength(0);
  });
});
