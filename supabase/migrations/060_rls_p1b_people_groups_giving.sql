-- 060_rls_p1b_people_groups_giving.sql — P1b RLS gating (tracking issue #35).
--
-- Permission-gates the browser-read tables that portal members and
-- non-privileged accounts could previously read directly (church-only
-- tenant_isolation). Prerequisite satisfied by the 059 user_roles backfill.
--
-- Coverage (verified 2026-07-24):
--   people            read people.view / write people.manage   — member_services ✓ both
--   small_groups      read groups.view  / write groups.manage   — member_services ✓ view
--   group_memberships (no church_id — parent-join via small_groups.group_id)
--   giving            read giving_financial.view / write .manage — operator-approved
--                     restriction to admins + finance (member_services loses direct
--                     giving read by design)
--
-- Admins hold system_administrator (all perms) and are unaffected. The member
-- portal uses service-role API routes and is unaffected. demo_anon_read
-- preserved where present. Writes to these tables mostly flow through service-
-- role routes (which bypass RLS); the browser writes people (delete) + tasks —
-- people.manage covers the people delete for member_services/admins.
--
-- NOT included (no RBAC permission exists yet + direct browser writes):
--   tasks, attendance, interactions — deferred pending new permission design.

drop policy if exists "tenant_isolation" on public.people;
create policy "people read" on public.people for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'people.view'));
create policy "people write" on public.people for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'people.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'people.manage'));

drop policy if exists "tenant_isolation" on public.small_groups;
create policy "small_groups read" on public.small_groups for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'groups.view'));
create policy "small_groups write" on public.small_groups for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'groups.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'groups.manage'));

-- group_memberships has no church_id — inherits tenancy via small_groups.group_id.
drop policy if exists "tenant_isolation" on public.group_memberships;
create policy "group_memberships read" on public.group_memberships for select
  using (exists (select 1 from public.small_groups sg
                 where sg.id = group_memberships.group_id and sg.church_id = get_church_id())
         and user_has_permission(get_app_user_id(), get_church_id(), 'groups.view'));
create policy "group_memberships write" on public.group_memberships for all
  using      (exists (select 1 from public.small_groups sg
                 where sg.id = group_memberships.group_id and sg.church_id = get_church_id())
              and user_has_permission(get_app_user_id(), get_church_id(), 'groups.manage'))
  with check (exists (select 1 from public.small_groups sg
                 where sg.id = group_memberships.group_id and sg.church_id = get_church_id())
              and user_has_permission(get_app_user_id(), get_church_id(), 'groups.manage'));

drop policy if exists "tenant_isolation" on public.giving;
create policy "giving read" on public.giving for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.view'));
create policy "giving write" on public.giving for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage'));

-- ══════════════════════════════ ROLLBACK (per table) ══════════════════════════════
-- begin;
--   drop policy if exists "people read" on public.people;
--   drop policy if exists "people write" on public.people;
--   create policy "tenant_isolation" on public.people for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;
-- begin;
--   drop policy if exists "small_groups read" on public.small_groups;
--   drop policy if exists "small_groups write" on public.small_groups;
--   create policy "tenant_isolation" on public.small_groups for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;
-- begin;
--   drop policy if exists "group_memberships read" on public.group_memberships;
--   drop policy if exists "group_memberships write" on public.group_memberships;
--   create policy "tenant_isolation" on public.group_memberships for all
--     using      (exists (select 1 from public.small_groups sg where sg.id = group_memberships.group_id and sg.church_id = get_church_id()))
--     with check (exists (select 1 from public.small_groups sg where sg.id = group_memberships.group_id and sg.church_id = get_church_id()));
-- commit;
-- begin;
--   drop policy if exists "giving read" on public.giving;
--   drop policy if exists "giving write" on public.giving;
--   create policy "tenant_isolation" on public.giving for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;
