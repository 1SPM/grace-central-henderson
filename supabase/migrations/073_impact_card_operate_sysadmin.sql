-- GRACE — grant impact_card.operate to system_administrator
-- Migration: 073_impact_card_operate_sysadmin.sql
--
-- Migration 046 minted impact_card.operate and granted it to
-- senior_pastor, finance, and impact_card_operations but missed
-- system_administrator, breaking the established convention (every
-- prior permission-granting migration — 039, 044, 050 — grants new
-- permissions to system_administrator too). Concretely: the demo-mode
-- server-side bootstrap actor (resolveDemoStaffActor in api/_lib/authz.ts)
-- always assumes the system_administrator role, and real sysadmins hold
-- that role too, so without this grant the Decision Queue's KYC review
-- and failed-transfer categories (gated on impact_card.operate) never
-- appear for either.
--
-- Idempotent.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'system_administrator' AND r.church_id IS NULL AND p.key = 'impact_card.operate'
ON CONFLICT DO NOTHING;
