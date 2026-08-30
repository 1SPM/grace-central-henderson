/**
 * Atomic agent execution smoke test — the empirical proof for
 * migration 070_agent_action_atomic_execution.sql.
 *
 * WHAT IT PROVES, AND WHY NOTHING ELSE CAN
 *
 * The claim migration 070 makes is that an agent-driven change to church
 * data cannot exist without its audit row. That is a claim about a
 * Postgres transaction, so it can only be tested against Postgres. The
 * unit tests in api/_lib/agentActionExecutors.test.ts cover the call
 * contract and stop at the database boundary; every precondition the
 * executor used to check in TypeScript now lives inside the function and
 * is covered here and nowhere else.
 *
 * The central case is the rollback one. It forces the audit insert to
 * fail — by passing a `source_app` that violates the CHECK constraint
 * migration 036 put on audit_logs — and then asserts that the Work Order
 * is STILL unowned and the action STILL proposed. Before 070 those were
 * separate commits, so the owner assignment would have survived a failed
 * audit. That is the exact defect this exists to make impossible.
 *
 * REQUIRED ENV (skips, and therefore passes, without them):
 *   SUPABASE_TEST_URL
 *   SUPABASE_TEST_SERVICE_ROLE_KEY   # the function is service_role-only
 *   SUPABASE_TEST_TENANT_A_ID        # church UUID to write the fixture into
 *   SUPABASE_TEST_ANON_KEY           # optional; enables the grant check
 *
 * SAFETY
 * Refuses to run against the known production project ref. Point it at a
 * staging project only. It also refuses to run if the church has no
 * active user to assign, rather than creating one — fewer rows invented
 * in a shared database, and no unique-email collisions.
 *
 * RESIDUE — one row, deliberate
 * The fixture rows (work order, agent run, agent action, approval) are
 * all removed afterwards. The audit_logs row written by the successful
 * execution CANNOT be: audit_logs is append-only by design (migration
 * 010) and must stay that way. It is tagged `reason` = the marker below
 * so it is identifiable as test residue.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_ = process.env.SUPABASE_TEST_URL;
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const CHURCH = process.env.SUPABASE_TEST_TENANT_A_ID;

/** Never let this fixture run against the live project. */
const PRODUCTION_PROJECT_REF = 'asphekfvpiancyltzdxp';
const IS_PRODUCTION = Boolean(URL_ && URL_.includes(PRODUCTION_PROJECT_REF));

const HAS_ENV = Boolean(URL_ && SERVICE_KEY && CHURCH) && !IS_PRODUCTION;
const it_ = HAS_ENV ? it : it.skip;
const itAnon_ = HAS_ENV && ANON_KEY ? it : it.skip;

const RPC = 'agent_execute_assign_work_order_owner';
const MARKER = 'atomic-audit-smoke: agent proposal approved';

let db: SupabaseClient;
let ownerId: string;
let workOrderId: string;
let agentRunId: string;
let approvalId: string;
let actionId: string;

