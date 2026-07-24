-- GRACE — Staff "Preview Members Portal" (read-only, time-limited)
-- Migration: 045_portal_preview_tokens.sql
--
-- Lets a permitted staff user open a specific member's live Members
-- Portal experience for support/demo purposes, without ever handling
-- that member's credentials. Short-lived, single-target, read-only
-- (enforced in api/_lib/authz.ts — resolveMemberActor rejects any
-- non-GET request from a preview actor).
--
-- Idempotent throughout.

CREATE TABLE IF NOT EXISTS portal_preview_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  person_id UUID NOT NULL REFERENCES people(id),
  token TEXT NOT NULL UNIQUE,
  issued_by_user_id UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  first_used_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_preview_tokens_token ON portal_preview_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_preview_tokens_church ON portal_preview_tokens(church_id);

ALTER TABLE portal_preview_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON portal_preview_tokens;
CREATE POLICY tenant_isolation ON portal_preview_tokens
  FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

INSERT INTO permissions (key, module, action, sensitivity, description) VALUES
  ('portal.preview_as_member', 'portal', 'preview', 'confidential', 'Preview a specific member''s live Members Portal experience (read-only, time-limited)')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  grants JSONB := '{
    "senior_pastor": ["portal.preview_as_member"],
    "pastoral_care": ["portal.preview_as_member"],
    "member_services": ["portal.preview_as_member"]
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
