-- GRACE — grant portal.provision_member to system_administrator
-- Migration: 050_provisioning_studio_admin_grant.sql
--
-- Migration 049 granted portal.provision_member to senior_pastor and
-- member_services but missed system_administrator, breaking the
-- established convention (every prior permission-granting migration —
-- 039, 044, 046 — grants new permissions to system_administrator too).
-- Concretely: the demo-mode server-side bootstrap actor
-- (resolveDemoStaffActor in api/_lib/authz.ts) always assumes the
-- system_administrator role, so without this grant the Provisioning
-- Studio Settings cards (Custom domains, Demo Studio) never appeared
-- in demo mode — caught live during the Stage 4 acceptance check.
--
-- Idempotent.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'system_administrator' AND r.church_id IS NULL AND p.key = 'portal.provision_member'
ON CONFLICT DO NOTHING;
