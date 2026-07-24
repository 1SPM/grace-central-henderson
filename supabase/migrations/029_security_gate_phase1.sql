-- 029: Beta Phase 1 security gate (applied to production 2026-07-06 via MCP,
-- migration name: security_gate_phase1_rpc_lockdown_policy_fix_search_path).
-- Findings from the 2026-07-06 Supabase security advisor scan; full context
-- in HERMES PROJECTS/GRACE_Demo_Completion_and_Beta_Critical_Path.md.

-- 1) P0: always-true permissive policies OR together with tenant_isolation,
--    effectively disabling tenant isolation on the agent tables. Drop them;
--    the service role bypasses RLS and needs no policy.
DROP POLICY "Service role can manage agent_executions" ON public.agent_executions;
DROP POLICY "Service role can manage agent_logs" ON public.agent_logs;
DROP POLICY "Service role can manage agent_stats" ON public.agent_stats;

-- Demo lane: anon may read agent observations for the shared DEMO church only
-- (keeps the demo CRM notification bell working; no cross-tenant exposure).
CREATE POLICY "anon_demo_church_agent_logs_read" ON public.agent_logs
  FOR SELECT TO anon
  USING (church_id = '11111111-1111-1111-1111-111111111111'::uuid);

-- 2) P0: SECURITY DEFINER RPCs were callable by anon/authenticated with an
--    arbitrary church_id parameter (cross-tenant read). No app code calls
--    them; restrict to service-role/owner use.
REVOKE EXECUTE ON FUNCTION public.get_daily_digest_data(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_daily_digest_data(uuid, date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_pending_messages(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pending_messages(uuid) FROM anon, authenticated;

-- 3) Hardening: pin search_path on all functions flagged by lint 0011
--    (role-mutable search_path). 'public' preserves current behavior.
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.calculate_pledge_fulfillment(uuid) SET search_path = public;
ALTER FUNCTION public.get_pending_messages(uuid) SET search_path = public;
ALTER FUNCTION public.get_daily_digest_data(uuid, date) SET search_path = public;
ALTER FUNCTION public.insert_agent_log(uuid, character varying, character varying, text, jsonb) SET search_path = public;
ALTER FUNCTION public.update_agent_stats(uuid, character varying, integer, integer) SET search_path = public;
ALTER FUNCTION public.get_church_id() SET search_path = public;
ALTER FUNCTION public.anchor_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.anchor_bump_conversation_timestamp() SET search_path = public;
ALTER FUNCTION public.audit_logs_block_mutation() SET search_path = public;
ALTER FUNCTION public.token_usage_block_mutation() SET search_path = public;
ALTER FUNCTION public.ledger_entries_block_mutation() SET search_path = public;
ALTER FUNCTION public.interchange_events_block_mutation() SET search_path = public;
ALTER FUNCTION public.member_activity_events_block_mutation() SET search_path = public;

-- Accepted-as-intended (advisor INFO level, audited 2026-07-06):
-- anchor_ai_personas, anchor_conversations, anchor_intake_responses,
-- anchor_leader_applications, anchor_leader_visibility, anchor_messages
-- have RLS enabled with NO policies = deny-all for client roles. Correct:
-- these tables are accessed exclusively through the /api/care/* routes with
-- the service role. Do NOT add client policies without a design review.