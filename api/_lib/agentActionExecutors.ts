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
 *
 * ATOMICITY (migration 070)
 *
 * An executor that mutates church data must commit that mutation, the
 * `agent_actions` status write, and the mutation's `audit_logs` row in ONE
 * transaction. supabase-js cannot express that — every call is its own
 * transaction — so such an executor is a thin wrapper over a Postgres
 * function and the preconditions above live in SQL, not here.
 *
 * That is a deliberate trade. Before 070 the four writes were four
 * commits, and an interruption between the first and the last left church
 * data altered by an agent with no audit row proving what changed. Now it
 * cannot: if the audit insert fails, the mutation is rolled back with it.
 *
 * The cost is that the preconditions are no longer unit-testable against
 * the mock fixture — they are exercised by tools/agent-atomic-audit-
 * smoke.test.ts against a real database, which SKIPS without staging
 * credentials. What is tested here is the call contract: that the reasons
 * come back intact, that a missing function fails loudly rather than
 * silently downgrading, and that a refusal is never reported as success.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSms } from './sms/send.js';

export interface AgentActionRow {
  id: string;
  church_id: string;
  action_type: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  payload: Record<string, unknown>;
}

/**
 * What the executor changed, so the caller can write a normal audit_logs
 * row against the mutated entity — not just against the approval.
 *
 * Without this, an agent-driven assignment would be the only Work Order
 * write in the product with no Work Order audit entry: reconstructing
 * "what did the agent change" would mean chaining approvals -> platform
 * events -> agent_actions.payload, and only if you knew the chain existed.
 */
export interface ExecutorMutation {
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/**
 * The audit verb a mutation earns, read off its own snapshots rather than
 * assumed by whichever route happened to run it. Both routes used to
 * hardcode theirs — 'update' on the approvals path, 'delete' on direct
 * execute — which was right for the one action each was written around and
 * wrong the moment a second executor arrived: an APPROVED deletion was filed
 * as an 'update', invisible to `audit_logs where action='delete'`, which is
 * the whole point of the trail (R-18).
 */
export function auditActionFor(mutation: ExecutorMutation): 'create' | 'update' | 'delete' {
  if (mutation.after === null) return 'delete';
  if (mutation.before === null) return 'create';
  return 'update';
}

export type ExecutorResult =
  | {
      ok: true;
      detail: string;
      mutation?: ExecutorMutation;
      /**
       * True when the executor already committed the `agent_actions` status
       * write AND the mutation's audit row inside its own transaction.
       *
       * The caller MUST NOT repeat either write when this is set. Doing so
       * would produce a duplicate audit row for one change, and would fire
       * a status update that the executor's transaction already made.
       */
      committedStatusAndAudit?: boolean;
    }
  | { ok: false; reason: string };

/**
 * Everything an atomic executor needs to write the audit row itself.
 *
 * The deciding human is the actor — the agent proposed, a person decided —
 * so this carries the decider's identity, not the agent's. `reason` is
 * where the agent is named.
 */
export interface ExecutorContext {
  /** The approval being decided. The action must point back at it. */
  approvalId: string;
  actorUserId: string | null;
  actorClerkId?: string | null;
  /** Ties this audit row to the decision's audit row and platform event. */
  correlationId?: string | null;
  reason: string;
  sourceApp: string;
  route: string;
  method: string;
  /** The decision timestamp, so executed_at matches decided_at exactly. */
  executedAt: string;
}

type Executor = (
  supabase: SupabaseClient,
  action: AgentActionRow,
  ctx: ExecutorContext,
) => Promise<ExecutorResult>;

/** The Postgres function backing assign_work_order_owner (migration 070). */
export const ASSIGN_OWNER_RPC = 'agent_execute_assign_work_order_owner';

/** What migration 070's function returns. Shape-checked, never trusted. */
interface AtomicExecutionResult {
  ok?: unknown;
  reason?: unknown;
  detail?: unknown;
  work_order_id?: unknown;
  owner_user_id?: unknown;
}

/**
 * PostgREST cannot find the function (schema cache miss / not defined).
 *
 * This is the deploy-ordering failure: code shipped ahead of migration
 * 070. It gets its own reason because the remedy is completely different
 * from a genuine execution failure — and because the alternative, falling
 * back to the old non-atomic path, would silently give up the guarantee
 * this whole change exists to provide.
 */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST202' // PostgREST: no matching function in schema cache
    || error.code === '42883'      // Postgres: undefined_function
    || Boolean(error.message && /could not find the function/i.test(error.message));
}

/**
 * Assign the accountable human for a Work Order's ministry as its owner.
 *
 * Proposed by Verity when it finds an open Work Order with no owner and
 * the ministry has a named owner in `ministry_assignments`. Reversible by
 * hand in the Work Order detail view, which is part of why it is a
 * reasonable first executor: the worst case is a wrong-but-visible owner,
 * not lost or corrupted data.
 *
 * The preconditions (still unowned, not completed/cancelled, owner still
 * an active user of this church) are enforced inside the function, under
 * row locks, alongside the writes they guard — which is stronger than
 * checking them here and hoping nothing moves in between.
 */
