-- 066_ministry_assignments.sql
--
-- Per-church overrides for the operational map in api/_lib/ministryAreas.ts.
--
-- The areas themselves (what jobs the church office does, which GRACE
-- surfaces belong to each, which Decision Queue kinds land where) are code —
-- the same for every tenant. The three *links* a pastor can reassign are
-- data, and they live here:
--
--   owner_user_id  — the accountable human (this is the point of the table)
--   agent_key      — which registered agent supports the area, or NULL for none
--   campus_room    — where the area sits on the 2D campus
--
-- A missing row means "no override" — the app falls back to the coded
-- default and says so in the UI. A row with owner_user_id NULL is a
-- deliberate "nobody yet", which is also shown honestly rather than being
-- backfilled with a plausible name.
--
-- Not stored in churches.settings on purpose: src/hooks/useChurchSettings.ts
-- rewrites that whole JSONB blob from the browser on every save, which would
-- silently drop keys it does not know about.

CREATE TABLE IF NOT EXISTS ministry_assignments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id          UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  -- Matches MinistryArea.key in api/_lib/ministryAreas.ts. Text, not an
  -- enum: the area list is versioned in code, and an unknown key here is
  -- ignored by the resolver rather than breaking a deploy.
  area_key           TEXT NOT NULL,
  owner_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  agent_key          TEXT,
  campus_room        TEXT,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (church_id, area_key)
);

CREATE INDEX IF NOT EXISTS idx_ministry_assignments_church
  ON ministry_assignments(church_id);
CREATE INDEX IF NOT EXISTS idx_ministry_assignments_owner
  ON ministry_assignments(owner_user_id) WHERE owner_user_id IS NOT NULL;

ALTER TABLE ministry_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON ministry_assignments;
CREATE POLICY "tenant_isolation" ON ministry_assignments FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE ministry_assignments IS
  'Per-church overrides of the ministry-area map: accountable human, supporting agent, and campus room. Areas themselves are defined in code (api/_lib/ministryAreas.ts). Absent row = coded default.';
COMMENT ON COLUMN ministry_assignments.owner_user_id IS
  'The accountable staff member. NULL is a real state ("nobody assigned yet"), shown as such in the Campus and WorkOS rather than being filled in.';