/** The parameter set the endpoint sends, with per-test overrides. */
function params(overrides: Record<string, unknown> = {}) {
  return {
    p_action_id: actionId,
    p_church_id: CHURCH,
    p_approval_id: approvalId,
    p_actor_user_id: ownerId, // stands in for the deciding human
    p_actor_clerk_id: 'user_atomic_audit_smoke',
    p_correlation_id: '00000000-0000-4000-8000-00000000c0de',
    p_reason: MARKER,
    p_source_app: 'admin_dashboard',
    p_route: '/api/approvals',
    p_method: 'PATCH',
    p_executed_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('atomic agent execution + audit (migration 070)', () => {
  beforeAll(async () => {
    if (IS_PRODUCTION) {
      throw new Error('Refusing to run the atomic-audit smoke fixture against the production project.');
    }
    if (!HAS_ENV) return;

    db = createClient(URL_!, SERVICE_KEY!, { auth: { persistSession: false } });

    // Reuse an existing active user rather than inventing one.
    const { data: user } = await db
      .from('users')
      .select('id')
      .eq('church_id', CHURCH!)
      .eq('account_status', 'active')
      .limit(1)
      .maybeSingle();
    if (!user) throw new Error(`No active user in church ${CHURCH}; cannot build the fixture.`);
    ownerId = user.id as string;

    const { data: wo, error: woErr } = await db
      .from('work_orders')
      .insert({
        church_id: CHURCH,
        title: 'Atomic audit smoke fixture',
        status: 'planning',
        owner_user_id: null,
        requested_by_agent: 'verity',
      })
      .select('id')
      .single();
    if (woErr) throw new Error(`work_orders fixture failed: ${woErr.message}`);
    workOrderId = wo.id as string;

    const { data: run, error: runErr } = await db
      .from('agent_runs')
      .insert({ church_id: CHURCH, agent_key: 'verity', status: 'succeeded' })
      .select('id')
      .single();
    if (runErr) throw new Error(`agent_runs fixture failed: ${runErr.message}`);
    agentRunId = run.id as string;

    const { data: approval, error: apprErr } = await db
      .from('approvals')
      .insert({
        church_id: CHURCH,
        entity_type: 'agent_action',
        proposed_action: 'Assign the ministry owner as Work Order owner',
        requested_by_agent: 'verity',
        status: 'pending',
      })
      .select('id')
      .single();
    if (apprErr) throw new Error(`approvals fixture failed: ${apprErr.message}`);
    approvalId = approval.id as string;

    const { data: action, error: actErr } = await db
      .from('agent_actions')
      .insert({
        agent_run_id: agentRunId,
        church_id: CHURCH,
        action_type: 'assign_work_order_owner',
        target_entity_type: 'work_order',
        target_entity_id: workOrderId,
        payload: { owner_user_id: ownerId },
        requires_approval: true,
        approval_id: approvalId,
        status: 'proposed',
      })
      .select('id')
      .single();
    if (actErr) throw new Error(`agent_actions fixture failed: ${actErr.message}`);
    actionId = action.id as string;

    await db.from('approvals').update({ entity_id: actionId }).eq('id', approvalId);
  });

  afterAll(async () => {
    if (!HAS_ENV || !db) return;
    // audit_logs rows are deliberately NOT cleaned up — see the header.
    if (actionId) await db.from('agent_actions').delete().eq('id', actionId);
    if (approvalId) await db.from('approvals').delete().eq('id', approvalId);
    if (agentRunId) await db.from('agent_runs').delete().eq('id', agentRunId);
    if (workOrderId) await db.from('work_orders').delete().eq('id', workOrderId);
  });

  // NOTE: these run in order and share one fixture. The rollback case must
  // come first — it requires the Work Order to still be unowned, which is
  // precisely what it then proves is still true.

  it_('rolls the mutation back when the audit row cannot be written', async () => {
    // 'not_a_real_surface' violates the CHECK on audit_logs.source_app
    // (migration 036), so the INSERT raises inside the function. Every
    // write in the transaction must go with it.
    const { error } = await db.rpc(RPC, params({ p_source_app: 'not_a_real_surface' }));

    expect(error, 'the function must raise, not swallow the audit failure').toBeTruthy();

    const { data: wo } = await db
      .from('work_orders').select('owner_user_id').eq('id', workOrderId).single();
    expect(wo?.owner_user_id, 'the owner assignment must NOT have survived a failed audit').toBeNull();

    const { data: action } = await db
      .from('agent_actions').select('status, executed_at').eq('id', actionId).single();
    expect(action?.status, 'the action must not read as executed').toBe('proposed');
    expect(action?.executed_at).toBeNull();
  });

  it_('commits the mutation, the status write and the audit row together', async () => {
    const { data, error } = await db.rpc(RPC, params());

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, work_order_id: workOrderId, owner_user_id: ownerId });

    const { data: wo } = await db
      .from('work_orders').select('owner_user_id').eq('id', workOrderId).single();
    expect(wo?.owner_user_id).toBe(ownerId);

    const { data: action } = await db
      .from('agent_actions').select('status, executed_at').eq('id', actionId).single();
    expect(action?.status).toBe('executed');
    expect(action?.executed_at).toBeTruthy();

    const { data: audit } = await db
      .from('audit_logs')
      .select('entity_type, entity_id, before, after, reason, correlation_id, actor_user_id')
      .eq('entity_id', workOrderId)
      .eq('entity_type', 'work_order')
      .maybeSingle();
    expect(audit, 'the mutation must have produced an audit row').toBeTruthy();
    expect(audit?.before).toEqual({ owner_user_id: null });
    expect(audit?.after).toEqual({ owner_user_id: ownerId });
    expect(audit?.reason).toBe(MARKER);
    expect(audit?.correlation_id).toBe('00000000-0000-4000-8000-00000000c0de');
  });

  it_('refuses a second execution of an action that is no longer proposed', async () => {
    // The row lock plus the status check is what makes "approve twice"
    // safe at the database rather than only in the endpoint.
    const { data, error } = await db.rpc(RPC, params());

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: false, reason: 'action_not_proposed' });
  });

  itAnon_('is not callable by anon', async () => {
    // Postgres grants EXECUTE to PUBLIC on new functions by default, and
    // anything in the `public` schema is reachable over PostgREST. Without
    // the REVOKE in migration 070 this would be an unauthenticated
    // entry point to a function that mutates church data.
    const anon = createClient(URL_!, ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await anon.rpc(RPC, params());

    expect(error, 'anon must not be able to execute the agent mutation function').toBeTruthy();
  });
});
