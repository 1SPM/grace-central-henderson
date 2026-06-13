-- GRACE CRM — Live Service / Watch monitoring
-- Migration: 023_live_service.sql
--
-- Sermon archive and live chat for admin Live Service dashboard.
-- Member Watch portal will write to these tables in a future pass.

-- ============================================
-- 1. watch_sermons — on-demand sermon archive
-- ============================================

CREATE TABLE IF NOT EXISTS watch_sermons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  series_title TEXT,
  part_label TEXT,
  speaker TEXT,
  preached_at DATE,
  duration_seconds INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_sermons_church_time
  ON watch_sermons(church_id, preached_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON watch_sermons;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON watch_sermons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE watch_sermons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watch_sermons church scoped" ON watch_sermons;
CREATE POLICY "watch_sermons church scoped"
  ON watch_sermons FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 2. watch_chat_messages — live service chat
-- ============================================

CREATE TABLE IF NOT EXISTS watch_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_chat_church_time
  ON watch_chat_messages(church_id, created_at DESC);

ALTER TABLE watch_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watch_chat_messages church scoped" ON watch_chat_messages;
CREATE POLICY "watch_chat_messages church scoped"
  ON watch_chat_messages FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 3. Extend member_activity_events for watch events
-- ============================================

ALTER TABLE member_activity_events DROP CONSTRAINT IF EXISTS member_activity_events_event_type_check;
ALTER TABLE member_activity_events ADD CONSTRAINT member_activity_events_event_type_check
  CHECK (event_type IN (
    'login', 'rsvp', 'checkin', 'gift', 'prayer', 'care_message',
    'help_request', 'directory_view', 'announcement_view',
    'kyc_submitted', 'card_issued', 'card_frozen', 'card_txn',
    'community_post', 'community_react', 'community_comment',
    'connection_request', 'connection_accept', 'group_post', 'group_join',
    'community_view', 'watch_join', 'watch_chat'
  ));

COMMENT ON TABLE watch_sermons IS
  'On-demand sermon archive for Live Service and member Watch pages.';
COMMENT ON TABLE watch_chat_messages IS
  'Live chat messages during online services; admin moderation via is_hidden.';
