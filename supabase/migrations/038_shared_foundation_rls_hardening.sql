-- GRACE — Shared platform foundation, Part 8: role-aware RLS hardening
-- Migration: 038_shared_foundation_rls_hardening.sql
--
-- Migrations 031–037 gave every new table tenant isolation (church_id).
-- That is necessary but not sufficient for two rules the WorkOS spec calls
-- out explicitly:
--   "portal users must never access internal Work Orders or staff notes"
--   "financial data must not be exposed to care or communications users"
--
-- The PRIMARY control for both is server-side: api/_lib/authz.ts resolves
-- the caller's permissions from user_roles/role_permissions on every
-- request and 403s before a query is even built (see SHARED_BACKEND.md).
-- This migration adds a SECOND, independent layer at the database level
-- for the two highest-consequence tables (work_orders, approvals) so a
-- bug in the API layer alone cannot leak them to a member_portal_user —
-- matching the same "RLS as defense-in-depth, not sole control" posture
-- already established for church_id scoping (DECISIONS.md ADR-003).
--
-- This is deliberately NOT rolled out to every table in this pass — see
-- TECH_DEBT.md for the tracked follow-up to extend permission-aware RLS to
-- care_requests, giving/financial tables, and communications tables.
--
-- Idempotent throughout.

-- ============================================
-- 1. Resolve the calling Clerk user to a users.id
-- ============================================

CREATE OR REPLACE FUNCTION public.get_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.users WHERE clerk_id = (auth.jwt() ->> 'sub') LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_app_user_id() IS
  'Resolves the calling Clerk user to their users.id, for permission-aware RLS policies (public.user_has_permission). NULL when unresolved (fail-closed, same posture as get_church_id/get_person_id).';

-- ============================================
-- 2. Permission-aware policies: work_orders
-- ============================================

DROP POLICY IF EXISTS "tenant_isolation" ON work_orders;
CREATE POLICY "work_orders select" ON work_orders FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'work_orders.view')
  );
CREATE POLICY "work_orders write" ON work_orders FOR INSERT
  WITH CHECK (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'work_orders.manage')
  );
CREATE POLICY "work_orders update" ON work_orders FOR UPDATE
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'work_orders.manage')
  )
  WITH CHECK (church_id = public.get_church_id());
CREATE POLICY "work_orders delete" ON work_orders FOR DELETE
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'work_orders.manage')
  );

-- ============================================
-- 3. Permission-aware policies: approvals
-- ============================================

DROP POLICY IF EXISTS "tenant_isolation" ON approvals;
CREATE POLICY "approvals select" ON approvals FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'approvals.view')
  );
CREATE POLICY "approvals write" ON approvals FOR INSERT
  WITH CHECK (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'work_orders.manage')
  );
CREATE POLICY "approvals decide" ON approvals FOR UPDATE
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'approvals.decide')
  )
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 4. Service role bypass note
-- ============================================

-- No policy above grants access to the `service_role` Postgres role — RLS
-- is bypassed entirely for service_role by Postgres/Supabase convention
-- (BYPASSRLS), which is how the app's own backend (using the service
-- role key) continues to read/write these tables after api/_lib/authz.ts
-- has already made the real permission decision. These policies matter
-- specifically for any future path that queries Supabase directly with a
-- user-scoped anon/authenticated key (e.g. a future real-time subscription
-- from the Admin Dashboard).

COMMENT ON POLICY "work_orders select" ON work_orders IS
  'Defense-in-depth: even a caller with a valid church_id claim cannot read Work Orders without work_orders.view. Primary enforcement is api/_lib/authz.ts.';
COMMENT ON POLICY "approvals decide" ON approvals IS
  'Defense-in-depth: only approvals.decide holders can UPDATE (i.e. decide) an approval row at the database level, mirroring api/_routes/approvals.ts.';
