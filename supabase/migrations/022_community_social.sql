-- GRACE CRM — Community social network (Connect at Central)
-- Migration: 022_community_social.sql
--
-- Member-authored posts, reactions, comments, and connections.
-- Wired to member_activity_events for CRM Groups monitoring.

-- ============================================
-- 1. community_posts
-- ============================================

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  author_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN (
    'prayer', 'blessing', 'praise', 'milestone', 'event', 'group_activity', 'scripture'
  )),
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'church' CHECK (visibility IN ('church', 'connections', 'group')),
  group_id UUID REFERENCES small_groups(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_church_time
  ON community_posts(church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_group
  ON community_posts(group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_author
  ON community_posts(author_person_id, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON community_posts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_posts church scoped" ON community_posts;
CREATE POLICY "community_posts church scoped"
  ON community_posts FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 2. community_reactions
-- ============================================

CREATE TABLE IF NOT EXISTS community_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('pray', 'amen', 'share')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, person_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_community_reactions_post
  ON community_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_person
  ON community_reactions(person_id);

ALTER TABLE community_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_reactions church scoped" ON community_reactions;
CREATE POLICY "community_reactions church scoped"
  ON community_reactions FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 3. community_comments
-- ============================================

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments(post_id, created_at ASC);

ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_comments church scoped" ON community_comments;
CREATE POLICY "community_comments church scoped"
  ON community_comments FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 4. member_connections (accepted)
-- ============================================

CREATE TABLE IF NOT EXISTS member_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_a_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (person_a_id < person_b_id),
  UNIQUE (church_id, person_a_id, person_b_id)
);

CREATE INDEX IF NOT EXISTS idx_member_connections_church
  ON member_connections(church_id);
CREATE INDEX IF NOT EXISTS idx_member_connections_a
  ON member_connections(person_a_id);
CREATE INDEX IF NOT EXISTS idx_member_connections_b
  ON member_connections(person_b_id);

ALTER TABLE member_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_connections church scoped" ON member_connections;
CREATE POLICY "member_connections church scoped"
  ON member_connections FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 5. member_connection_requests (pending)
-- ============================================

CREATE TABLE IF NOT EXISTS member_connection_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  from_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  to_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (from_person_id <> to_person_id),
  UNIQUE (church_id, from_person_id, to_person_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_requests_to
  ON member_connection_requests(to_person_id, status);

ALTER TABLE member_connection_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_connection_requests church scoped" ON member_connection_requests;
CREATE POLICY "member_connection_requests church scoped"
  ON member_connection_requests FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 6. Extend member_activity_events event types
-- ============================================

ALTER TABLE member_activity_events DROP CONSTRAINT IF EXISTS member_activity_events_event_type_check;
ALTER TABLE member_activity_events ADD CONSTRAINT member_activity_events_event_type_check
  CHECK (event_type IN (
    'login', 'rsvp', 'checkin', 'gift', 'prayer', 'care_message',
    'help_request', 'directory_view', 'announcement_view',
    'kyc_submitted', 'card_issued', 'card_frozen', 'card_txn',
    'community_post', 'community_react', 'community_comment',
    'connection_request', 'connection_accept', 'group_post', 'group_join',
    'community_view'
  ));

-- ============================================
-- 7. Link attendance to small groups
-- ============================================

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES small_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_group ON attendance(group_id) WHERE group_id IS NOT NULL;

COMMENT ON TABLE community_posts IS
  'Member-authored community feed posts for Connect at Central.';
COMMENT ON TABLE member_connections IS
  'Accepted member-to-member connections in the portal social network.';
