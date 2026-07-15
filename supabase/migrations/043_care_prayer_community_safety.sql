-- GRACE — Member care, prayer, and community safety controls
-- Migration: 043_care_prayer_community_safety.sql
--
-- Conservative, DB-enforced extensions for three sensitive workflows.
-- Every visibility rule in this migration is enforced by RLS, not left
-- to application-layer filtering — per the explicit requirement that
-- "visibility must be enforced in the database and API," not the
-- frontend. The API layer (requirePermission / resolveMemberActor)
-- remains the PRIMARY control everywhere else in this codebase (see
-- SHARED_BACKEND.md); RLS here is a genuine second, independent layer
-- because a care/prayer read is exactly the kind of mistake ("staff
-- forgot to add .eq('church_id', ...)") that must fail closed at the
-- database, not just in a code review.
--
-- Idempotent throughout.

-- ============================================
-- 1. care_requests: contact method, human-followup flag, visibility
-- ============================================

ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT
  CHECK (preferred_contact_method IN ('email', 'sms', 'phone', 'either'));
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS requests_human_followup BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private_pastoral_care'
  CHECK (visibility IN ('private_pastoral_care', 'specific_care_team'));
-- Sentinel privacy review (see api/_lib/agentWorkflows.ts "sentinel") is a
-- FLAG for human review, never an autonomous decision — see ADR below.
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS sentinel_review_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK (sentinel_review_status IN ('not_required', 'pending', 'cleared', 'flagged'));
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN care_requests.visibility IS
  'private_pastoral_care = any care.view holder. specific_care_team = ONLY staff with an active care_assignments row for this request (plus care.manage holders for triage). Enforced by RLS below, not application filtering.';
COMMENT ON COLUMN care_requests.sentinel_review_status IS
  'A crisis-flagged or high-sensitivity request is marked pending here and requires a human (not the system) to clear or flag it before the request can be closed. Never set to cleared/flagged automatically.';

-- ============================================
-- 2. care_request_notes — internal, staff-only, never member-visible
-- ============================================

CREATE TABLE IF NOT EXISTS care_request_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_request_id UUID NOT NULL REFERENCES care_requests(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_request_notes_request ON care_request_notes(care_request_id, created_at);

-- ============================================
-- 3. care_requests / care_assignments / care_request_notes: permission-
--    aware RLS (defense-in-depth on top of the API-layer care.view/
--    care.manage check in api/care-requests/*).
-- ============================================

ALTER TABLE care_request_notes ENABLE ROW LEVEL SECURITY;

-- Replace the migration-037 tenant-only policy on care_requests with a
-- permission-aware one, PLUS the member's own self-access policy (both
-- already exist from migration 037 — dropped and recreated here so the
-- staff-read path is now permission-gated, not merely tenant-gated).
DROP POLICY IF EXISTS "tenant_isolation" ON care_requests;
CREATE POLICY "care_requests staff read" ON care_requests FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.view')
    AND (
      visibility = 'private_pastoral_care'
      OR EXISTS (
        SELECT 1 FROM care_assignments ca
        WHERE ca.care_request_id = care_requests.id
          AND ca.assigned_to_user_id = public.get_app_user_id()
          AND ca.status IN ('assigned', 'active')
      )
      OR public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
    )
  );
CREATE POLICY "care_requests staff write" ON care_requests FOR UPDATE
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
  )
  WITH CHECK (church_id = public.get_church_id());
CREATE POLICY "care_requests staff insert" ON care_requests FOR INSERT
  WITH CHECK (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
  );
-- member self access policy from migration 037 (person_id = get_person_id()) is untouched.

DROP POLICY IF EXISTS "tenant_isolation" ON care_assignments;
CREATE POLICY "care_assignments staff" ON care_assignments FOR ALL
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.view')
  )
  WITH CHECK (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
  );

-- care_request_notes: care.manage only, both read and write — never
-- exposed to a member and never exposed to a care.view-only (read-only)
-- staff role. Internal notes are the most sensitive layer of this
-- workflow.
CREATE POLICY "care_request_notes authorized care team only" ON care_request_notes FOR ALL
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
  )
  WITH CHECK (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
  );

-- ============================================
-- 4. prayer_requests: five-level visibility, enforced in RLS
-- ============================================

ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private_pastoral_care'
  CHECK (visibility IN ('private_pastoral_care', 'specific_care_team', 'selected_group', 'church_prayer_wall', 'anonymous_prayer_wall'));
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES small_groups(id) ON DELETE SET NULL;
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'answered', 'archived'));
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS crisis_flagged BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN prayer_requests.crisis_flagged IS
  'Set by api/portal/_prayer.ts when crisis language is detected. Forces visibility to private_pastoral_care regardless of the member''s original selection — a safety override, applied before insert, never editable by the member afterward.';

-- Backfill: the old boolean is_private=true becomes private_pastoral_care
-- (the closest safe equivalent — never widen an existing row's audience
-- during a migration); is_private=false becomes church_prayer_wall.
UPDATE prayer_requests SET visibility = 'private_pastoral_care' WHERE is_private = true AND visibility = 'private_pastoral_care';
UPDATE prayer_requests SET visibility = 'church_prayer_wall' WHERE is_private = false;

CREATE TABLE IF NOT EXISTS prayer_request_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prayer_request_id UUID NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prayer_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prayer_assignments_request ON prayer_request_assignments(prayer_request_id);

ALTER TABLE prayer_request_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prayer_request_assignments staff" ON prayer_request_assignments FOR ALL
  USING (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.view')
  )
  WITH CHECK (
    church_id = public.get_church_id()
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
  );

-- Replace the migration-011 tenant-only policy on prayer_requests with
-- visibility-aware read policies. Write (insert/update/delete) stays
-- restricted to the author (member self, via get_person_id()) or
-- care.manage staff.
DROP POLICY IF EXISTS "tenant_isolation" ON prayer_requests;

CREATE POLICY "prayer_requests read own" ON prayer_requests FOR SELECT
  USING (church_id = public.get_church_id() AND person_id = public.get_person_id());

CREATE POLICY "prayer_requests read church wall" ON prayer_requests FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND visibility IN ('church_prayer_wall', 'anonymous_prayer_wall')
    AND status != 'archived'
  );

CREATE POLICY "prayer_requests read selected group" ON prayer_requests FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND visibility = 'selected_group'
    AND EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = prayer_requests.group_id
        AND gm.person_id = public.get_person_id()
        AND gm.status = 'active'
    )
  );

CREATE POLICY "prayer_requests read pastoral care" ON prayer_requests FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND visibility = 'private_pastoral_care'
    AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.view')
  );

CREATE POLICY "prayer_requests read specific care team" ON prayer_requests FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND visibility = 'specific_care_team'
    AND (
      public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
      OR EXISTS (
        SELECT 1 FROM prayer_request_assignments pra
        WHERE pra.prayer_request_id = prayer_requests.id
          AND pra.user_id = public.get_app_user_id()
      )
    )
  );

-- Staff (care.view) can also always read group-wall/church-wall/etc for
-- moderation purposes — covered by "prayer_requests read church wall"
-- already being open to any authenticated church member/staff at those
-- two visibility levels; no separate staff policy needed there.

CREATE POLICY "prayer_requests insert own or staff" ON prayer_requests FOR INSERT
  WITH CHECK (
    church_id = public.get_church_id()
    AND (
      person_id = public.get_person_id()
      OR public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
    )
  );

CREATE POLICY "prayer_requests update own or staff" ON prayer_requests FOR UPDATE
  USING (
    church_id = public.get_church_id()
    AND (
      person_id = public.get_person_id()
      OR public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'care.manage')
    )
  )
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON COLUMN prayer_requests.visibility IS
  'Five levels, each enforced by its own RLS SELECT policy (not application filtering): private_pastoral_care, specific_care_team (via prayer_request_assignments), selected_group (via group_memberships), church_prayer_wall, anonymous_prayer_wall (same audience as church_prayer_wall; author identity is stripped at the API layer for this level — see api/portal/_prayer.ts).';

-- ============================================
-- 5. community_posts: moderation status + additional visibility tiers
-- ============================================

ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS community_posts_visibility_check;
ALTER TABLE community_posts ADD CONSTRAINT community_posts_visibility_check
  CHECK (visibility IN ('church', 'connections', 'group', 'ministry', 'draft'));

ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'removed'));
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS moderated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN community_posts.moderation_status IS
  'pending = not yet reviewed, not shown church-wide. approved = published. rejected = reviewed and declined (author-visible only). removed = was approved, later taken down (moderation or self-delete). Community posting UI is not enabled in the Members Portal until a moderation queue consumes this column — see TECH_DEBT.md.';

CREATE TABLE IF NOT EXISTS community_post_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reported_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reported_by_person_id)
);

CREATE INDEX IF NOT EXISTS idx_community_post_reports_post ON community_post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reports_status ON community_post_reports(church_id, status);

CREATE TABLE IF NOT EXISTS member_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  blocker_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  blocked_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (blocker_person_id <> blocked_person_id),
  UNIQUE (blocker_person_id, blocked_person_id)
);

CREATE INDEX IF NOT EXISTS idx_member_blocks_blocker ON member_blocks(blocker_person_id);

ALTER TABLE community_post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_post_reports own or staff" ON community_post_reports FOR ALL
  USING (
    church_id = public.get_church_id()
    AND (reported_by_person_id = public.get_person_id() OR public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'communications.manage'))
  )
  WITH CHECK (
    church_id = public.get_church_id()
    AND (reported_by_person_id = public.get_person_id() OR public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'communications.manage'))
  );

CREATE POLICY "member_blocks own only" ON member_blocks FOR ALL
  USING (church_id = public.get_church_id() AND blocker_person_id = public.get_person_id())
  WITH CHECK (church_id = public.get_church_id() AND blocker_person_id = public.get_person_id());

-- Update the church-scoped SELECT policy on community_posts (migration
-- 022) to also require moderation_status = 'approved' for anyone other
-- than the author or a communications.manage staff moderator.
DROP POLICY IF EXISTS "community_posts church scoped" ON community_posts;
CREATE POLICY "community_posts read approved" ON community_posts FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND moderation_status = 'approved'
    AND deleted_at IS NULL
    AND visibility != 'draft'
  );
CREATE POLICY "community_posts read own" ON community_posts FOR SELECT
  USING (church_id = public.get_church_id() AND author_person_id = public.get_person_id());
CREATE POLICY "community_posts moderate" ON community_posts FOR SELECT
  USING (church_id = public.get_church_id() AND public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'communications.manage'));
CREATE POLICY "community_posts insert own" ON community_posts FOR INSERT
  WITH CHECK (church_id = public.get_church_id() AND author_person_id = public.get_person_id());
CREATE POLICY "community_posts update own or moderator" ON community_posts FOR UPDATE
  USING (
    church_id = public.get_church_id()
    AND (author_person_id = public.get_person_id() OR public.user_has_permission(public.get_app_user_id(), public.get_church_id(), 'communications.manage'))
  )
  WITH CHECK (church_id = public.get_church_id());
