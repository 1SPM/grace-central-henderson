-- GRACE — Members Portal: support columns and journey items
-- Migration: 042_member_portal_support.sql
--
-- Three additions needed to give the Members Portal a safe, real backend:
--
--   1. work_order_tasks gains requested_by_person_id + metadata, so a
--      portal-originated request (group join, volunteer interest, contact
--      the church) can be tracked as a real Work Order task and traced
--      back to the member who submitted it — mirroring
--      work_orders.requested_by_user_id, but for a `people` row rather
--      than a `users` row (portal members are never staff users).
--   2. group_memberships gains a status column so a member can REQUEST to
--      join a group (pending) rather than always being added directly by
--      staff (active).
--   3. member_journey_items — member-selected goals and saved resources
--      for "My Journey." Deliberately NOT a scoring/progress-percentage
--      table — see column comment. Completed onboarding steps are
--      computed from real signals (profile completeness, consents set,
--      group membership, event attendance) at the API layer, not stored
--      here or anywhere as a score.
--
-- Idempotent throughout.

-- ============================================
-- 1. work_order_tasks: trace portal-originated tasks back to a member
-- ============================================

ALTER TABLE work_order_tasks ADD COLUMN IF NOT EXISTS requested_by_person_id UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE work_order_tasks ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_wo_tasks_requested_by_person ON work_order_tasks(requested_by_person_id) WHERE requested_by_person_id IS NOT NULL;

COMMENT ON COLUMN work_order_tasks.requested_by_person_id IS
  'Set when this task was created from a Members Portal submission (group join request, volunteer interest, contact request) so the member can see their own request status. NULL for staff/agent-created tasks.';
COMMENT ON COLUMN work_order_tasks.metadata IS
  'Free-form context for portal-originated tasks, e.g. {"request_type": "volunteer_interest", "area": "Food Pantry"}. Never used to store pastoral/care content — see care_requests for that.';

-- ============================================
-- 2. group_memberships: pending join requests
-- ============================================

ALTER TABLE group_memberships ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('pending', 'active', 'declined'));

CREATE INDEX IF NOT EXISTS idx_group_memberships_status ON group_memberships(group_id, status);

COMMENT ON COLUMN group_memberships.status IS
  'active = confirmed member (staff-added rows default here). pending = member requested to join via the portal and is awaiting staff approval. declined = staff declined the request (row kept for audit rather than deleted).';

-- ============================================
-- 3. member_journey_items
-- ============================================

CREATE TABLE IF NOT EXISTS member_journey_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('goal', 'saved_resource')),
  title TEXT NOT NULL,
  description TEXT,
  -- Free-form reference for a saved_resource (e.g. an announcement id or URL). Not used for goals.
  reference_type TEXT,
  reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_journey_items_person ON member_journey_items(church_id, person_id, item_type);

DROP TRIGGER IF EXISTS set_updated_at ON member_journey_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON member_journey_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE member_journey_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON member_journey_items;
CREATE POLICY "tenant_isolation" ON member_journey_items FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "member self access" ON member_journey_items;
CREATE POLICY "member self access" ON member_journey_items FOR ALL
  USING (person_id = public.get_person_id())
  WITH CHECK (person_id = public.get_person_id());

COMMENT ON TABLE member_journey_items IS
  'Member-selected goals and saved resources for the "My Journey" portal tab. Deliberately not a scoring or progress-percentage system — no aggregate "spiritual score" is computed anywhere from this table. "Completed steps" shown in the portal are derived at the API layer from real signals (profile completeness, consents on file, group membership, event attendance), not stored here.';
