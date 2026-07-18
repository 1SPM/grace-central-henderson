-- GRACE — Provisioning Studio: DB-driven branding hosts + portal provisioning permission
-- Migration: 049_provisioning_studio.sql
--
-- Two additions:
--   1. churches.hosts — custom-domain list for public, cosmetic-only
--      branding lookups (api/tenant/_config.ts). This is NOT the auth/
--      demo-bypass host resolution — that stays hardcoded in
--      api/_lib/authz.ts's HOST_CHURCH_IDS and src/config/tenant.ts's
--      HOST_TENANTS by design (a security posture, not a limitation).
--   2. portal.provision_member permission — gates both "Set up portal
--      account" (api/people/_provision-portal.ts) and the demo persona
--      generator (api/people/_seed-demo-persona.ts).
--
-- Idempotent throughout.

ALTER TABLE churches ADD COLUMN IF NOT EXISTS hosts TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_churches_hosts ON churches USING GIN (hosts);

INSERT INTO permissions (key, module, action, sensitivity, description) VALUES
  ('portal.provision_member', 'portal', 'provision', 'confidential',
   'Set up a Members Portal account for an existing person, or generate a demo persona on a demo tenant')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  grants JSONB := '{
    "senior_pastor": ["portal.provision_member"],
    "member_services": ["portal.provision_member"]
  }'::jsonb;
  role_key TEXT;
  perm_key TEXT;
BEGIN
  FOR role_key IN SELECT jsonb_object_keys(grants) LOOP
    FOR perm_key IN SELECT jsonb_array_elements_text(grants -> role_key) LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.key = role_key AND r.church_id IS NULL AND p.key = perm_key
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
