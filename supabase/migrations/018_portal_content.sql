-- GRACE CRM — Portal content tables (Portal-CRM Alignment, Phase B)
-- Migration: 018_portal_content.sql
--
--   1. announcements  — admin-published church announcements; replaces the
--                       in-memory demo data in useAnnouncements
--   2. event_rsvps    — persists member RSVPs (previously React state only)

-- ============================================
-- 1. announcements
-- ============================================

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'event', 'urgent', 'update', 'celebration')),
  pinned BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_church
  ON announcements(church_id, published_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON announcements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements church scoped" ON announcements;
CREATE POLICY "announcements church scoped"
  ON announcements FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- ============================================
-- 2. event_rsvps
-- ============================================

CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  guest_count INTEGER NOT NULL DEFAULT 0 CHECK (guest_count >= 0 AND guest_count <= 20),
  -- Where the RSVP came from: the member portal or staff entry.
  source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_person ON event_rsvps(person_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_church ON event_rsvps(church_id);

DROP TRIGGER IF EXISTS set_updated_at ON event_rsvps;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_rsvps church scoped" ON event_rsvps;
CREATE POLICY "event_rsvps church scoped"
  ON event_rsvps FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE announcements IS
  'Admin-published announcements rendered in the member portal feed.';
COMMENT ON TABLE event_rsvps IS
  'Member RSVPs to calendar events. source=portal rows are member-initiated.';
