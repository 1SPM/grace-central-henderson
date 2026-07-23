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
-- Restores the church-only ALL policy. Instant, non-destructive (no data
-- is touched). Each table is its OWN begin/commit so you can revert
-- exactly the one that regressed and leave the other eleven gated —
-- run only the block(s) you need. `demo_anon_read` policies were never
-- dropped, so nothing to restore there.
--
-- FULL rollback = run every block below. SINGLE-table rollback (the
-- runbook's preferred response to a 403 / empty-result on one feature) =
-- run just that table's block.

-- ── pastoral_sessions ──
-- begin;
--   drop policy if exists "pastoral_sessions read"  on public.pastoral_sessions;
--   drop policy if exists "pastoral_sessions write" on public.pastoral_sessions;
--   create policy "tenant_isolation" on public.pastoral_sessions for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── pledges ──
-- begin;
--   drop policy if exists "pledges read"  on public.pledges;
--   drop policy if exists "pledges write" on public.pledges;
--   create policy "tenant_isolation" on public.pledges for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── recurring_giving ──
-- begin;
--   drop policy if exists "recurring_giving read"  on public.recurring_giving;
--   drop policy if exists "recurring_giving write" on public.recurring_giving;
--   create policy "tenant_isolation" on public.recurring_giving for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── donation_batches ──
-- begin;
--   drop policy if exists "donation_batches read"  on public.donation_batches;
--   drop policy if exists "donation_batches write" on public.donation_batches;
--   create policy "tenant_isolation" on public.donation_batches for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── batch_items ──
-- begin;
--   drop policy if exists "batch_items read"  on public.batch_items;
--   drop policy if exists "batch_items write" on public.batch_items;
--   create policy "tenant_isolation" on public.batch_items for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── giving_statements ──
-- begin;
--   drop policy if exists "giving_statements read"  on public.giving_statements;
--   drop policy if exists "giving_statements write" on public.giving_statements;
--   create policy "tenant_isolation" on public.giving_statements for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── expenses ──
-- begin;
--   drop policy if exists "expenses read"  on public.expenses;
--   drop policy if exists "expenses write" on public.expenses;
--   create policy "tenant_isolation" on public.expenses for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── gift_in_kind_transactions (policies are named "gift_in_kind …") ──
-- begin;
--   drop policy if exists "gift_in_kind read"  on public.gift_in_kind_transactions;
--   drop policy if exists "gift_in_kind write" on public.gift_in_kind_transactions;
--   create policy "tenant_isolation" on public.gift_in_kind_transactions for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── inbound_messages ──
-- begin;
--   drop policy if exists "inbound_messages read"  on public.inbound_messages;
--   drop policy if exists "inbound_messages write" on public.inbound_messages;
--   create policy "tenant_isolation" on public.inbound_messages for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── households ──
-- begin;
--   drop policy if exists "households read"  on public.households;
--   drop policy if exists "households write" on public.households;
--   create policy "tenant_isolation" on public.households for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── household_members ──
-- begin;
--   drop policy if exists "household_members read"  on public.household_members;
--   drop policy if exists "household_members write" on public.household_members;
--   create policy "tenant_isolation" on public.household_members for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;

-- ── staff_profiles ──
-- begin;
--   drop policy if exists "staff_profiles read"  on public.staff_profiles;
--   drop policy if exists "staff_profiles write" on public.staff_profiles;
--   create policy "tenant_isolation" on public.staff_profiles for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;