const assignWorkOrderOwner: Executor = async (supabase, action, ctx) => {
  const { data, error } = await supabase.rpc(ASSIGN_OWNER_RPC, {
    p_action_id: action.id,
    p_church_id: action.church_id,
    p_approval_id: ctx.approvalId,
    p_actor_user_id: ctx.actorUserId,
    p_actor_clerk_id: ctx.actorClerkId ?? null,
    p_correlation_id: ctx.correlationId ?? null,
    p_reason: ctx.reason,
    p_source_app: ctx.sourceApp,
    p_route: ctx.route,
    p_method: ctx.method,
    p_executed_at: ctx.executedAt,
  });

  if (error) {
    if (isMissingFunction(error)) {
      console.error('[agentActionExecutors] migration 070 not applied', { rpc: ASSIGN_OWNER_RPC });
      return { ok: false, reason: 'atomic_executor_unavailable' };
    }
    // A raised exception rolled the transaction back: nothing was changed
    // and nothing was audited. That includes the case this design exists
    // for — the audit insert failing and taking the assignment with it.
    console.error('[agentActionExecutors] atomic execution failed', {
      rpc: ASSIGN_OWNER_RPC,
      action_id: action.id,
      code: error.code,
      error: error.message,
    });
    return { ok: false, reason: 'atomic_execution_failed' };
  }

  const result = (data ?? null) as AtomicExecutionResult | null;
  // Never infer success from a shape we do not recognise. An unreadable
  // result must read as a failure, not as a silent assignment.
  if (!result || typeof result.ok !== 'boolean') {
    console.error('[agentActionExecutors] unrecognised RPC result', { rpc: ASSIGN_OWNER_RPC, data });
    return { ok: false, reason: 'atomic_execution_malformed_result' };
  }
  if (!result.ok) {
    return { ok: false, reason: typeof result.reason === 'string' ? result.reason : 'refused' };
  }
  if (typeof result.work_order_id !== 'string' || typeof result.owner_user_id !== 'string') {
    console.error('[agentActionExecutors] RPC reported ok without ids', { rpc: ASSIGN_OWNER_RPC, data });
    return { ok: false, reason: 'atomic_execution_malformed_result' };
  }

  return {
    ok: true,
    detail: typeof result.detail === 'string'
      ? result.detail
      : `Assigned owner ${result.owner_user_id} to work order ${result.work_order_id}`,
    mutation: {
      entityType: 'work_order',
      entityId: result.work_order_id,
      before: { owner_user_id: null },
      after: { owner_user_id: result.owner_user_id },
    },
    committedStatusAndAudit: true,
  };
};


/**
 * Delete a person, once a human has approved it.
 *
 * Gated because it is irreversible and takes the whole pastoral history
 * with it — and because, before TD-061, this was the one chat action that
 * left no record anywhere at all.
 *
 * NOT atomic in the migration-070 sense: the delete and its audit row are
 * separate commits, so the guarantee here is the weaker "a missing audit is
 * loud and recorded" (see workosAudit.ts, TD-060). The audit is written by
 * the approvals endpoint from the `mutation` returned below. Making this
 * atomic means a Postgres function like 070's, and the `before` snapshot
 * makes that worth doing — but it is not this change.
 */
const deletePerson: Executor = async (supabase, action) => {
  const personId = action.target_entity_id;
  if (!personId) return { ok: false, reason: 'no_target_person' };

  // Snapshot BEFORE deleting. Once the row is gone there is nothing left to
  // describe it, so an audit row without this would record that someone was
  // deleted while being unable to say who.
  const { data: person, error: readErr } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, phone, status')
    .eq('id', personId)
    .eq('church_id', action.church_id)
    .maybeSingle();
  if (readErr) return { ok: false, reason: 'person_read_failed' };
  if (!person) return { ok: false, reason: 'person_not_found' };

  const { data: deleted, error: delErr } = await supabase
    .from('people')
    .delete()
    .eq('id', personId)
    .eq('church_id', action.church_id)
    .select('id')
    .maybeSingle();
  // Migration 054 is what makes this succeed for anyone with activity,
  // giving or event history; without it the append-only triggers reject
  // the FK cascade's internal UPDATE.
  if (delErr) return { ok: false, reason: 'person_delete_failed' };
  if (!deleted) return { ok: false, reason: 'person_already_removed' };

  return {
    ok: true,
    detail: `Deleted ${person.first_name} ${person.last_name}`,
    mutation: {
      entityType: 'person',
      entityId: personId,
      before: person as Record<string, unknown>,
      after: null,
    },
  };
};

/**
 * Send a text message, once a human has approved it.
 *
 * Gated because it leaves the building and cannot be recalled. The
 * precondition re-check matters more here than elsewhere: an approval can
 * sit for days, and a number that has since been removed means the message
 * must not be guessed at a stale one.
 */
