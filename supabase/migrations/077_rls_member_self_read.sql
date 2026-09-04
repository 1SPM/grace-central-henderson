-- 077_rls_member_self_read.sql — member-self READ policies (members-portal
-- audit, Phase 1 / pilot-readiness item F4).
--
-- Every api/portal/* route uses SUPABASE_SERVICE_ROLE_KEY, which bypasses
-- RLS entirely — the member portal's giving history, group list, and
-- profile page work today ONLY because the route code remembers to add
-- `.eq('person_id', member.personId)` (or equivalent) by hand. RLS was
-- meant to be the second, independent layer (authz.ts's own header says
-- so); for these tables it was not — a missed filter in a future route,
-- or any future code path that queries Supabase with the caller's own
-- Clerk JWT instead of the service key, would be unguarded.
--
-- This migration is purely additive: an extra PERMISSIVE select policy
-- per table, which Postgres OR's together with the existing
-- permission-gated policy from migration 060. It can only ever ADD
-- visibility into a caller's own rows — it cannot narrow or replace the
-- staff read paths already granted by people.view / giving_financial.view
-- / groups.view.
--
-- Coverage:
--   giving             own gifts            (person_id = get_person_id())
--   recurring_giving   own recurring gifts  (person_id = get_person_id())
--   group_memberships  own membership rows  (person_id = get_person_id())
--   small_groups       any ACTIVE group in the caller's own church — matches
--                      api/portal/_groups.ts's GET, which lets a member
--                      browse every open group to request joining, not
--                      only ones they already belong to. Inactive/archived
--                      groups stay staff-only (groups.view).
--
-- NOT included: `people`. Unlike the others, a member's own `people` row
-- carries columns (`notes`, `tags`, `status`, `household_id`, ...) that
-- api/portal/_profile.ts deliberately withholds via an explicit column
-- allow-list (PROFILE_FIELDS) even from the member it belongs to — RLS is
-- row-level, not column-level, so a blanket `id = get_person_id()` policy
-- would hand a member direct-JWT read access to internal staff notes
-- about themselves, which is a worse outcome than the gap this migration
-- closes. Closing it properly needs a member-facing view or column-level
-- grants split by Postgres role — real work, correctly out of scope for
-- an additive defense-in-depth pass. Left as a follow-up.
--
-- Known interaction: tools/rls-read-restriction-smoke.test.ts asserts a
-- non-privileged test token reads ZERO rows from recurring_giving (among
-- others). That still holds for a token with no person_id of its own in
-- the table; if SUPABASE_TEST_TENANT_A_MEMBER_TOKEN is ever repointed at
-- a person who owns recurring_giving rows, that assertion needs updating
-- to "zero rows NOT belonging to the caller" — this is the intended
-- behavior change, not a regression.

create policy "giving self read" on public.giving for select
  using (person_id = get_person_id());

create policy "recurring_giving self read" on public.recurring_giving for select
  using (person_id = get_person_id());

create policy "group_memberships self read" on public.group_memberships for select
  using (person_id = get_person_id());

create policy "small_groups member browse" on public.small_groups for select
  using (church_id = get_church_id() and is_active = true);

-- ═══════════════════════════════ ROLLBACK ═══════════════════════════════
-- begin;
--   drop policy if exists "giving self read" on public.giving;
--   drop policy if exists "recurring_giving self read" on public.recurring_giving;
--   drop policy if exists "group_memberships self read" on public.group_memberships;
--   drop policy if exists "small_groups member browse" on public.small_groups;
-- commit;
-- Instant, non-destructive: each statement only removes an additional
-- permissive policy layered on top of the existing staff-permission
-- policies from migration 060, which are untouched by this migration.
