-- 059_user_roles_backfill.sql
--
-- Backfill RBAC grants for existing active staff, derived from the coarse
-- users.role claim (operator-approved 2026-07-24, "Option A"). This is the
-- prerequisite for P1b (permission-gating the browser-read tables people /
-- giving / tasks) and the IMPACT_CARD_STRICT_RBAC cutover — without a grant,
-- loadPermissionKeys returns an empty set and the user is locked out of every
-- requirePermission route.
--
-- Mapping (identical to /api/team/set-role):
--   admin     -> system_administrator
--   staff     -> member_services
--   volunteer -> member_portal_user
--   member    -> (skipped; members authorize via person_id, not user_roles)
--
-- Idempotent: only inserts where the user lacks an active grant for the mapped
-- role, so re-running — or the admins who already held system_administrator —
-- is a no-op.
--
-- Applied to production via the management connection; verified 12/13 active
-- users granted (6 admin, 5 staff, 1 volunteer; 1 member intentionally none).

insert into public.user_roles (church_id, user_id, role_id)
select u.church_id, u.id, r.id
from public.users u
join public.roles r
  on r.church_id is null
  and r.key = case u.role
    when 'admin'     then 'system_administrator'
    when 'staff'     then 'member_services'
    when 'volunteer' then 'member_portal_user'
  end
where u.account_status = 'active'
  and u.role in ('admin', 'staff', 'volunteer')
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = u.id and ur.role_id = r.id and ur.revoked_at is null
  );

-- ══════════════════════════════ ROLLBACK ══════════════════════════════
-- Revoke only the grants this migration created (leaves pre-existing admin
-- grants and any later manual set-role assignments intact is NOT possible to
-- distinguish perfectly — so scope the rollback to the mapped role per coarse
-- role, revoking rather than deleting for auditability):
-- begin;
--   update public.user_roles ur set revoked_at = now()
--   from public.users u, public.roles r
--   where ur.user_id = u.id and ur.role_id = r.id and ur.revoked_at is null
--     and r.church_id is null
--     and ( (u.role='staff'     and r.key='member_services')
--        or (u.role='volunteer' and r.key='member_portal_user') );
--   -- admins intentionally excluded from rollback (3 held system_administrator
--   -- before this migration; revoking all six would strip legitimate admins).
-- commit;
