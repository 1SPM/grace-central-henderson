-- 057_rls_gating_sensitive_serveronly.sql
--
-- P1a RLS hardening (tracking issue #35). Permission-gates the
-- highest-sensitivity tables that the browser NEVER touches directly —
-- pastoral notes, all giving/finance sub-ledgers, inbound message
-- content, household PII, and staff profiles. Today these carry a
-- church-only `tenant_isolation` ALL policy, so any authenticated
-- principal in the church (every staff account, and members) can read
-- AND write them. They should be reachable only by staff holding the
-- matching permission.
--
-- ┌──────────────────────────────────────────────────────────────────┐
-- │ DO NOT `supabase db push` TO PRODUCTION UNTIL APPROVED, and only   │
-- │ AFTER migration 056 (P0) is validated in production. Apply to      │
-- │ STAGING first (RB-011), run the smoke tests, watch Sentry ~30 min  │
-- │ for a 403 / empty-result spike, then roll to prod. Rollback SQL is │
-- │ at the bottom of this file.                                        │
-- └──────────────────────────────────────────────────────────────────┘
--
-- WHY LOCKOUT RISK IS ~ZERO
-- Verified (2026-07-23) that NONE of these tables is read or written by
-- the browser client — every `.from('<table>')` in src/ is server-side
-- only. All legitimate access flows through service-role API routes,
-- which bypass RLS entirely and are therefore UNAFFECTED. The anonymous
-- Faithful demo reads via the separate `demo_anon_read` policy, which is
-- left untouched. So these gates only ever affect a *direct* browser
-- read/write — of which there are none except an attacker's.
--
-- Model mirrors the correct pattern already used by care_request_notes /
-- work_orders / prayer_requests. Read = <domain>.view, write = <domain>.manage.

begin;

-- helper macro (inlined per table): SELECT gated by view perm, writes by manage perm.

-- ───────────────────────── pastoral_sessions (care) ─────────────────────────
drop policy if exists "tenant_isolation" on public.pastoral_sessions;
create policy "pastoral_sessions read"  on public.pastoral_sessions for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'care.view'));
create policy "pastoral_sessions write" on public.pastoral_sessions for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'care.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'care.manage'));

-- ───────────── giving sub-ledgers (giving_financial) ─────────────
-- pledges, recurring_giving, donation_batches, batch_items, giving_statements
drop policy if exists "tenant_isolation" on public.pledges;
create policy "pledges read"  on public.pledges for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.view'));
create policy "pledges write" on public.pledges for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'));

drop policy if exists "tenant_isolation" on public.recurring_giving;
create policy "recurring_giving read"  on public.recurring_giving for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.view'));
create policy "recurring_giving write" on public.recurring_giving for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'));

drop policy if exists "tenant_isolation" on public.donation_batches;
create policy "donation_batches read"  on public.donation_batches for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.view'));
create policy "donation_batches write" on public.donation_batches for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'));

drop policy if exists "tenant_isolation" on public.batch_items;
create policy "batch_items read"  on public.batch_items for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.view'));
create policy "batch_items write" on public.batch_items for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'));

drop policy if exists "tenant_isolation" on public.giving_statements;
create policy "giving_statements read"  on public.giving_statements for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.view'));
create policy "giving_statements write" on public.giving_statements for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'));

-- ───────────── expenses / gift-in-kind (finance.*) ─────────────
drop policy if exists "tenant_isolation" on public.expenses;
create policy "expenses read"  on public.expenses for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'finance.expenses.view'));
create policy "expenses write" on public.expenses for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'finance.expenses.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'finance.expenses.manage'));

drop policy if exists "tenant_isolation" on public.gift_in_kind_transactions;
create policy "gift_in_kind read"  on public.gift_in_kind_transactions for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'finance.gift_in_kind.view'));
create policy "gift_in_kind write" on public.gift_in_kind_transactions for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'finance.gift_in_kind.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'finance.gift_in_kind.manage'));

-- ───────────── inbound_messages (communications) ─────────────
drop policy if exists "tenant_isolation" on public.inbound_messages;
create policy "inbound_messages read"  on public.inbound_messages for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'communications.view'));
create policy "inbound_messages write" on public.inbound_messages for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'communications.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'communications.manage'));

-- ───────────── households / household_members (households.*) ─────────────
drop policy if exists "tenant_isolation" on public.households;
create policy "households read"  on public.households for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'households.view'));
create policy "households write" on public.households for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'households.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'households.manage'));

drop policy if exists "tenant_isolation" on public.household_members;
create policy "household_members read"  on public.household_members for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'households.view'));
create policy "household_members write" on public.household_members for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'households.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'households.manage'));

-- ───────────── staff_profiles (people.view / admin.manage_settings) ─────────────
drop policy if exists "tenant_isolation" on public.staff_profiles;
create policy "staff_profiles read"  on public.staff_profiles for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'people.view'));
create policy "staff_profiles write" on public.staff_profiles for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'admin.manage_settings'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'admin.manage_settings'));

commit;

-- ══════════════════════════════ ROLLBACK ══════════════════════════════
-- Restores the church-only ALL policies. Instant, non-destructive.
-- For each table T in the set below:
--   drop policy if exists "<T> read"  on public.<T>;
--   drop policy if exists "<T> write" on public.<T>;
--   create policy "tenant_isolation" on public.<T> for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- Tables: pastoral_sessions, pledges, recurring_giving, donation_batches,
-- batch_items, giving_statements, expenses, gift_in_kind_transactions,
-- inbound_messages, households, household_members, staff_profiles.
-- (demo_anon_read policies were never dropped, so nothing to restore there.)
