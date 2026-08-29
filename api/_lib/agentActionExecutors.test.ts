/**
 * Executors are the only place an agent proposal becomes a real change,
 * so their preconditions are the safety property worth testing hardest.
 * The interesting cases are all "the world moved between propose and
 * approve" — an approval can sit for days.
 */
import { describe, it, expect } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import {
  executeAgentAction,
  isExecutableActionType,
  listExecutableActionTypes,
  type AgentActionRow,
} from './agentActionExecutors.js';
import { FIXTURE_CHURCH_ID } from '../../tests/fixtures/shared-platform.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';
const WORK_ORDER_ID = '00000000-0000-4000-8000-000000000002';

function action(overrides: Partial<AgentActionRow> = {}): AgentActionRow {
  return {
    id: 'action-1',
    church_id: FIXTURE_CHURCH_ID,
    action_type: 'assign_work_order_owner',
    target_entity_type: 'work_order',
    target_entity_id: WORK_ORDER_ID,
    payload: { owner_user_id: OWNER_ID },
    ...overrides,
  };
}

describe('executor registry', () => {
  it('recognises a registered action type and rejects an unregistered one', () => {
    expect(isExecutableActionType('assign_work_order_owner')).toBe(true);
    expect(isExecutableActionType('flag_overdue_task')).toBe(false);
    expect(listExecutableActionTypes()).toContain('assign_work_order_owner');
  });

  it('never throws for an unknown action type — it reports a reason', async () => {
    const supabase = createMockSupabase({ tables: {} });
    const result = await executeAgentAction(supabase as never, action({ action_type: 'not_a_thing' }));
    expect(result).toEqual({ ok: false, reason: 'no_executor_for_not_a_thing' });
  });
});

describe('assign_work_order_owner', () => {
  it('assigns the proposed owner when the Work Order is still unowned and the owner is active', async () => {
    const supabase = createMockSupabase({
      tables: {
        work_orders: (op: string) => (op === 'select'
          ? { data: { id: WORK_ORDER_ID, owner_user_id: null, status: 'planning' } }
          : { data: { id: WORK_ORDER_ID, owner_user_id: OWNER_ID } }),
        users: () => ({ data: { id: OWNER_ID, account_status: 'active' } }),
      },
    });

    const result = await executeAgentAction(supabase as never, action());

    expect(result.ok).toBe(true);
    const updates = supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update');
    expect(updates).toHaveLength(1);
    expect((updates[0].payload as Record<string, unknown>).owner_user_id).toBe(OWNER_ID);
  });

  it('reports the mutation so the caller can audit the entity that changed', async () => {
    const supabase = createMockSupabase({
      tables: {
        work_orders: (op: string) => (op === 'select'
          ? { data: { id: WORK_ORDER_ID, owner_user_id: null, status: 'planning' } }
          : { data: { id: WORK_ORDER_ID, owner_user_id: OWNER_ID } }),
        users: () => ({ data: { id: OWNER_ID, account_status: 'active' } }),
      },
    });

    const result = await executeAgentAction(supabase as never, action());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mutation).toEqual({
      entityType: 'work_order',
      entityId: WORK_ORDER_ID,
      before: { owner_user_id: null },
      after: { owner_user_id: OWNER_ID },
    });
  });

  it('does not report success when the write changed nothing (lost race)', async () => {
    // The precondition read passes, but the conditional update matches zero
    // rows because another decision got there first. supabase-js reports no
    // error for a zero-row update, so without re-reading the written row
    // the executor would claim it assigned an owner it did not assign.
    const supabase = createMockSupabase({
      tables: {
        work_orders: (op: string) => (op === 'select'
          ? { data: { id: WORK_ORDER_ID, owner_user_id: null, status: 'planning' } }
          : { data: null }),
        users: () => ({ data: { id: OWNER_ID, account_status: 'active' } }),
      },
    });

    const result = await executeAgentAction(supabase as never, action());

    expect(result).toEqual({ ok: false, reason: 'already_owned' });
  });

  it('refuses when a human assigned an owner between proposal and approval', async () => {
    // The deliberate human choice wins. An approved-but-stale proposal
    // must never overwrite it.
    const supabase = createMockSupabase({
      tables: {
        work_orders: () => ({ data: { id: WORK_ORDER_ID, owner_user_id: 'someone-else', status: 'planning' } }),
        users: () => ({ data: { id: OWNER_ID, account_status: 'active' } }),
      },
    });

    const result = await executeAgentAction(supabase as never, action());

    expect(result).toEqual({ ok: false, reason: 'already_owned' });
    expect(supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update')).toHaveLength(0);
  });

  it('refuses when the Work Order was completed or cancelled meanwhile', async () => {
    for (const status of ['completed', 'cancelled']) {
      const supabase = createMockSupabase({
        tables: {
          work_orders: () => ({ data: { id: WORK_ORDER_ID, owner_user_id: null, status } }),
          users: () => ({ data: { id: OWNER_ID, account_status: 'active' } }),
        },
      });
      const result = await executeAgentAction(supabase as never, action());
      expect(result).toEqual({ ok: false, reason: `work_order_${status}` });
    }
  });

  it('refuses when the proposed owner is no longer active', async () => {
    const supabase = createMockSupabase({
      tables: {
        work_orders: () => ({ data: { id: WORK_ORDER_ID, owner_user_id: null, status: 'planning' } }),
        users: () => ({ data: { id: OWNER_ID, account_status: 'suspended' } }),
      },
    });

    const result = await executeAgentAction(supabase as never, action());

    expect(result).toEqual({ ok: false, reason: 'owner_not_active' });
    expect(supabase.__calls.filter(c => c.table === 'work_orders' && c.op === 'update')).toHaveLength(0);
  });

  it('refuses when the proposed owner does not belong to this church', async () => {
    const supabase = createMockSupabase({
      tables: {
        work_orders: () => ({ data: { id: WORK_ORDER_ID, owner_user_id: null, status: 'planning' } }),
        users: () => ({ data: null }),
      },
    });

    const result = await executeAgentAction(supabase as never, action());

    expect(result).toEqual({ ok: false, reason: 'owner_not_in_church' });
  });

  it('refuses a malformed proposal rather than guessing', async () => {
    const supabase = createMockSupabase({ tables: {} });

    expect(await executeAgentAction(supabase as never, action({ payload: {} })))
      .toEqual({ ok: false, reason: 'no_proposed_owner' });
    expect(await executeAgentAction(supabase as never, action({ target_entity_id: null })))
      .toEqual({ ok: false, reason: 'no_target_work_order' });
  });
});
