-- GRACE — Admin Dashboard WorkOS: agent-visibility permissions
-- Migration: 039_agent_permissions.sql
--
-- The shared-platform foundation (migration 032) didn't include a
-- module for the Agent Command Centre because no UI consumed it yet.
-- Adding it now rather than overloading `work_orders.view` — an agent's
-- registry/run history is readable by a narrower set of roles (oversight
-- roles) than who can see Work Orders generally.
--
-- Idempotent throughout.

INSERT INTO permissions (key, module, action, sensitivity, description) VALUES
  ('agents.view',   'agents', 'view',   'internal', 'View the agent registry, status, and run history'),
  ('agents.manage', 'agents', 'manage', 'internal', 'Trigger an agent run')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  grants JSONB := '{
    "system_administrator": ["agents.view","agents.manage"],
    "executive_leadership": ["agents.view"],
    "senior_pastor": ["agents.view","agents.manage"],
    "auditor": ["agents.view"]
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
