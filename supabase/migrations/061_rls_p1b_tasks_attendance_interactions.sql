-- 061_rls_p1b_tasks_attendance_interactions.sql — P1b completion (#35).
--
-- Finishes P1b for the three tables that had NO RBAC permission to gate with.
-- Creates the missing permissions, grants them (zero-lockout: the two roles
-- with real users — system_administrator + member_services — get all six, so
-- no current admin or staff account loses access, including the browser's
-- direct task writes), then permission-gates the tables. All three have
-- church_id directly. demo_anon_read preserved.

-- 1. permissions
insert into permissions (key, module, action, sensitivity, description) values
  ('tasks.view',          'tasks',        'view',   'internal',   'View tasks / action items'),
  ('tasks.manage',        'tasks',        'manage', 'internal',   'Create, update, and delete tasks'),
  ('attendance.view',     'attendance',   'view',   'internal',   'View attendance records'),
  ('attendance.manage',   'attendance',   'manage', 'internal',   'Record and edit attendance'),
  ('interactions.view',   'interactions', 'view',   'restricted', 'View member interaction logs'),
  ('interactions.manage', 'interactions', 'manage', 'restricted', 'Create and edit member interaction logs')
on conflict (key) do nothing;

-- 2. grants (system_administrator + member_services = the only roles with users
--    today; both get all six. Others get sensible view-mostly defaults.)
do $$
declare
  grants jsonb := '{
    "system_administrator": ["tasks.view","tasks.manage","attendance.view","attendance.manage","interactions.view","interactions.manage"],
    "senior_pastor":        ["tasks.view","tasks.manage","attendance.view","attendance.manage","interactions.view","interactions.manage"],
    "member_services":      ["tasks.view","tasks.manage","attendance.view","attendance.manage","interactions.view","interactions.manage"],
    "executive_leadership": ["tasks.view","attendance.view","interactions.view"],
    "ministry_leader":      ["tasks.view","tasks.manage","attendance.view","interactions.view"],
    "pastoral_care":        ["tasks.view","tasks.manage","attendance.view","interactions.view","interactions.manage"],
    "volunteer_coordinator":["tasks.view","attendance.view","attendance.manage"],
    "analyst":              ["tasks.view","attendance.view","interactions.view"],
    "auditor":              ["tasks.view","attendance.view","interactions.view"],
    "communications":       ["interactions.view"]
  }'::jsonb;
  role_key text; perm_key text;
begin
  for role_key in select jsonb_object_keys(grants) loop
    for perm_key in select jsonb_array_elements_text(grants -> role_key) loop
      insert into role_permissions (role_id, permission_id)
      select r.id, p.id from roles r, permissions p
      where r.key = role_key and r.church_id is null and p.key = perm_key
      on conflict do nothing;
    end loop;
  end loop;
end $$;

-- 3. gate the tables (preserve demo_anon_read)
drop policy if exists "tenant_isolation" on public.tasks;
create policy "tasks read" on public.tasks for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'tasks.view'));
create policy "tasks write" on public.tasks for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'tasks.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'tasks.manage'));

drop policy if exists "tenant_isolation" on public.attendance;
create policy "attendance read" on public.attendance for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'attendance.view'));
create policy "attendance write" on public.attendance for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'attendance.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'attendance.manage'));

drop policy if exists "tenant_isolation" on public.interactions;
create policy "interactions read" on public.interactions for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'interactions.view'));
create policy "interactions write" on public.interactions for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'interactions.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'interactions.manage'));

-- ══════════════════════════════ ROLLBACK (per table) ══════════════════════════════
-- Policies revert; the new permissions/grants can be left in place harmlessly.
-- begin;
--   drop policy if exists "tasks read" on public.tasks;
--   drop policy if exists "tasks write" on public.tasks;
--   create policy "tenant_isolation" on public.tasks for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;
-- begin;
--   drop policy if exists "attendance read" on public.attendance;
--   drop policy if exists "attendance write" on public.attendance;
--   create policy "tenant_isolation" on public.attendance for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;
-- begin;
--   drop policy if exists "interactions read" on public.interactions;
--   drop policy if exists "interactions write" on public.interactions;
--   create policy "tenant_isolation" on public.interactions for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- commit;
