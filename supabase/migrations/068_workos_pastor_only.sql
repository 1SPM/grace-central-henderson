-- 068_workos_pastor_only.sql
--
-- GRACE WorkOS becomes a privileged, pastor-only area — not a broad admin
-- dashboard several roles each see a narrow slice of. Every role that
-- currently holds a WorkOS-family permission (Work Orders, Agents,
-- Analytics, Approvals, Audit) except Senior Pastor and System
-- Administrator loses it here; those roles' equivalent day-to-day view is
-- moving to their own Action Center instead (self-scoped to what they
-- own, not a permission grant — separate follow-up work), which needs no
-- broad permission at all.
--
-- workos.access is the single top-level gate the WorkOS hub itself checks
-- (src/components/workos/WorkOsHub.tsx) before any of the finer-grained
-- checks below even run — a defense-in-depth pair, not a replacement:
-- workos.access says "may enter the hub at all", the existing
-- work_orders.*/agents.*/analytics.view/approvals.*/audit.view keys still
-- gate individual actions inside it once someone is let in.
--
-- Deliberately no carve-out for Auditor (loses audit.view) or Executive
-- Leadership (loses approvals.decide, its only path to acting as a
-- pastor-availability backstop) — this migration implements "strict
-- pastor-only" exactly as decided, not a softened version of it.

insert into permissions (id, key, module, action, sensitivity, description)
values (gen_random_uuid(), 'workos.access', 'workos', 'access', 'restricted', 'Enter the GRACE WorkOS hub')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key in ('system_administrator', 'senior_pastor')
  and p.key = 'workos.access'
  and not exists (
    select 1 from role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

delete from role_permissions rp
using roles r, permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.key not in ('system_administrator', 'senior_pastor')
  and p.key in (
    'work_orders.view', 'work_orders.manage', 'work_orders.approve',
    'agents.view', 'agents.manage',
    'analytics.view',
    'approvals.view', 'approvals.decide',
    'audit.view'
  );
