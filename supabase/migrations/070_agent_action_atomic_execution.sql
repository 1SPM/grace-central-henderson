-- ============================================================
-- 070 — Atomic execution + audit for agent-proposed mutations
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Every supabase-js call is its own transaction. So the approvals
-- consumer's execute path was necessarily four separate commits:
--
--   1. UPDATE work_orders     (the change itself)
--   2. UPDATE agent_actions   (mark it executed)
--   3. INSERT platform_events (the event)
--   4. INSERT audit_logs      (the trail)
--
-- A crash, timeout, or transient failure between 1 and 4 leaves church
-- data altered by an agent with no audit row proving what changed.
-- Migration 010 made audit_logs append-only and trigger-protected, which
-- guarantees a written row can never be altered — it does nothing about a
-- row that was never written.
--
-- api/_lib/workosAudit.ts made that failure loud (it returns an outcome
-- and escalates to security_events). Loud is better than silent, but it
-- is still after the fact: the mutation has already committed.
--
-- This function closes it properly for the one path where an agent
-- changes real church data. Steps 1, 2 and 4 happen inside a single
-- transaction. If the audit insert fails for any reason, the owner
-- assignment is rolled back with it. The agent's change cannot exist
-- without its audit row — not by convention, by the database.
--
-- Deliberately NOT wrapped in an exception handler: catching here would
-- swallow the rollback and reintroduce exactly the problem this solves.
-- A raised exception must reach the caller so the action records 'failed'.
--
-- Precondition failures are different — they return a reason and write
-- nothing, so the caller can distinguish "refused" from "broke".
--
-- SCOPE: assign_work_order_owner only, the single executor that exists
-- today (api/_lib/agentActionExecutors.ts). Each future executor that
-- mutates church data needs the same treatment; this is the pattern.
--
-- NOT IN SCOPE: platform_events (step 3). It is an observability stream,
-- not the accountability record, and it is written after the decision for
-- the approval as a whole rather than for the mutation. Pulling it in
-- would widen the transaction without strengthening the guarantee.

-- ============================================
-- 1. The function
-- ============================================

CREATE OR REPLACE FUNCTION public.agent_execute_assign_work_order_owner(
  p_action_id      UUID,
  p_church_id      UUID,
  p_approval_id    UUID,
  p_actor_user_id  UUID,
  p_actor_clerk_id TEXT,
  p_correlation_id UUID,
  p_reason         TEXT,
  p_source_app     TEXT,
  p_route          TEXT,
  p_method         TEXT,
  p_executed_at    TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
-- SECURITY INVOKER (the default, stated for the record): this runs with
-- the caller's privileges. Combined with the grants at the bottom, only
-- service_role can reach it, and RLS applies to anyone else who somehow
-- could. A SECURITY DEFINER function here would be an RLS bypass handed
-- to whoever can call it.
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action     agent_actions%ROWTYPE;
  v_work_order work_orders%ROWTYPE;
  v_owner      users%ROWTYPE;
  v_owner_id   UUID;
  v_wo_id      UUID;
BEGIN
  -- --- The action, locked for the duration -------------------------
  -- FOR UPDATE serialises two concurrent decisions on the same action:
  -- the second waits here, then sees status <> 'proposed' and refuses.
  SELECT * INTO v_action
    FROM agent_actions
   WHERE id = p_action_id
     AND church_id = p_church_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'action_not_found');
  END IF;
  IF v_action.status <> 'proposed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'action_not_proposed');
  END IF;
  IF v_action.action_type <> 'assign_work_order_owner' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'action_type_mismatch');
  END IF;
  -- Only execute under the approval this action actually points at. A
  -- mis-linked row must not be carried out by someone else's decision.
  IF v_action.requires_approval
     AND v_action.approval_id IS DISTINCT FROM p_approval_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'action_not_linked_to_approval');
  END IF;

  -- --- The proposed owner, out of untrusted JSON --------------------
  -- payload is JSONB written by a workflow; treat a malformed uuid as a
  -- refusal rather than letting the cast raise and read as a breakage.
  BEGIN
    v_owner_id := NULLIF(v_action.payload->>'owner_user_id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_owner_id := NULL;
  END;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_proposed_owner');
  END IF;

  -- target_entity_id is TEXT (035) because it holds non-uuid ids too.
  BEGIN
    v_wo_id := NULLIF(v_action.target_entity_id, '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_wo_id := NULL;
  END;
  IF v_wo_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_target_work_order');
  END IF;

  -- --- Preconditions re-checked at EXECUTION time -------------------
  -- Days can pass between propose and approve. An approved-but-stale
  -- proposal must never overwrite a deliberate human choice.
  SELECT * INTO v_work_order
    FROM work_orders
   WHERE id = v_wo_id
     AND church_id = p_church_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'work_order_not_found');
  END IF;
  IF v_work_order.owner_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_owned');
  END IF;
  IF v_work_order.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'work_order_' || v_work_order.status);
  END IF;

  SELECT * INTO v_owner
    FROM users
   WHERE id = v_owner_id
     AND church_id = p_church_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_not_in_church');
  END IF;
  IF v_owner.account_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_not_active');
  END IF;

  -- ================================================================
  -- The atomic part. Everything below commits together or not at all.
  -- ================================================================

  UPDATE work_orders
     SET owner_user_id = v_owner_id
   WHERE id = v_wo_id
     AND church_id = p_church_id
     AND owner_user_id IS NULL;

  UPDATE agent_actions
     SET status = 'executed',
         executed_at = p_executed_at
   WHERE id = v_action.id
     AND church_id = p_church_id
     AND status = 'proposed';

  -- If this insert raises, both updates above are rolled back. That is
  -- the entire point of the function.
  INSERT INTO audit_logs (
    church_id, actor_user_id, actor_clerk_id,
    action, entity_type, entity_id,
    before, after, reason,
    source_app, correlation_id, route, method
  ) VALUES (
    p_church_id, p_actor_user_id, p_actor_clerk_id,
    'update', 'work_order', v_wo_id::TEXT,
    jsonb_build_object('owner_user_id', NULL),
    jsonb_build_object('owner_user_id', v_owner_id),
    p_reason,
    p_source_app, p_correlation_id, p_route, p_method
  );

  RETURN jsonb_build_object(
    'ok', true,
    'detail', format('Assigned owner %s to work order %s', v_owner_id, v_wo_id),
    'work_order_id', v_wo_id,
    'owner_user_id', v_owner_id
  );
END;
$$;

COMMENT ON FUNCTION public.agent_execute_assign_work_order_owner IS
  'Executes an approved agent_actions row of type assign_work_order_owner. The work_orders update, the agent_actions status write, and the audit_logs row commit in ONE transaction: an agent-driven change cannot exist without its audit row. Returns {ok:false, reason} for precondition failures (nothing written); raises on write failure so the caller records failed. service_role only.';

-- ============================================
-- 2. Grants — this function MUTATES church data
-- ============================================
--
-- Postgres grants EXECUTE to PUBLIC on new functions by default, and any
-- function in the `public` schema is reachable over PostgREST by every
-- role that holds it. Left alone, that would expose an agent-mutation
-- entry point to anon. Revoke first, then grant the single role the API
-- actually uses.

REVOKE ALL ON FUNCTION public.agent_execute_assign_work_order_owner(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.agent_execute_assign_work_order_owner(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.agent_execute_assign_work_order_owner(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;
