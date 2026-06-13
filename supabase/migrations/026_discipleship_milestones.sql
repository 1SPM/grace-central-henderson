-- GRACE CRM — Discipleship Milestones persistence
-- Migration: 026_discipleship_milestones.sql
--
-- Persists the 6-step spiritual journey milestones per person to Supabase
-- so they survive page refreshes and are readable by the member-facing
-- "My Journey" portal tab. Previously milestones lived in React state only.
--
-- Also extends member_activity_events CHECK to include journey event types:
--   journey_view         — member opened My Journey tab
--   milestone_achieved   — admin marked a milestone complete (also fires a portal event)
--   milestone_step_request — member tapped "I'm interested" on a pending step

-- ============================================================
-- 1. discipleship_milestones table
-- ============================================================

CREATE TABLE IF NOT EXISTS discipleship_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN (
    'first_visit', 'attended_class', 'baptized', 'joined_group', 'serving', 'leading'
  )),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  verified_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one milestone of each type per person per church
  UNIQUE (church_id, person_id, milestone_type)
);

CREATE INDEX IF NOT EXISTS idx_discipleship_milestones_church_person
  ON discipleship_milestones(church_id, person_id);
CREATE INDEX IF NOT EXISTS idx_discipleship_milestones_church_type
  ON discipleship_milestones(church_id, milestone_type);

DROP TRIGGER IF EXISTS set_updated_at ON discipleship_milestones;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON discipleship_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE discipleship_milestones ENABLE ROW LEVEL SECURITY;

-- Staff/admin: full access scoped to their church
DROP POLICY IF EXISTS "discipleship_milestones church scoped" ON discipleship_milestones;
CREATE POLICY "discipleship_milestones church scoped"
  ON discipleship_milestones FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE discipleship_milestones IS
  'Spiritual journey milestones per person — persisted from admin DiscipleshipTimeline / Dashboard. '
  'Members can read their own rows via the My Journey portal tab.';

-- ============================================================
-- 2. Extend member_activity_events event_type CHECK
-- ============================================================

ALTER TABLE member_activity_events
  DROP CONSTRAINT IF EXISTS member_activity_events_event_type_check;

ALTER TABLE member_activity_events
  ADD CONSTRAINT member_activity_events_event_type_check
  CHECK (event_type IN (
    'login', 'rsvp', 'checkin', 'gift', 'prayer', 'care_message',
    'help_request', 'directory_view', 'announcement_view',
    'kyc_submitted', 'card_issued', 'card_frozen', 'card_txn',
    'community_post', 'community_react', 'community_comment',
    'connection_request', 'connection_accept', 'group_post', 'group_join',
    'community_view', 'watch_join', 'watch_chat',
    -- journey events (Phase: My Journey portal tab)
    'journey_view', 'milestone_achieved', 'milestone_step_request'
  ));
