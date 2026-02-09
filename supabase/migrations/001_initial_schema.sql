-- GRACE CRM Initial Schema
-- Multi-tenant church management with Row-Level Security

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE churches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  website TEXT,
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE SET NULL,
  clerk_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('admin', 'staff', 'volunteer')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'visitor' CHECK (status IN ('visitor', 'regular', 'member', 'leader', 'inactive')),
  photo_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  birth_date DATE,
  join_date DATE,
  first_visit DATE,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  family_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE small_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES people(id) ON DELETE SET NULL,
  meeting_day TEXT,
  meeting_time TEXT,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES small_groups(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, person_id)
);

CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note', 'call', 'email', 'visit', 'text', 'prayer')),
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category TEXT NOT NULL DEFAULT 'follow-up' CHECK (category IN ('follow-up', 'care', 'admin', 'outreach')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prayer_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_answered BOOLEAN NOT NULL DEFAULT false,
  testimony TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'service', 'meeting', 'event', 'small-group', 'holiday',
    'wedding', 'funeral', 'baptism', 'dedication', 'counseling',
    'rehearsal', 'outreach', 'class', 'other'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sunday', 'wednesday', 'small-group', 'special')),
  event_name TEXT,
  date DATE NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE giving (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  fund TEXT NOT NULL DEFAULT 'tithe' CHECK (fund IN ('tithe', 'offering', 'missions', 'building', 'benevolence', 'other')),
  date DATE NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'check', 'card', 'online', 'bank')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  stripe_payment_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_church_id ON users(church_id);
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_people_church_id ON people(church_id);
CREATE INDEX idx_people_status ON people(church_id, status);
CREATE INDEX idx_people_last_name ON people(church_id, last_name);
CREATE INDEX idx_small_groups_church_id ON small_groups(church_id);
CREATE INDEX idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX idx_group_memberships_person ON group_memberships(person_id);
CREATE INDEX idx_interactions_church_id ON interactions(church_id);
CREATE INDEX idx_interactions_person_id ON interactions(person_id);
CREATE INDEX idx_interactions_created_at ON interactions(church_id, created_at DESC);
CREATE INDEX idx_tasks_church_id ON tasks(church_id);
CREATE INDEX idx_tasks_due_date ON tasks(church_id, due_date);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to) WHERE NOT completed;
CREATE INDEX idx_prayer_requests_church_id ON prayer_requests(church_id);
CREATE INDEX idx_prayer_requests_person_id ON prayer_requests(person_id);
CREATE INDEX idx_calendar_events_church_id ON calendar_events(church_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(church_id, start_date);
CREATE INDEX idx_attendance_church_id ON attendance(church_id);
CREATE INDEX idx_attendance_person ON attendance(person_id, date);
CREATE INDEX idx_attendance_date ON attendance(church_id, date);
CREATE INDEX idx_giving_church_id ON giving(church_id);
CREATE INDEX idx_giving_person ON giving(person_id);
CREATE INDEX idx_giving_date ON giving(church_id, date DESC);

-- ============================================
-- ROW-LEVEL SECURITY
-- ============================================

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE small_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE giving ENABLE ROW LEVEL SECURITY;

-- Helper: get the current user's church_id from JWT claims
CREATE OR REPLACE FUNCTION auth.church_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'church_id')::UUID;
$$ LANGUAGE sql STABLE;

-- Churches: users can only see their own church
CREATE POLICY "Users can view own church"
  ON churches FOR SELECT
  USING (id = auth.church_id());

-- Users: scoped to same church
CREATE POLICY "Users can view same-church users"
  ON users FOR SELECT
  USING (church_id = auth.church_id());

-- People: full CRUD scoped to church
CREATE POLICY "Church members can view people"
  ON people FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can insert people"
  ON people FOR INSERT
  WITH CHECK (church_id = auth.church_id());

CREATE POLICY "Church members can update people"
  ON people FOR UPDATE
  USING (church_id = auth.church_id());

CREATE POLICY "Church admins can delete people"
  ON people FOR DELETE
  USING (church_id = auth.church_id());

-- Small Groups: scoped to church
CREATE POLICY "Church members can view groups"
  ON small_groups FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can manage groups"
  ON small_groups FOR ALL
  USING (church_id = auth.church_id());

-- Group Memberships: via group's church_id
CREATE POLICY "Church members can view memberships"
  ON group_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM small_groups
      WHERE small_groups.id = group_memberships.group_id
      AND small_groups.church_id = auth.church_id()
    )
  );

CREATE POLICY "Church members can manage memberships"
  ON group_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM small_groups
      WHERE small_groups.id = group_memberships.group_id
      AND small_groups.church_id = auth.church_id()
    )
  );

-- Interactions: scoped to church
CREATE POLICY "Church members can view interactions"
  ON interactions FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can create interactions"
  ON interactions FOR INSERT
  WITH CHECK (church_id = auth.church_id());

-- Tasks: scoped to church
CREATE POLICY "Church members can view tasks"
  ON tasks FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can manage tasks"
  ON tasks FOR ALL
  USING (church_id = auth.church_id());

-- Prayer Requests: scoped to church, private ones visible to staff+
CREATE POLICY "Church members can view public prayers"
  ON prayer_requests FOR SELECT
  USING (
    church_id = auth.church_id()
    AND (
      NOT is_private
      OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
      )
    )
  );

CREATE POLICY "Church members can manage prayers"
  ON prayer_requests FOR ALL
  USING (church_id = auth.church_id());

-- Calendar Events: scoped to church
CREATE POLICY "Church members can view events"
  ON calendar_events FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can manage events"
  ON calendar_events FOR ALL
  USING (church_id = auth.church_id());

-- Attendance: scoped to church
CREATE POLICY "Church members can view attendance"
  ON attendance FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can manage attendance"
  ON attendance FOR ALL
  USING (church_id = auth.church_id());

-- Giving: scoped to church
CREATE POLICY "Church members can view giving"
  ON giving FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can manage giving"
  ON giving FOR ALL
  USING (church_id = auth.church_id());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON churches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON small_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON prayer_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
