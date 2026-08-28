/**
 * Agent action executors — the half of the approvals pipeline that
 * actually performs an approved `agent_actions` row.
 *
 * The contract, and why it is shaped this way:
 *
 * 1. An agent never mutates product data directly. It emits a finding with
 *    `requires_approval: true` (see AgentFinding in agentWorkflows.ts).
 *    The run endpoint records that as an `agent_actions` row with
 *    status 'proposed' and creates a linked `approvals` row.
 * 2. Nothing happens until a human with `approvals.decide` decides it.
 * 3. Only then does the matching executor here run.
 *
 * **An action_type with no executor here can never be proposed.** The run
 * endpoint refuses the run outright (see _workos-run.ts). That is
 * deliberate: proposing something the system cannot perform would put an
 * un-actionable item in a pastor's Decision Queue, and "approve" would
 * silently do nothing — worse than failing loudly at the source.
 *
 * Executors must be:
 * - **Idempotent-safe.** A decision can only be applied once (the endpoint
 *   409s on an already-decided approval), but an executor should still
 *   guard its own precondition rather than assume it.
 * - **Precondition-checked at execution time, not proposal time.** Minutes
 *   or days can pass between propose and approve. The world may have moved:
 *   the Work Order may have been assigned by hand, the proposed owner may
 *   have left. Re-verify and refuse rather than force.
 * - **Non-throwing.** Return a reason; the caller records 'failed' and
 *   surfaces it. An executor that throws would leave the approval decided
 *   and the action in limbo.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgentActionRow {
  id: string;
  church_id: string;
  action_type: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  payload: Record<string, unknown>;
}

export type ExecutorResult =
  | { ok: true; detail: string }
  | { ok: false; reason: string };

type Executor = (supabase: SupabaseClient, action: AgentActionRow) => Promise<ExecutorResult>;

/**
 * Assign the accountable human for a Work Order's ministry as its owner.
 *
 * Proposed by Verity when it finds an open Work Order with no owner and
 * the ministry has a named owner in `ministry_assignments`. Reversible by
 * hand in the Work Order detail view, which is part of why it is a
 * reasonable first executor: the worst case is a wrong-but-visible owner,
 * not lost or corrupted data.
 */
const assignWorkOrderOwner: Executor = async (supabase, action) => {
  const workOrderId = action.target_entity_id;
  const proposedOwnerId = typeof action.payload.owner_user_id === 'string'
    ? action.payload.owner_user_id
    : null;

  if (!workOrderId) return { ok: false, reason: 'no_target_work_order' };
  if (!proposedOwnerId) return { ok: false, reason: 'no_proposed_owner' };

  // Re-check the precondition: only fill a still-empty owner. If a human
  // assigned someone between proposal and approval, theirs wins — an
  // approved-but-stale proposal must not overwrite a deliberate choice.
  const { data: workOrder, error: readErr } = await supabase
    .from('work_orders')
    .select('id, owner_user_id, status')
    .eq('id', workOrderId)
    .eq('church_id', action.church_id)
    .maybeSingle();
  if (readErr) return { ok: false, reason: 'work_order_read_failed' };
  if (!workOrder) return { ok: false, reason: 'work_order_not_found' };
  if (workOrder.owner_user_id) return { ok: false, reason: 'already_owned' };
  if (['completed', 'cancelled'].includes(workOrder.status)) {
    return { ok: false, reason: `work_order_${workOrder.status}` };
  }

  // Re-check the proposed owner is still an active user in this church.
  const { data: owner, error: ownerErr } = await supabase
    .from('users')
    .select('id, account_status')
    .eq('id', proposedOwnerId)
    .eq('church_id', action.church_id)
    .maybeSingle();
  if (ownerErr) return { ok: false, reason: 'owner_read_failed' };
  if (!owner) return { ok: false, reason: 'owner_not_in_church' };
  if (owner.account_status !== 'active') return { ok: false, reason: 'owner_not_active' };

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ owner_user_id: proposedOwnerId })
    .eq('id', workOrderId)
    .eq('church_id', action.church_id)
    .is('owner_user_id', null); // atomic: lose the race rather than overwrite
  if (updateErr) return { ok: false, reason: 'work_order_update_failed' };

  return { ok: true, detail: `Assigned owner ${proposedOwnerId} to work order ${workOrderId}` };
};

const ACTION_EXECUTORS: Record<string, Executor> = {
  assign_work_order_owner: assignWorkOrderOwner,
};

/** True when an action_type can actually be carried out if approved. */
export function isExecutableActionType(actionType: string): boolean {
  return actionType in ACTION_EXECUTORS;
}

export function listExecutableActionTypes(): string[] {
  return Object.keys(ACTION_EXECUTORS);
}

/**
 * Run the executor for an approved action. Never throws: an unknown type
 * or a thrown executor both come back as `{ ok: false }` so the caller can
 * record 'failed' with a reason instead of losing the outcome.
 */
export async function executeAgentAction(
  supabase: SupabaseClient,
  action: AgentActionRow,
): Promise<ExecutorResult> {
  const executor = ACTION_EXECUTORS[action.action_type];
  if (!executor) return { ok: false, reason: `no_executor_for_${action.action_type}` };
  try {
    return await executor(supabase, action);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'executor_threw' };
  }
}
