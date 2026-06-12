-- GRACE CRM — Member activity tracking spine (Portal-CRM Alignment, Phase B)
-- Migration: 017_member_activity.sql
--
-- Every member-portal action lands here so the admin CRM can track and
-- monitor portal engagement per member: logins, RSVPs, check-ins, gifts,
-- prayer submissions, care messages, and (Phase C) card events.
--
-- Append-only by design — activity history is an audit surface.

CREATE TABLE IF NOT EXISTS member_activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login', 'rsvp', 'checkin', 'gift', 'prayer', 'care_message',
    'help_request', 'directory_view', 'announcement_view',
    'kyc_submitted', 'card_issued', 'card_frozen', 'card_txn'
  )),
  -- Optional pointer at the row the action produced (rsvp id, giving id, …)
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_activity_church_time
  ON member_activity_events(church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_activity_person
  ON member_activity_events(person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_activity_type
  ON member_activity_events(church_id, event_type, created_at DESC);

-- Append-only enforcement (same pattern as audit_logs / ledger_entries).
CREATE OR REPLACE FUNCTION member_activity_events_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'member_activity_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_update_delete ON member_activity_events;
CREATE TRIGGER block_update_delete
  BEFORE UPDATE OR DELETE ON member_activity_events
  FOR EACH ROW EXECUTE FUNCTION member_activity_events_block_mutation();

ALTER TABLE member_activity_events ENABLE ROW LEVEL SECURITY;

-- Staff read their own church's activity. Inserts come from the portal
-- session (church-scoped) or the service role.
DROP POLICY IF EXISTS "member_activity read own church" ON member_activity_events;
CREATE POLICY "member_activity read own church"
  ON member_activity_events FOR SELECT
  USING (church_id = public.get_church_id());

DROP POLICY IF EXISTS "member_activity insert own church" ON member_activity_events;
CREATE POLICY "member_activity insert own church"
  ON member_activity_events FOR INSERT
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE member_activity_events IS
  'Append-only feed of member-portal actions. Surfaced in the admin Portal Activity view and consumed by GRACE context + portal-engagement agents.';
