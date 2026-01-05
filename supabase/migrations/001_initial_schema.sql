-- GRACE CRM Database Schema
-- Multi-tenant SaaS model with church_id isolation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CHURCHES (Organizations/Tenants)
-- ============================================
CREATE TABLE churches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  website VARCHAR(255),
  logo_url TEXT,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS (Staff/Admins who use the CRM)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  clerk_id VARCHAR(255) UNIQUE, -- Clerk user ID
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'staff', -- admin, staff, volunteer
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PEOPLE (Congregation Members/Visitors)
-- ============================================
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'visitor', -- visitor, regular, member, leader, inactive
  photo_url TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  birth_date DATE,
  join_date DATE,
  first_visit DATE,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  family_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_church ON people(church_id);
CREATE INDEX idx_people_status ON people(church_id, status);
CREATE INDEX idx_people_email ON people(church_id, email);

-- ============================================
-- SMALL GROUPS
-- ============================================
CREATE TABLE small_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES people(id) ON DELETE SET NULL,
  meeting_day VARCHAR(20),
  meeting_time TIME,
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_church ON small_groups(church_id);

-- ============================================
-- GROUP MEMBERSHIPS (Many-to-Many)
-- ============================================
CREATE TABLE group_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES small_groups(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, person_id)
);

CREATE INDEX idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX idx_group_memberships_person ON group_memberships(person_id);

-- ============================================
-- INTERACTIONS (Notes, Calls, Emails, etc.)
-- ============================================
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL, -- note, call, email, visit, text, prayer
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(200), -- Denormalized for display
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_person ON interactions(person_id);
CREATE INDEX idx_interactions_church ON interactions(church_id);

-- ============================================
-- TASKS (Follow-ups, Care, Admin, Outreach)
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  category VARCHAR(50) DEFAULT 'follow-up', -- follow-up, care, admin, outreach
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_church ON tasks(church_id);
CREATE INDEX idx_tasks_person ON tasks(person_id);
CREATE INDEX idx_tasks_due ON tasks(church_id, due_date, completed);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);

-- ============================================
-- PRAYER REQUESTS
-- ============================================
CREATE TABLE prayer_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  is_answered BOOLEAN DEFAULT false,
  testimony TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prayers_church ON prayer_requests(church_id);
CREATE INDEX idx_prayers_person ON prayer_requests(person_id);

-- ============================================
-- CALENDAR EVENTS
-- ============================================
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  location VARCHAR(255),
  category VARCHAR(50) DEFAULT 'event', -- service, meeting, event, small-group, other
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_church ON calendar_events(church_id);
CREATE INDEX idx_events_date ON calendar_events(church_id, start_date);

-- ============================================
-- ATTENDANCE
-- ============================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- sunday, wednesday, small-group, special
  event_name VARCHAR(255),
  date DATE NOT NULL,
  checked_in_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attendance_church ON attendance(church_id);
CREATE INDEX idx_attendance_person ON attendance(person_id);
CREATE INDEX idx_attendance_date ON attendance(church_id, date);

-- ============================================
-- GIVING / DONATIONS
-- ============================================
CREATE TABLE giving (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  fund VARCHAR(50) DEFAULT 'tithe', -- tithe, offering, missions, building, other
  date DATE NOT NULL,
  method VARCHAR(50) DEFAULT 'online', -- cash, check, card, online
  is_recurring BOOLEAN DEFAULT false,
  stripe_payment_id VARCHAR(255),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_giving_church ON giving(church_id);
CREATE INDEX idx_giving_person ON giving(person_id);
CREATE INDEX idx_giving_date ON giving(church_id, date);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
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

-- Function to get current user's church_id
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS UUID AS $$
  SELECT church_id FROM users WHERE clerk_id = auth.jwt()->>'sub'
$$ LANGUAGE SQL SECURITY DEFINER;

-- RLS Policies for church data isolation
-- Users can only see their own church's data

CREATE POLICY "Users can view own church" ON churches
  FOR SELECT USING (id = get_user_church_id());

CREATE POLICY "Users can view own church users" ON users
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Users can manage own church people" ON people
  FOR ALL USING (church_id = get_user_church_id());

CREATE POLICY "Users can manage own church groups" ON small_groups
  FOR ALL USING (church_id = get_user_church_id());

CREATE POLICY "Users can manage group memberships" ON group_memberships
  FOR ALL USING (
    group_id IN (SELECT id FROM small_groups WHERE church_id = get_user_church_id())
  );

CREATE POLICY "Users can manage own church interactions" ON interactions
  FOR ALL USING (church_id = get_user_church_id());

CREATE POLICY "Users can manage own church tasks" ON tasks
  FOR ALL USING (church_id = get_user_church_id());

CREATE POLICY "Users can manage own church prayers" ON prayer_requests
  FOR ALL USING (church_id = get_user_church_id());

CREATE POLICY "Users can manage own church events" ON calendar_events
  FOR ALL USING (church_id = get_user_church_id());

CREATE POLICY "Users can manage own church attendance" ON attendance
  FOR ALL USING (church_id = get_user_church_id());

CREATE POLICY "Users can manage own church giving" ON giving
  FOR ALL USING (church_id = get_user_church_id());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_churches_updated_at BEFORE UPDATE ON churches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON small_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_prayers_updated_at BEFORE UPDATE ON prayer_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
