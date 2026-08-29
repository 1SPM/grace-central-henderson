/**
 * Executors are the only place an agent proposal becomes a real change.
 *
 * WHAT MOVED, AND WHY THESE TESTS LOOK DIFFERENT NOW
 *
 * The preconditions this file used to test ("a human assigned an owner
 * meanwhile", "the Work Order was cancelled", "the proposed owner left")
 * are no longer evaluated in TypeScript. Migration 070 moved them into
 * `agent_execute_assign_work_order_owner`, under row locks, in the same
 * transaction as the writes they guard — which is the only way the
 * mutation and its audit row can commit or fail together.
 *
 * They are exercised for real in tools/agent-atomic-audit-smoke.test.ts
 * against a live database. That file SKIPS without staging credentials,
 * so on a default CI run those preconditions are covered by nothing here.
 * Saying so plainly is better than a test that mocks a Postgres function
 * and proves only that the mock returns what it was told to.
 *
 * What IS testable here, and is: the call contract. That the parameters
 * reach the function, that a refusal never reads as success, that an
 * unrecognised result fails closed, and — the deploy-ordering trap — that
 * code running ahead of migration 070 fails loudly instead of quietly
 * falling back to the non-atomic path it was built to replace.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  executeAgentAction,
  isExecutableActionType,
  listExecutableActionTypes,
  ASSIGN_OWNER_RPC,
  type AgentActionRow,
  type ExecutorContext,
} from './agentActionExecutors.js';
import { FIXTURE_CHURCH_ID } from '../../tests/fixtures/shared-platform.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';
const WORK_ORDER_ID = '00000000-0000-4000-8000-000000000002';
const ACTION_ID = '00000000-0000-4000-8000-000000000003';
const APPROVAL_ID = '00000000-0000-4000-8000-000000000004';
const CORRELATION_ID = '00000000-0000-4000-8000-000000000005';

function action(overrides: Partial<AgentActionRow> = {}): AgentActionRow {
  return {
    id: ACTION_ID,
    church_id: FIXTURE_CHURCH_ID,
    action_type: 'assign_work_order_owner',
    target_entity_type: 'work_order',
    target_entity_id: WORK_ORDER_ID,
    payload: { owner_user_id: OWNER_ID },
    ...overrides,
  };
}

function context(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    approvalId: APPROVAL_ID,
    actorUserId: 'decider-user-id',
    actorClerkId: 'user_clerk_decider',
    correlationId: CORRELATION_ID,
    reason: 'Agent proposal approved (proposed by verity)',
    sourceApp: 'admin_dashboard',
    route: '/api/approvals',
    method: 'PATCH',
    executedAt: '2026-08-28T12:00:00.000Z',
    ...overrides,
  };
}

/** Minimal client exposing only what an atomic executor uses. */
function rpcClient(response: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: response.data ?? null, error: response.error ?? null });
  return { client: { rpc } as never, rpc };
}

describe('executor registry', () => {
  it('recognises a registered action type and rejects an unregistered one', () => {
    expect(isExecutableActionType('assign_work_order_owner')).toBe(true);
    expect(isExecutableActionType('flag_overdue_task')).toBe(false);
    expect(listExecutableActionTypes()).toContain('assign_work_order_owner');
  });

  it('never throws for an unknown action type — it reports a reason', async () => {
    const { client } = rpcClient({ data: null });
    const result = await executeAgentAction(client, action({ action_type: 'not_a_thing' }), context());
    expect(result).toEqual({ ok: false, reason: 'no_executor_for_not_a_thing' });
  });
});

describe('assign_work_order_owner — atomic execution', () => {
  it('passes the decider, the approval link and the correlation id to the function', async () => {
    // The audit row is written INSIDE the function, so anything missing
    // from these parameters is missing from the audit trail — there is no
    // second chance to add it afterwards.
    const { client, rpc } = rpcClient({
      data: { ok: true, detail: 'Assigned', work_order_id: WORK_ORDER_ID, owner_user_id: OWNER_ID },
    });

    await executeAgentAction(client, action(), context());

    expect(rpc).toHaveBeenCalledWith(ASSIGN_OWNER_RPC, expect.objectContaining({
      p_action_id: ACTION_ID,
      p_church_id: FIXTURE_CHURCH_ID,
      p_approval_id: APPROVAL_ID,
      p_actor_user_id: 'decider-user-id',
      p_actor_clerk_id: 'user_clerk_decider',
      p_correlation_id: CORRELATION_ID,
      p_reason: 'Agent proposal approved (proposed by verity)',
      p_source_app: 'admin_dashboard',
      p_route: '/api/approvals',
      p_method: 'PATCH',
      p_executed_at: '2026-08-28T12:00:00.000Z',
    }));
  });

  it('reports the mutation and claims the status and audit writes as already done', async () => {
    const { client } = rpcClient({
      data: {
        ok: true,
        detail: `Assigned owner ${OWNER_ID} to work order ${WORK_ORDER_ID}`,
        work_order_id: WORK_ORDER_ID,
        owner_user_id: OWNER_ID,
      },
    });

    const result = await executeAgentAction(client, action(), context());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // committedStatusAndAudit is what stops the caller writing a second
    // audit row for the same change. If it ever stops being set on the
    // success path, every atomic execution gets double-recorded.
    expect(result.committedStatusAndAudit).toBe(true);
    expect(result.mutation).toEqual({
      entityType: 'work_order',
      entityId: WORK_ORDER_ID,
      before: { owner_user_id: null },
      after: { owner_user_id: OWNER_ID },
    });
  });

  it('surfaces a precondition refusal with the reason the function gave', async () => {
    for (const reason of ['already_owned', 'owner_not_active', 'work_order_cancelled', 'no_proposed_owner']) {
      const { client } = rpcClient({ data: { ok: false, reason } });
      const result = await executeAgentAction(client, action(), context());
      expect(result).toEqual({ ok: false, reason });
    }
  });

  it('fails loudly when migration 070 has not been applied', async () => {
    // The deploy-ordering trap. The tempting alternative — fall back to
    // the old read-then-write path — would silently give up atomicity on
    // exactly the deploy where nobody is watching for it.
    for (const error of [
      { code: 'PGRST202', message: 'Could not find the function public.agent_execute_assign_work_order_owner' },
      { code: '42883', message: 'function does not exist' },
      { code: undefined, message: 'Could not find the function in the schema cache' },
    ]) {
      const { client } = rpcClient({ error });
      const result = await executeAgentAction(client, action(), context());
      expect(result).toEqual({ ok: false, reason: 'atomic_executor_unavailable' });
    }
  });

  it('treats a raised exception as a failure, because it rolled everything back', async () => {
    // This is the case the whole design exists for: the audit insert
    // failed and took the owner assignment down with it. Nothing changed,
    // so the only correct outcome is a failure the decider can see.
    const { client } = rpcClient({
      error: { code: '23514', message: 'new row for relation "audit_logs" violates check constraint' },
    });

    const result = await executeAgentAction(client, action(), context());

    expect(result).toEqual({ ok: false, reason: 'atomic_execution_failed' });
  });

  it('fails closed on a result it cannot read rather than assuming success', async () => {
    for (const data of [null, {}, { ok: 'yes' }, { ok: true }, { ok: true, work_order_id: WORK_ORDER_ID }]) {
      const { client } = rpcClient({ data });
      const result = await executeAgentAction(client, action(), context());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('atomic_execution_malformed_result');
    }
  });
});
