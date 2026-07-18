-- GRACE — Impact Card operations permission (Decision Queue Stage 1)
-- Migration: 046_impact_card_permissions.sql
--
-- api/neobank currently gates staff resources on the coarse
-- STAFF_ROLES = ['admin','pastor','staff'] JWT-role check. The Decision
-- Queue needs a granular key so callers can be filtered per-category
-- without touching neobank's own gating (migrating neobank itself to
-- this key is deferred future work — see TECH_DEBT.md).
--
-- Idempotent throughout.

INSERT INTO permissions (key, module, action, sensitivity, description) VALUES
  ('impact_card.operate', 'impact_card', 'operate', 'confidential',
   'Review KYC, manage cards, and handle Impact Card transfers')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  grants JSONB := '{
    "senior_pastor": ["impact_card.operate"],
    "finance": ["impact_card.operate"],
    "impact_card_operations": ["impact_card.operate"]
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
