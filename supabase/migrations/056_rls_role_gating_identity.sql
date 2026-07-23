-- 056_rls_role_gating_identity.sql
--
-- P0 RLS hardening for the identity/privilege tables. Closes the
-- privilege-escalation gap found in the 2026-07-23 Supabase security
-- audit (tracking issue #35).
--
-- ┌──────────────────────────────────────────────────────────────────┐
-- │ DO NOT `supabase db push` THIS TO PRODUCTION UNTIL APPROVED.       │
-- │ Apply to STAGING first (RUNBOOK RB-011), run                       │
-- │ tools/rls-escalation-smoke.test.ts + cross-tenant-smoke against    │
-- │ staging, watch Sentry ~30 min for a 403 / empty-result spike, then │
-- │ roll to prod. Rollback SQL is at the bottom of this file.          │
-- └──────────────────────────────────────────────────────────────────┘
--
-- THE GAP
-- Both `anon` and `authenticated` hold full DML grants on these tables
-- (Supabase defaults), so RLS is the only gate. The pre-existing
-- `tenant_isolation` / `users in own church` policies were scoped
-- `FOR ALL` by church only (`church_id = get_church_id()`) with NO
-- permission check. Any authenticated principal whose JWT resolves a
-- church_id could therefore:
--   * INSERT a `user_roles` row granting themselves system_administrator
--     (user_roles feeds user_has_permission → full escalation), or
--   * UPDATE `users.role` / `users.account_status` (escalate; or
--     reactivate a suspended account, defeating resolveStaffActor).
--
-- THE FIX (mirrors the correct model already used by work_orders /
-- care_requests / prayer_requests):
--   * SELECT stays church-scoped (the direct-read admin app relies on it).
--   * user_roles writes require `admin.manage_roles`. There is NO
--     legitimate browser writer of user_roles — the role-management UI
--     posts to a service-role server route — so lockout risk is ~zero.
--   * users keeps its first-login SELF-bootstrap INSERT (AuthContext
--     inserts its own row: clerk_id = JWT sub, church_id = get_church_id()),
--     but UPDATE/DELETE now require `admin.manage_roles`. No browser flow
--     UPDATEs users directly (all such writes go through service-role
--     routes, which bypass RLS), so this is also ~zero lockout.
--   * Revoke `anon` EXECUTE on the SECURITY DEFINER helpers — they are
--     meant to run inside RLS as the definer, not be called via /rpc.

begin;

-- ─────────────────────────── user_roles ───────────────────────────
drop policy if exists "tenant_isolation" on public.user_roles;

create policy "user_roles read own church"
  on public.user_roles for select
  using (church_id = get_church_id());

create policy "user_roles write requires manage_roles"
  on public.user_roles for all
  using      (church_id = get_church_id()
              and user_has_permission(get_app_user_id(), get_church_id(), 'admin.manage_roles'))
  with check (church_id = get_church_id()
              and user_has_permission(get_app_user_id(), get_church_id(), 'admin.manage_roles'));

-- ───────────────────────────── users ──────────────────────────────
-- (keeps the existing anon `demo_anon_read` policy untouched)
drop policy if exists "users in own church" on public.users;

create policy "users read own church"
  on public.users for select
  using (church_id = get_church_id());

-- First-login self-bootstrap only: a caller may create their OWN row
-- (clerk_id must equal their JWT subject) in their own church. They
-- cannot fabricate rows for other users from the browser.
create policy "users self bootstrap insert"
  on public.users for insert
  with check (church_id = get_church_id()
              and clerk_id = (auth.jwt() ->> 'sub'));

create policy "users update requires manage_roles"
  on public.users for update
  using      (church_id = get_church_id()
              and user_has_permission(get_app_user_id(), get_church_id(), 'admin.manage_roles'))
  with check (church_id = get_church_id()
              and user_has_permission(get_app_user_id(), get_church_id(), 'admin.manage_roles'));

create policy "users delete requires manage_roles"
  on public.users for delete
  using (church_id = get_church_id()
         and user_has_permission(get_app_user_id(), get_church_id(), 'admin.manage_roles'));

-- ──────────────── keep RLS helpers off the /rpc surface ────────────
revoke execute on function public.user_has_permission(uuid, uuid, text) from anon;
revoke execute on function public.get_person_id() from anon;
revoke execute on function public.get_app_user_id() from anon;

commit;

-- ══════════════════════════════ ROLLBACK ══════════════════════════════
-- Run this if legitimate writers start getting 403 / empty results.
-- It restores the exact pre-migration state (church-only ALL policies).
-- Instant and non-destructive — no data is changed.
--
-- begin;
--   drop policy if exists "user_roles read own church" on public.user_roles;
--   drop policy if exists "user_roles write requires manage_roles" on public.user_roles;
--   create policy "tenant_isolation" on public.user_roles for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
--
--   drop policy if exists "users read own church" on public.users;
--   drop policy if exists "users self bootstrap insert" on public.users;
--   drop policy if exists "users update requires manage_roles" on public.users;
--   drop policy if exists "users delete requires manage_roles" on public.users;
--   create policy "users in own church" on public.users for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
--
--   grant execute on function public.user_has_permission(uuid, uuid, text) to anon;
--   grant execute on function public.get_person_id() to anon;
--   grant execute on function public.get_app_user_id() to anon;
-- commit;