const sendSmsAction: Executor = async (supabase, action) => {
  const personId = action.target_entity_id;
  const message = typeof action.payload.message === 'string' ? action.payload.message.trim() : '';
  if (!personId) return { ok: false, reason: 'no_target_person' };
  if (!message) return { ok: false, reason: 'empty_message' };

  const { data: person, error: readErr } = await supabase
    .from('people')
    .select('id, first_name, last_name, phone')
    .eq('id', personId)
    .eq('church_id', action.church_id)
    .maybeSingle();
  if (readErr) return { ok: false, reason: 'person_read_failed' };
  if (!person) return { ok: false, reason: 'person_not_found' };
  if (!person.phone) return { ok: false, reason: 'person_has_no_phone' };

  // Reuses the same Twilio path api/sms/_send.ts uses — one sender, so an
  // approved text cannot diverge from a hand-sent one.
  const outcome = await sendSms({ to: person.phone as string, message });
  if (!outcome.ok) {
    // 'not_configured' and 'invalid_phone' are refusals, not breakages; both
    // must read as a failed action rather than a silent no-op, because the
    // decider was told a text would go out.
    return { ok: false, reason: outcome.skipped ? `sms_${outcome.reason}` : 'sms_send_failed' };
  }

  return {
    ok: true,
    detail: `Texted ${person.first_name} ${person.last_name}`,
    mutation: {
      entityType: 'person',
      entityId: personId,
      before: null,
      // The body is recorded deliberately: "a text was sent" without its
      // contents is not an account of what happened.
      after: { sms_message: message, message_id: outcome.message_id },
    },
  };
};


/**
 * Delete a task.
 *
 * Runs immediately — no approval — but server-side, so it produces an
 * audit_logs row. That is the whole difference from before: the deletion
 * itself is unchanged, what changed is that it is now recorded somewhere
 * that cannot be edited afterwards.
 */
const deleteTask: Executor = async (supabase, action) => {
  const taskId = action.target_entity_id;
  if (!taskId) return { ok: false, reason: 'no_target_task' };

  // Snapshot first: after the delete there is nothing left to describe, and
  // an audit row saying only "a task was deleted" answers no useful question.
  const { data: task, error: readErr } = await supabase
    .from('tasks')
    .select('id, title, person_id, due_date, priority, completed')
    .eq('id', taskId)
    .eq('church_id', action.church_id)
    .maybeSingle();
  if (readErr) return { ok: false, reason: 'task_read_failed' };
  if (!task) return { ok: false, reason: 'task_not_found' };

  const { data: deleted, error: delErr } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('church_id', action.church_id)
    .select('id')
    .maybeSingle();
  if (delErr) return { ok: false, reason: 'task_delete_failed' };
  if (!deleted) return { ok: false, reason: 'task_already_removed' };

  return {
    ok: true,
    detail: `Deleted task: ${task.title}`,
    mutation: {
      entityType: 'task',
      entityId: taskId,
      before: task as Record<string, unknown>,
      after: null,
    },
  };
};

/**
 * Delete a prayer request.
 *
 * Immediate, like deleteTask, and audited for the same reason. The snapshot
 * deliberately includes `content` and `is_private`: a deleted prayer request
 * is pastoral material, and "something was removed from someone's care
 * record" is not an account of what happened.
 */
const deletePrayer: Executor = async (supabase, action) => {
  const prayerId = action.target_entity_id;
  if (!prayerId) return { ok: false, reason: 'no_target_prayer' };

  const { data: prayer, error: readErr } = await supabase
    .from('prayer_requests')
    .select('id, person_id, content, is_private, is_answered')
    .eq('id', prayerId)
    .eq('church_id', action.church_id)
    .maybeSingle();
  if (readErr) return { ok: false, reason: 'prayer_read_failed' };
  if (!prayer) return { ok: false, reason: 'prayer_not_found' };

  const { data: deleted, error: delErr } = await supabase
    .from('prayer_requests')
    .delete()
    .eq('id', prayerId)
    .eq('church_id', action.church_id)
    .select('id')
    .maybeSingle();
  if (delErr) return { ok: false, reason: 'prayer_delete_failed' };
  if (!deleted) return { ok: false, reason: 'prayer_already_removed' };

  return {
    ok: true,
    detail: 'Deleted a prayer request',
    mutation: {
      entityType: 'prayer_request',
      entityId: prayerId,
      before: prayer as Record<string, unknown>,
      after: null,
    },
  };
};

const ACTION_EXECUTORS: Record<string, Executor> = {
  assign_work_order_owner: assignWorkOrderOwner,
  delete_person: deletePerson,
  send_sms: sendSmsAction,
  delete_task: deleteTask,
  delete_prayer: deletePrayer,
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
  ctx: ExecutorContext,
): Promise<ExecutorResult> {
  const executor = ACTION_EXECUTORS[action.action_type];
  if (!executor) return { ok: false, reason: `no_executor_for_${action.action_type}` };
  try {
    return await executor(supabase, action, ctx);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'executor_threw' };
  }
}
