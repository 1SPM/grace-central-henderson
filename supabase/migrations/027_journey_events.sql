-- GRACE CRM — My Journey: extend event_type CHECK for reflection/study events
-- Migration: 027_journey_events.sql
--
-- Extends member_activity_events to track three new event types fired
-- from the Journal and Bible Study tabs of the member portal "My Journey" page:
--
--   journal_entry   — member saved a daily reflection
--   bible_study     — member completed or continued a study session
--   mood_check      — member logged a mood emoji from the daily prompt picker

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
    -- My Journey phase 1: milestone events
    'journey_view', 'milestone_achieved', 'milestone_step_request',
    -- My Journey phase 2: reflection & study events
    'journal_entry', 'bible_study', 'mood_check'
  ));
