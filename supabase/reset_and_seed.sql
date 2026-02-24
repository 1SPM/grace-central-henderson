-- ============================================================
-- GRACE CRM - Combined Reset, Migration & Seed Script
-- ============================================================
-- This file drops all tables, re-creates them via migrations,
-- and populates seed data. Safe to run on a fresh or existing DB.
-- ============================================================

-- ############################################################
-- SECTION 1: RESET - Drop all tables in reverse dependency order
-- ############################################################

-- 004: Agent logging tables
DROP TABLE IF EXISTS agent_executions CASCADE;
DROP TABLE IF EXISTS agent_stats CASCADE;
DROP TABLE IF EXISTS agent_logs CASCADE;

-- 003: AI messaging tables
DROP TABLE IF EXISTS drip_campaign_enrollments CASCADE;
DROP TABLE IF EXISTS drip_campaign_steps CASCADE;
DROP TABLE IF EXISTS drip_campaigns CASCADE;
DROP TABLE IF EXISTS daily_digests CASCADE;
DROP TABLE IF EXISTS inbound_messages CASCADE;
DROP TABLE IF EXISTS message_archive CASCADE;
DROP TABLE IF EXISTS scheduled_messages CASCADE;

-- 002: Collection & donation tables
DROP TABLE IF EXISTS giving_statements CASCADE;
DROP TABLE IF EXISTS recurring_giving CASCADE;
DROP TABLE IF EXISTS batch_items CASCADE;
DROP TABLE IF EXISTS donation_batches CASCADE;
DROP TABLE IF EXISTS pledges CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- 002: Leader onboarding tables
DROP TABLE IF EXISTS leader_availability CASCADE;
DROP TABLE IF EXISTS pastoral_sessions CASCADE;
DROP TABLE IF EXISTS leader_applications CASCADE;

-- 001: Core tables (reverse dependency order)
DROP TABLE IF EXISTS giving CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS prayer_requests CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS group_memberships CASCADE;
DROP TABLE IF EXISTS small_groups CASCADE;
DROP TABLE IF EXISTS people CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS churches CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS calculate_pledge_fulfillment(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_pending_messages(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_daily_digest_data(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS insert_agent_log(UUID, VARCHAR, VARCHAR, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS update_agent_stats(UUID, VARCHAR, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_church_id() CASCADE;


-- ############################################################
-- SECTION 2: Migration 001 - Initial Schema
-- ############################################################

-- GRACE CRM Initial Schema
-- Multi-tenant church management with Row-Level Security
-- NOTE: All statements use IF NOT EXISTS / IF EXISTS for idempotent re-runs.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS churches (
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

CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS people (
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

CREATE TABLE IF NOT EXISTS small_groups (
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

CREATE TABLE IF NOT EXISTS group_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES small_groups(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, person_id)
);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note', 'call', 'email', 'visit', 'text', 'prayer')),
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
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

CREATE TABLE IF NOT EXISTS prayer_requests (
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

CREATE TABLE IF NOT EXISTS calendar_events (
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

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sunday', 'wednesday', 'small-group', 'special')),
  event_name TEXT,
  date DATE NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS giving (
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

CREATE INDEX IF NOT EXISTS idx_users_church_id ON users(church_id);
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_people_church_id ON people(church_id);
CREATE INDEX IF NOT EXISTS idx_people_status ON people(church_id, status);
CREATE INDEX IF NOT EXISTS idx_people_last_name ON people(church_id, last_name);
CREATE INDEX IF NOT EXISTS idx_small_groups_church_id ON small_groups(church_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_person ON group_memberships(person_id);
CREATE INDEX IF NOT EXISTS idx_interactions_church_id ON interactions(church_id);
CREATE INDEX IF NOT EXISTS idx_interactions_person_id ON interactions(person_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_church_id ON tasks(church_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(church_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to) WHERE NOT completed;
CREATE INDEX IF NOT EXISTS idx_prayer_requests_church_id ON prayer_requests(church_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_person_id ON prayer_requests(person_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_church_id ON calendar_events(church_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(church_id, start_date);
CREATE INDEX IF NOT EXISTS idx_attendance_church_id ON attendance(church_id);
CREATE INDEX IF NOT EXISTS idx_attendance_person ON attendance(person_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(church_id, date);
CREATE INDEX IF NOT EXISTS idx_giving_church_id ON giving(church_id);
CREATE INDEX IF NOT EXISTS idx_giving_person ON giving(person_id);
CREATE INDEX IF NOT EXISTS idx_giving_date ON giving(church_id, date DESC);

-- ============================================
-- ROW-LEVEL SECURITY (enabled, policies in 005_row_level_security.sql)
-- NOTE: RLS policies require auth.jwt() which is only available at runtime,
-- not in the SQL editor. Policies are deferred to a separate migration
-- that can be applied once Supabase auth is fully configured.
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

-- Allow full access via service role key (used by the app)
DROP POLICY IF EXISTS "Service role full access" ON churches;
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Service role full access" ON people;
DROP POLICY IF EXISTS "Service role full access" ON small_groups;
DROP POLICY IF EXISTS "Service role full access" ON group_memberships;
DROP POLICY IF EXISTS "Service role full access" ON interactions;
DROP POLICY IF EXISTS "Service role full access" ON tasks;
DROP POLICY IF EXISTS "Service role full access" ON prayer_requests;
DROP POLICY IF EXISTS "Service role full access" ON calendar_events;
DROP POLICY IF EXISTS "Service role full access" ON attendance;
DROP POLICY IF EXISTS "Service role full access" ON giving;

CREATE POLICY "Service role full access" ON churches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON small_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON group_memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON prayer_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON giving FOR ALL USING (true) WITH CHECK (true);

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

DROP TRIGGER IF EXISTS set_updated_at ON churches;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON churches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON users;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON people;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON small_groups;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON small_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON prayer_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON prayer_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON calendar_events;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ############################################################
-- SECTION 3: Migration 002 - Collection & Donation System
-- ############################################################

-- Collection & Donation Management System
-- Adds pledges, campaigns, donation batches, and recurring subscriptions
-- NOTE: All statements use IF NOT EXISTS / IF EXISTS for idempotent re-runs.

-- ============================================
-- CAMPAIGNS (Fundraising campaigns)
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount DECIMAL(12, 2),
  start_date DATE NOT NULL,
  end_date DATE,
  fund VARCHAR(50) DEFAULT 'other',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_church ON campaigns(church_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(church_id, is_active);

-- ============================================
-- PLEDGES (Commitment tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS pledges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  frequency VARCHAR(20) DEFAULT 'one-time', -- one-time, weekly, monthly, quarterly, annually
  start_date DATE NOT NULL,
  end_date DATE,
  fund VARCHAR(50) DEFAULT 'tithe',
  status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pledges_church ON pledges(church_id);
CREATE INDEX IF NOT EXISTS idx_pledges_person ON pledges(person_id);
CREATE INDEX IF NOT EXISTS idx_pledges_campaign ON pledges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pledges_status ON pledges(church_id, status);

-- ============================================
-- DONATION BATCHES (For in-person collections)
-- ============================================
CREATE TABLE IF NOT EXISTS donation_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  batch_date DATE NOT NULL,
  batch_name VARCHAR(255), -- e.g., "Sunday Morning Service 01/12/2025"
  status VARCHAR(20) DEFAULT 'open', -- open, closed, reconciled
  total_cash DECIMAL(10, 2) DEFAULT 0,
  total_checks DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  check_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_church ON donation_batches(church_id);
CREATE INDEX IF NOT EXISTS idx_batches_date ON donation_batches(church_id, batch_date);
CREATE INDEX IF NOT EXISTS idx_batches_status ON donation_batches(church_id, status);

-- ============================================
-- BATCH ITEMS (Individual donations in a batch)
-- ============================================
CREATE TABLE IF NOT EXISTS batch_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID REFERENCES donation_batches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method VARCHAR(20) NOT NULL, -- cash, check
  fund VARCHAR(50) DEFAULT 'tithe',
  check_number VARCHAR(50),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_person ON batch_items(person_id);

-- ============================================
-- RECURRING GIVING (Subscription tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_giving (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  frequency VARCHAR(20) NOT NULL, -- weekly, monthly, quarterly, annually
  fund VARCHAR(50) DEFAULT 'tithe',
  next_date DATE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  payment_method_last4 VARCHAR(4),
  payment_method_brand VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active', -- active, paused, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_church ON recurring_giving(church_id);
CREATE INDEX IF NOT EXISTS idx_recurring_person ON recurring_giving(person_id);
CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_giving(church_id, status);
CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_giving(church_id, next_date);

-- ============================================
-- GIVING STATEMENTS (Year-end tax statements)
-- ============================================
CREATE TABLE IF NOT EXISTS giving_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  by_fund JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  sent_method VARCHAR(20), -- email, print
  pdf_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_statements_church ON giving_statements(church_id);
CREATE INDEX IF NOT EXISTS idx_statements_person ON giving_statements(person_id);
CREATE INDEX IF NOT EXISTS idx_statements_year ON giving_statements(church_id, year);

-- ============================================
-- Add batch_id and pledge_id to giving table
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'giving' AND column_name = 'batch_id') THEN
    ALTER TABLE giving ADD COLUMN batch_id UUID REFERENCES donation_batches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'giving' AND column_name = 'pledge_id') THEN
    ALTER TABLE giving ADD COLUMN pledge_id UUID REFERENCES pledges(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'giving' AND column_name = 'campaign_id') THEN
    ALTER TABLE giving ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_giving_batch ON giving(batch_id);
CREATE INDEX IF NOT EXISTS idx_giving_pledge ON giving(pledge_id);
CREATE INDEX IF NOT EXISTS idx_giving_campaign ON giving(campaign_id);

-- ============================================
-- RLS Policies for new tables
-- ============================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_giving ENABLE ROW LEVEL SECURITY;
ALTER TABLE giving_statements ENABLE ROW LEVEL SECURITY;

-- Allow full access via service role key (used by the app)
-- Proper scoped policies are in 005_row_level_security.sql
DROP POLICY IF EXISTS "Service role full access" ON campaigns;
DROP POLICY IF EXISTS "Service role full access" ON pledges;
DROP POLICY IF EXISTS "Service role full access" ON donation_batches;
DROP POLICY IF EXISTS "Service role full access" ON batch_items;
DROP POLICY IF EXISTS "Service role full access" ON recurring_giving;
DROP POLICY IF EXISTS "Service role full access" ON giving_statements;

CREATE POLICY "Service role full access" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pledges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON donation_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON batch_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON recurring_giving FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON giving_statements FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Triggers for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_pledges_updated_at ON pledges;
CREATE TRIGGER update_pledges_updated_at BEFORE UPDATE ON pledges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_batches_updated_at ON donation_batches;
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON donation_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_recurring_updated_at ON recurring_giving;
CREATE TRIGGER update_recurring_updated_at BEFORE UPDATE ON recurring_giving
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Helper function to calculate pledge fulfillment
-- ============================================
CREATE OR REPLACE FUNCTION calculate_pledge_fulfillment(pledge_uuid UUID)
RETURNS TABLE(
  total_pledged DECIMAL,
  total_given DECIMAL,
  percentage DECIMAL,
  remaining DECIMAL
) AS $$
DECLARE
  p pledges%ROWTYPE;
  total_pledged_amount DECIMAL;
  total_given_amount DECIMAL;
BEGIN
  SELECT * INTO p FROM pledges WHERE id = pledge_uuid;

  IF p.frequency = 'one-time' THEN
    total_pledged_amount := p.amount;
  ELSE
    -- Calculate based on frequency and date range
    total_pledged_amount := p.amount * (
      CASE p.frequency
        WHEN 'weekly' THEN CEIL((COALESCE(p.end_date, CURRENT_DATE) - p.start_date) / 7.0)
        WHEN 'monthly' THEN CEIL(EXTRACT(MONTH FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1)
        WHEN 'quarterly' THEN CEIL((EXTRACT(MONTH FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1) / 3.0)
        WHEN 'annually' THEN CEIL(EXTRACT(YEAR FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1)
        ELSE 1
      END
    );
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_given_amount
  FROM giving WHERE pledge_id = pledge_uuid;

  RETURN QUERY SELECT
    total_pledged_amount,
    total_given_amount,
    CASE WHEN total_pledged_amount > 0 THEN ROUND((total_given_amount / total_pledged_amount) * 100, 2) ELSE 0 END,
    GREATEST(total_pledged_amount - total_given_amount, 0);
END;
$$ LANGUAGE plpgsql;


-- ############################################################
-- SECTION 4: Migration 002 - Leader Onboarding & Sessions
-- ############################################################

-- GRACE CRM - Leader Onboarding & Pastoral Sessions
-- Migration: 002_leader_onboarding_sessions.sql
-- NOTE: All statements use IF NOT EXISTS / IF EXISTS for idempotent re-runs.

-- ============================================
-- LEADER APPLICATIONS (Onboarding Pipeline)
-- ============================================

CREATE TABLE IF NOT EXISTS leader_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Applicant info
  display_name TEXT NOT NULL,
  title TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  email TEXT,
  phone TEXT,

  -- Qualifications
  expertise_areas TEXT[] NOT NULL DEFAULT '{}',
  credentials TEXT[] NOT NULL DEFAULT '{}',
  years_of_practice INTEGER,
  personality_traits TEXT[] NOT NULL DEFAULT '{}',
  spiritual_focus_areas TEXT[] NOT NULL DEFAULT '{}',
  suitable_for TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'English',
  anchor_verse TEXT,

  -- Session preferences
  session_type TEXT NOT NULL DEFAULT 'one-time' CHECK (session_type IN ('one-time', 'recurring')),
  session_frequency TEXT DEFAULT 'Weekly',

  -- Pipeline status
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'interview', 'training', 'approved', 'active', 'suspended', 'rejected'
  )),
  status_notes TEXT,

  -- Review tracking
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- Background check
  background_check_status TEXT DEFAULT 'not_started' CHECK (background_check_status IN (
    'not_started', 'in_progress', 'passed', 'failed', 'waived'
  )),
  background_check_date DATE,

  -- Training
  training_completed BOOLEAN NOT NULL DEFAULT false,
  training_completed_date DATE,
  training_modules_done TEXT[] NOT NULL DEFAULT '{}',

  -- References
  reference_contacts JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PASTORAL SESSIONS (Session Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS pastoral_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,

  -- Participants
  leader_id TEXT NOT NULL,           -- References LeaderProfile.id
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  help_request_id TEXT,              -- References HelpRequest.id

  -- Session details
  category TEXT NOT NULL CHECK (category IN (
    'marriage', 'addiction', 'grief', 'faith-questions', 'crisis',
    'financial', 'anxiety-depression', 'parenting', 'general'
  )),
  session_type TEXT NOT NULL DEFAULT 'chat' CHECK (session_type IN (
    'chat', 'video', 'phone', 'in-person'
  )),

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,

  -- Outcome
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'scheduled', 'active', 'completed', 'cancelled', 'no-show'
  )),
  notes TEXT,
  follow_up_needed BOOLEAN NOT NULL DEFAULT false,
  follow_up_date DATE,

  -- Feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,

  -- Privacy
  is_anonymous BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- LEADER AVAILABILITY
-- ============================================

CREATE TABLE IF NOT EXISTS leader_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  leader_id TEXT NOT NULL,           -- References LeaderProfile.id
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_leader_applications_church ON leader_applications(church_id);
CREATE INDEX IF NOT EXISTS idx_leader_applications_status ON leader_applications(church_id, status);
CREATE INDEX IF NOT EXISTS idx_leader_applications_person ON leader_applications(person_id);

CREATE INDEX IF NOT EXISTS idx_pastoral_sessions_church ON pastoral_sessions(church_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_sessions_leader ON pastoral_sessions(leader_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_sessions_person ON pastoral_sessions(person_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_sessions_date ON pastoral_sessions(church_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pastoral_sessions_category ON pastoral_sessions(church_id, category);

CREATE INDEX IF NOT EXISTS idx_leader_availability_leader ON leader_availability(leader_id);

-- ============================================
-- ROW-LEVEL SECURITY (policies deferred to 005_row_level_security.sql)
-- ============================================

ALTER TABLE leader_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_availability ENABLE ROW LEVEL SECURITY;

-- Allow full access via service role key (used by the app)
DROP POLICY IF EXISTS "Service role full access" ON leader_applications;
DROP POLICY IF EXISTS "Service role full access" ON pastoral_sessions;
DROP POLICY IF EXISTS "Service role full access" ON leader_availability;

CREATE POLICY "Service role full access" ON leader_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pastoral_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leader_availability FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS set_updated_at ON leader_applications;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leader_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON pastoral_sessions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pastoral_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ############################################################
-- SECTION 5: Migration 003 - AI Messaging System
-- ############################################################

-- AI Messaging System Schema
-- Adds support for content calendar, message scheduling, and reply handling
-- NOTE: All statements use IF NOT EXISTS / IF EXISTS for idempotent re-runs.

-- ============================================
-- SCHEDULED MESSAGES
-- Stores all planned/scheduled outgoing messages
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Message content
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed', 'cancelled')),

  -- Source tracking
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('manual', 'drip_campaign', 'birthday', 'anniversary', 'donation', 'follow_up', 'pastoral_care', 'ai_generated')),
  source_agent VARCHAR(50),
  campaign_id UUID,

  -- AI metadata
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,

  -- Tracking
  external_message_id VARCHAR(255),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_church_date ON scheduled_messages(church_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_person ON scheduled_messages(person_id);

-- ============================================
-- MESSAGE ARCHIVE
-- Historical record of all sent messages
-- ============================================
CREATE TABLE IF NOT EXISTS message_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  scheduled_message_id UUID REFERENCES scheduled_messages(id) ON DELETE SET NULL,

  -- Message details
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms')),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- Delivery info
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Provider info
  provider VARCHAR(20) CHECK (provider IN ('resend', 'twilio')),
  external_id VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_archive_church ON message_archive(church_id);
CREATE INDEX IF NOT EXISTS idx_message_archive_person ON message_archive(church_id, person_id);
CREATE INDEX IF NOT EXISTS idx_message_archive_sent ON message_archive(sent_at DESC);

-- ============================================
-- INBOUND MESSAGES
-- Stores replies and incoming messages
-- ============================================
CREATE TABLE IF NOT EXISTS inbound_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Message content
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms')),
  from_address VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- AI classification
  ai_category VARCHAR(30) CHECK (ai_category IN ('question', 'thanks', 'concern', 'prayer_request', 'event_rsvp', 'unsubscribe', 'spam', 'other')),
  ai_sentiment VARCHAR(20) CHECK (ai_sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  ai_suggested_response TEXT,
  ai_confidence DECIMAL(3,2),

  -- Status
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived', 'flagged')),
  replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Linking
  in_reply_to UUID REFERENCES message_archive(id) ON DELETE SET NULL,

  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_messages_church ON inbound_messages(church_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_status ON inbound_messages(status) WHERE status = 'new';
CREATE INDEX IF NOT EXISTS idx_inbound_messages_person ON inbound_messages(person_id);

-- ============================================
-- DAILY DIGESTS
-- Stores AI-generated daily summaries
-- ============================================
CREATE TABLE IF NOT EXISTS daily_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  digest_date DATE NOT NULL,
  priority_tasks JSONB NOT NULL DEFAULT '[]',
  people_to_contact JSONB NOT NULL DEFAULT '[]',
  messages_to_send JSONB NOT NULL DEFAULT '[]',
  birthdays_today JSONB NOT NULL DEFAULT '[]',
  follow_ups_due JSONB NOT NULL DEFAULT '[]',

  -- AI insights
  ai_summary TEXT,
  ai_recommendations JSONB DEFAULT '[]',

  -- Status
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,

  UNIQUE(church_id, user_id, digest_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_digests_lookup ON daily_digests(church_id, user_id, digest_date);

-- ============================================
-- DRIP CAMPAIGNS
-- Defines automated message sequences
-- ============================================
CREATE TABLE IF NOT EXISTS drip_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('new_member', 'new_visitor', 'donation', 'event_registration', 'manual')),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_campaigns_church ON drip_campaigns(church_id);

-- ============================================
-- DRIP CAMPAIGN STEPS
-- Individual messages in a drip sequence
-- ============================================
CREATE TABLE IF NOT EXISTS drip_campaign_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE NOT NULL,

  step_number INT NOT NULL,
  delay_days INT NOT NULL DEFAULT 0,
  delay_hours INT NOT NULL DEFAULT 0,

  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  use_ai_personalization BOOLEAN DEFAULT false,
  ai_prompt TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign ON drip_campaign_steps(campaign_id);

-- ============================================
-- DRIP CAMPAIGN ENROLLMENTS
-- Tracks people enrolled in campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS drip_campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE NOT NULL,

  current_step INT NOT NULL DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),

  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  next_message_at TIMESTAMPTZ,

  UNIQUE(campaign_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_campaign ON drip_campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_next ON drip_campaign_enrollments(next_message_at) WHERE status = 'active';

-- ============================================
-- ROW LEVEL SECURITY (policies deferred to 005_row_level_security.sql)
-- ============================================

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaign_enrollments ENABLE ROW LEVEL SECURITY;

-- Allow full access via service role key (used by the app)
DROP POLICY IF EXISTS "Service role full access" ON scheduled_messages;
DROP POLICY IF EXISTS "Service role full access" ON message_archive;
DROP POLICY IF EXISTS "Service role full access" ON inbound_messages;
DROP POLICY IF EXISTS "Service role full access" ON daily_digests;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaigns;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaign_steps;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaign_enrollments;

CREATE POLICY "Service role full access" ON scheduled_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON message_archive FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON inbound_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON daily_digests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON drip_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON drip_campaign_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON drip_campaign_enrollments FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get pending scheduled messages
CREATE OR REPLACE FUNCTION get_pending_messages(p_church_id UUID)
RETURNS TABLE (
  id UUID,
  person_id UUID,
  person_name TEXT,
  channel VARCHAR(20),
  subject VARCHAR(255),
  body TEXT,
  scheduled_for TIMESTAMPTZ,
  source_type VARCHAR(30)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.person_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') as person_name,
    sm.channel,
    sm.subject,
    sm.body,
    sm.scheduled_for,
    sm.source_type
  FROM scheduled_messages sm
  LEFT JOIN people p ON sm.person_id = p.id
  WHERE sm.church_id = p_church_id
    AND sm.status = 'scheduled'
    AND sm.scheduled_for <= NOW()
  ORDER BY sm.scheduled_for ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily digest data
CREATE OR REPLACE FUNCTION get_daily_digest_data(p_church_id UUID, p_date DATE)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'birthdays', (
      SELECT json_agg(json_build_object(
        'id', id,
        'name', first_name || ' ' || last_name,
        'email', email,
        'phone', phone
      ))
      FROM people
      WHERE church_id = p_church_id
        AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM p_date)
        AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM p_date)
    ),
    'scheduled_messages', (
      SELECT json_agg(json_build_object(
        'id', sm.id,
        'person_name', COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
        'channel', sm.channel,
        'scheduled_for', sm.scheduled_for,
        'source_type', sm.source_type
      ))
      FROM scheduled_messages sm
      LEFT JOIN people p ON sm.person_id = p.id
      WHERE sm.church_id = p_church_id
        AND sm.status = 'scheduled'
        AND DATE(sm.scheduled_for) = p_date
    ),
    'pending_tasks', (
      SELECT json_agg(json_build_object(
        'id', t.id,
        'title', t.title,
        'priority', t.priority,
        'person_name', COALESCE(p.first_name || ' ' || p.last_name, NULL),
        'due_date', t.due_date
      ))
      FROM tasks t
      LEFT JOIN people p ON t.person_id = p.id
      WHERE t.church_id = p_church_id
        AND t.completed = false
        AND DATE(t.due_date) <= p_date
      ORDER BY t.priority DESC, t.due_date ASC
      LIMIT 20
    ),
    'new_inbound', (
      SELECT COUNT(*)
      FROM inbound_messages
      WHERE church_id = p_church_id
        AND status = 'new'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ############################################################
-- SECTION 6: Migration 004 - Agent Logging System
-- ############################################################

-- Agent Logging System
-- Provides persistent storage for AI agent execution logs and statistics
-- NOTE: All statements use IF NOT EXISTS / IF EXISTS for idempotent re-runs.

-- ============================================
-- AGENT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  agent_id VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_church ON agent_logs(church_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_level ON agent_logs(level);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at DESC);

-- ============================================
-- AGENT STATS
-- ============================================
CREATE TABLE IF NOT EXISTS agent_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  agent_id VARCHAR(100) NOT NULL,
  total_actions INTEGER DEFAULT 0,
  successful_actions INTEGER DEFAULT 0,
  failed_actions INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_stats_church ON agent_stats(church_id);

-- ============================================
-- AGENT EXECUTIONS (detailed run history)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  agent_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  dry_run BOOLEAN DEFAULT false,
  actions_executed INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_agent_executions_church ON agent_executions(church_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to insert a log and auto-cleanup old logs
CREATE OR REPLACE FUNCTION insert_agent_log(
  p_church_id UUID,
  p_agent_id VARCHAR(100),
  p_level VARCHAR(20),
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO agent_logs (church_id, agent_id, level, message, metadata)
  VALUES (p_church_id, p_agent_id, p_level, p_message, p_metadata)
  RETURNING id INTO v_log_id;

  -- Auto-cleanup: keep only last 1000 logs per church
  DELETE FROM agent_logs
  WHERE church_id = p_church_id
    AND id NOT IN (
      SELECT id FROM agent_logs
      WHERE church_id = p_church_id
      ORDER BY created_at DESC
      LIMIT 1000
    );

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update agent stats
CREATE OR REPLACE FUNCTION update_agent_stats(
  p_church_id UUID,
  p_agent_id VARCHAR(100),
  p_actions_executed INTEGER DEFAULT 0,
  p_actions_failed INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO agent_stats (church_id, agent_id, total_actions, successful_actions, failed_actions, last_run_at)
  VALUES (
    p_church_id,
    p_agent_id,
    p_actions_executed + p_actions_failed,
    p_actions_executed,
    p_actions_failed,
    NOW()
  )
  ON CONFLICT (church_id, agent_id) DO UPDATE SET
    total_actions = agent_stats.total_actions + EXCLUDED.total_actions,
    successful_actions = agent_stats.successful_actions + EXCLUDED.successful_actions,
    failed_actions = agent_stats.failed_actions + EXCLUDED.failed_actions,
    last_run_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (via service role key)
DROP POLICY IF EXISTS "Service role can manage agent_logs" ON agent_logs;
DROP POLICY IF EXISTS "Service role can manage agent_stats" ON agent_stats;
DROP POLICY IF EXISTS "Service role can manage agent_executions" ON agent_executions;

CREATE POLICY "Service role can manage agent_logs"
  ON agent_logs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage agent_stats"
  ON agent_stats FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage agent_executions"
  ON agent_executions FOR ALL
  USING (true)
  WITH CHECK (true);


-- ############################################################
-- SECTION 7: Migration 005 - Row Level Security
-- ############################################################

-- GRACE CRM - Row Level Security Policies
-- Migration: 005_row_level_security.sql
-- NOTE: All statements use DROP IF EXISTS before CREATE for idempotent re-runs.
--
-- This migration adds proper church-scoped RLS policies.
-- Prerequisites: Supabase auth must be configured with app_metadata.church_id in JWT claims.
--
-- To apply: Run this in the Supabase SQL editor AFTER configuring auth,
-- or it will be applied automatically via Supabase CLI migrations.

-- ============================================
-- HELPER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.get_church_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'church_id')::UUID;
$$ LANGUAGE sql STABLE;

-- ============================================
-- DROP PERMISSIVE POLICIES (from initial migrations)
-- ============================================

DROP POLICY IF EXISTS "Service role full access" ON churches;
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Service role full access" ON people;
DROP POLICY IF EXISTS "Service role full access" ON small_groups;
DROP POLICY IF EXISTS "Service role full access" ON group_memberships;
DROP POLICY IF EXISTS "Service role full access" ON interactions;
DROP POLICY IF EXISTS "Service role full access" ON tasks;
DROP POLICY IF EXISTS "Service role full access" ON prayer_requests;
DROP POLICY IF EXISTS "Service role full access" ON calendar_events;
DROP POLICY IF EXISTS "Service role full access" ON attendance;
DROP POLICY IF EXISTS "Service role full access" ON giving;
DROP POLICY IF EXISTS "Service role full access" ON leader_applications;
DROP POLICY IF EXISTS "Service role full access" ON pastoral_sessions;
DROP POLICY IF EXISTS "Service role full access" ON leader_availability;
DROP POLICY IF EXISTS "Service role full access" ON scheduled_messages;
DROP POLICY IF EXISTS "Service role full access" ON message_archive;
DROP POLICY IF EXISTS "Service role full access" ON inbound_messages;
DROP POLICY IF EXISTS "Service role full access" ON daily_digests;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaigns;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaign_steps;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaign_enrollments;
DROP POLICY IF EXISTS "Service role full access" ON campaigns;
DROP POLICY IF EXISTS "Service role full access" ON pledges;
DROP POLICY IF EXISTS "Service role full access" ON donation_batches;
DROP POLICY IF EXISTS "Service role full access" ON batch_items;
DROP POLICY IF EXISTS "Service role full access" ON recurring_giving;
DROP POLICY IF EXISTS "Service role full access" ON giving_statements;

-- ============================================
-- DROP ALL SCOPED POLICIES (for idempotent re-runs)
-- ============================================

-- 001 tables
DROP POLICY IF EXISTS "Users can view own church" ON churches;
DROP POLICY IF EXISTS "Users can view same-church users" ON users;
DROP POLICY IF EXISTS "Church members can view people" ON people;
DROP POLICY IF EXISTS "Church members can insert people" ON people;
DROP POLICY IF EXISTS "Church members can update people" ON people;
DROP POLICY IF EXISTS "Church admins can delete people" ON people;
DROP POLICY IF EXISTS "Church members can view groups" ON small_groups;
DROP POLICY IF EXISTS "Church members can manage groups" ON small_groups;
DROP POLICY IF EXISTS "Church members can view memberships" ON group_memberships;
DROP POLICY IF EXISTS "Church members can manage memberships" ON group_memberships;
DROP POLICY IF EXISTS "Church members can view interactions" ON interactions;
DROP POLICY IF EXISTS "Church members can create interactions" ON interactions;
DROP POLICY IF EXISTS "Church members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Church members can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Church members can view public prayers" ON prayer_requests;
DROP POLICY IF EXISTS "Church members can manage prayers" ON prayer_requests;
DROP POLICY IF EXISTS "Church members can view events" ON calendar_events;
DROP POLICY IF EXISTS "Church members can manage events" ON calendar_events;
DROP POLICY IF EXISTS "Church members can view attendance" ON attendance;
DROP POLICY IF EXISTS "Church members can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Church members can view giving" ON giving;
DROP POLICY IF EXISTS "Church members can manage giving" ON giving;

-- 002 leader tables
DROP POLICY IF EXISTS "Church members can view leader applications" ON leader_applications;
DROP POLICY IF EXISTS "Church members can manage leader applications" ON leader_applications;
DROP POLICY IF EXISTS "Church members can view pastoral sessions" ON pastoral_sessions;
DROP POLICY IF EXISTS "Church members can manage pastoral sessions" ON pastoral_sessions;
DROP POLICY IF EXISTS "Church members can view leader availability" ON leader_availability;
DROP POLICY IF EXISTS "Church members can manage leader availability" ON leader_availability;

-- 003 tables
DROP POLICY IF EXISTS "Users can view scheduled_messages for their church" ON scheduled_messages;
DROP POLICY IF EXISTS "Users can insert scheduled_messages for their church" ON scheduled_messages;
DROP POLICY IF EXISTS "Users can update scheduled_messages for their church" ON scheduled_messages;
DROP POLICY IF EXISTS "Users can delete scheduled_messages for their church" ON scheduled_messages;
DROP POLICY IF EXISTS "Users can view message_archive for their church" ON message_archive;
DROP POLICY IF EXISTS "Users can insert message_archive for their church" ON message_archive;
DROP POLICY IF EXISTS "Users can view inbound_messages for their church" ON inbound_messages;
DROP POLICY IF EXISTS "Users can update inbound_messages for their church" ON inbound_messages;
DROP POLICY IF EXISTS "Users can insert inbound_messages for their church" ON inbound_messages;
DROP POLICY IF EXISTS "Users can view their own daily_digests" ON daily_digests;
DROP POLICY IF EXISTS "Users can insert daily_digests for their church" ON daily_digests;
DROP POLICY IF EXISTS "Users can view drip_campaigns for their church" ON drip_campaigns;
DROP POLICY IF EXISTS "Users can manage drip_campaigns for their church" ON drip_campaigns;
DROP POLICY IF EXISTS "Users can view drip_campaign_steps for their campaigns" ON drip_campaign_steps;
DROP POLICY IF EXISTS "Users can manage drip_campaign_steps for their campaigns" ON drip_campaign_steps;
DROP POLICY IF EXISTS "Users can view enrollments for their campaigns" ON drip_campaign_enrollments;
DROP POLICY IF EXISTS "Users can manage enrollments for their campaigns" ON drip_campaign_enrollments;

-- 002 collection tables
DROP POLICY IF EXISTS "Church members can view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Church members can manage campaigns" ON campaigns;
DROP POLICY IF EXISTS "Church members can view pledges" ON pledges;
DROP POLICY IF EXISTS "Church members can manage pledges" ON pledges;
DROP POLICY IF EXISTS "Church members can view donation batches" ON donation_batches;
DROP POLICY IF EXISTS "Church members can manage donation batches" ON donation_batches;
DROP POLICY IF EXISTS "Church members can view batch items" ON batch_items;
DROP POLICY IF EXISTS "Church members can manage batch items" ON batch_items;
DROP POLICY IF EXISTS "Church members can view recurring giving" ON recurring_giving;
DROP POLICY IF EXISTS "Church members can manage recurring giving" ON recurring_giving;
DROP POLICY IF EXISTS "Church members can view giving statements" ON giving_statements;
DROP POLICY IF EXISTS "Church members can manage giving statements" ON giving_statements;

-- ============================================
-- 001 TABLE POLICIES
-- ============================================

-- Churches: users can only see their own church
CREATE POLICY "Users can view own church"
  ON churches FOR SELECT
  USING (id = public.get_church_id());

-- Users: scoped to same church
CREATE POLICY "Users can view same-church users"
  ON users FOR SELECT
  USING (church_id = public.get_church_id());

-- People: full CRUD scoped to church
CREATE POLICY "Church members can view people"
  ON people FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can insert people"
  ON people FOR INSERT
  WITH CHECK (church_id = public.get_church_id());

CREATE POLICY "Church members can update people"
  ON people FOR UPDATE
  USING (church_id = public.get_church_id());

CREATE POLICY "Church admins can delete people"
  ON people FOR DELETE
  USING (church_id = public.get_church_id());

-- Small Groups: scoped to church
CREATE POLICY "Church members can view groups"
  ON small_groups FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage groups"
  ON small_groups FOR ALL
  USING (church_id = public.get_church_id());

-- Group Memberships: via group's church_id
CREATE POLICY "Church members can view memberships"
  ON group_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM small_groups
      WHERE small_groups.id = group_memberships.group_id
      AND small_groups.church_id = public.get_church_id()
    )
  );

CREATE POLICY "Church members can manage memberships"
  ON group_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM small_groups
      WHERE small_groups.id = group_memberships.group_id
      AND small_groups.church_id = public.get_church_id()
    )
  );

-- Interactions: scoped to church
CREATE POLICY "Church members can view interactions"
  ON interactions FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can create interactions"
  ON interactions FOR INSERT
  WITH CHECK (church_id = public.get_church_id());

-- Tasks: scoped to church
CREATE POLICY "Church members can view tasks"
  ON tasks FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage tasks"
  ON tasks FOR ALL
  USING (church_id = public.get_church_id());

-- Prayer Requests: scoped to church, private ones visible to staff+
CREATE POLICY "Church members can view public prayers"
  ON prayer_requests FOR SELECT
  USING (
    church_id = public.get_church_id()
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
  USING (church_id = public.get_church_id());

-- Calendar Events: scoped to church
CREATE POLICY "Church members can view events"
  ON calendar_events FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage events"
  ON calendar_events FOR ALL
  USING (church_id = public.get_church_id());

-- Attendance: scoped to church
CREATE POLICY "Church members can view attendance"
  ON attendance FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage attendance"
  ON attendance FOR ALL
  USING (church_id = public.get_church_id());

-- Giving: scoped to church
CREATE POLICY "Church members can view giving"
  ON giving FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage giving"
  ON giving FOR ALL
  USING (church_id = public.get_church_id());

-- ============================================
-- 002 TABLE POLICIES
-- ============================================

-- Leader Applications: scoped to church
CREATE POLICY "Church members can view leader applications"
  ON leader_applications FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage leader applications"
  ON leader_applications FOR ALL
  USING (church_id = public.get_church_id());

-- Pastoral Sessions: scoped to church
CREATE POLICY "Church members can view pastoral sessions"
  ON pastoral_sessions FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage pastoral sessions"
  ON pastoral_sessions FOR ALL
  USING (church_id = public.get_church_id());

-- Leader Availability: scoped to church
CREATE POLICY "Church members can view leader availability"
  ON leader_availability FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage leader availability"
  ON leader_availability FOR ALL
  USING (church_id = public.get_church_id());

-- ============================================
-- 003 TABLE POLICIES
-- ============================================

-- Scheduled Messages
CREATE POLICY "Users can view scheduled_messages for their church" ON scheduled_messages
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert scheduled_messages for their church" ON scheduled_messages
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can update scheduled_messages for their church" ON scheduled_messages
  FOR UPDATE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can delete scheduled_messages for their church" ON scheduled_messages
  FOR DELETE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Message Archive
CREATE POLICY "Users can view message_archive for their church" ON message_archive
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert message_archive for their church" ON message_archive
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Inbound Messages
CREATE POLICY "Users can view inbound_messages for their church" ON inbound_messages
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can update inbound_messages for their church" ON inbound_messages
  FOR UPDATE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert inbound_messages for their church" ON inbound_messages
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Daily Digests
CREATE POLICY "Users can view their own daily_digests" ON daily_digests
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    OR church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "Users can insert daily_digests for their church" ON daily_digests
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Drip Campaigns
CREATE POLICY "Users can view drip_campaigns for their church" ON drip_campaigns
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can manage drip_campaigns for their church" ON drip_campaigns
  FOR ALL USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Drip Campaign Steps
CREATE POLICY "Users can view drip_campaign_steps for their campaigns" ON drip_campaign_steps
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can manage drip_campaign_steps for their campaigns" ON drip_campaign_steps
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

-- Drip Campaign Enrollments
CREATE POLICY "Users can view enrollments for their campaigns" ON drip_campaign_enrollments
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can manage enrollments for their campaigns" ON drip_campaign_enrollments
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

-- ============================================
-- 002_COLLECTION TABLE POLICIES
-- ============================================

-- Campaigns: scoped to church
CREATE POLICY "Church members can view campaigns"
  ON campaigns FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage campaigns"
  ON campaigns FOR ALL
  USING (church_id = public.get_church_id());

-- Pledges: scoped to church
CREATE POLICY "Church members can view pledges"
  ON pledges FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage pledges"
  ON pledges FOR ALL
  USING (church_id = public.get_church_id());

-- Donation Batches: scoped to church
CREATE POLICY "Church members can view donation batches"
  ON donation_batches FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage donation batches"
  ON donation_batches FOR ALL
  USING (church_id = public.get_church_id());

-- Batch Items: via batch's church_id
CREATE POLICY "Church members can view batch items"
  ON batch_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM donation_batches
      WHERE donation_batches.id = batch_items.batch_id
      AND donation_batches.church_id = public.get_church_id()
    )
  );

CREATE POLICY "Church members can manage batch items"
  ON batch_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM donation_batches
      WHERE donation_batches.id = batch_items.batch_id
      AND donation_batches.church_id = public.get_church_id()
    )
  );

-- Recurring Giving: scoped to church
CREATE POLICY "Church members can view recurring giving"
  ON recurring_giving FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage recurring giving"
  ON recurring_giving FOR ALL
  USING (church_id = public.get_church_id());

-- Giving Statements: scoped to church
CREATE POLICY "Church members can view giving statements"
  ON giving_statements FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage giving statements"
  ON giving_statements FOR ALL
  USING (church_id = public.get_church_id());


-- ############################################################
-- SECTION 8: Seed Data
-- ############################################################

-- Grace CRM Comprehensive Seed Data
-- Run this after migrations to populate test data

-- ============================================
-- CHURCH (Required for all foreign keys)
-- ============================================
INSERT INTO churches (id, name, slug, timezone, settings) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Grace Community Church', 'grace-community', 'America/Chicago',
   '{"theme": "light", "features": {"ai_messaging": true, "donations": true}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- USERS (Staff/Admin accounts)
-- ============================================
INSERT INTO users (id, church_id, clerk_id, email, first_name, last_name, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'clerk_pastor_john', 'pastor.john@gracechurch.org', 'John', 'Smith', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'clerk_mary_admin', 'mary.admin@gracechurch.org', 'Mary', 'Johnson', 'admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'clerk_tom_staff', 'tom.staff@gracechurch.org', 'Tom', 'Williams', 'staff'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'clerk_sarah_vol', 'sarah.volunteer@gracechurch.org', 'Sarah', 'Davis', 'volunteer')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PEOPLE (Congregation members - 35 diverse records)
-- ============================================
INSERT INTO people (id, church_id, first_name, last_name, email, phone, status, birth_date, join_date, first_visit, tags, family_id, notes) VALUES
  -- Original members
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sarah', 'Mitchell', 'sarah.mitchell@email.com', '(555) 123-4567', 'visitor', '1995-03-15', NULL, '2024-12-29', ARRAY['first-time', 'young-adult'], NULL, 'Came with friend Maria. Interested in small groups.'),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'James', 'Peterson', 'james.p@email.com', '(555) 234-5678', 'member', '1988-01-26', '2023-06-15', NULL, ARRAY['volunteer', 'greeter'], NULL, 'Serves on greeting team every 2nd Sunday.'),
  ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Maria', 'Garcia', 'maria.garcia@email.com', '(555) 345-6789', 'regular', '1992-07-22', NULL, '2024-08-10', ARRAY['young-adult'], NULL, 'Brought friend Sarah on 12/29.'),
  ('00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Robert', 'Chen', 'robert.chen@email.com', '(555) 456-7890', 'leader', '1975-01-29', '2020-03-01', NULL, ARRAY['elder', 'small-group-leader'], NULL, 'Elder. Leads Tuesday night mens group.'),
  ('00000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Emily', 'Johnson', 'emily.j@email.com', '(555) 567-8901', 'inactive', '1988-11-30', '2022-01-10', NULL, ARRAY[]::text[], NULL, 'Hasnt attended in 6 weeks. Last contact was about job stress.'),
  ('00000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Cam', 'Deich', 'cdeichmiller11@gmail.com', '(555) 678-9012', 'member', '1993-01-24', '2021-09-20', NULL, ARRAY['worship-team', 'musician'], NULL, 'Test user for AI email features.'),
  ('00000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Lisa', 'Thompson', 'lisa.t@email.com', '(555) 789-0123', 'visitor', '1984-04-12', NULL, '2025-01-01', ARRAY['first-time', 'family'], 'ffffffff-0000-0000-0000-000000000001', 'New Years service visitor. Has 2 kids (ages 5, 8).'),
  ('00000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Michael', 'Brown', 'michael.b@email.com', '(555) 890-1234', 'member', '1975-08-03', '2019-11-15', NULL, ARRAY['deacon', 'finance-team'], NULL, 'Serves on finance committee.'),

  -- People with upcoming birthdays
  ('00000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Amanda', 'Foster', 'amanda.foster@email.com', '(555) 901-2345', 'member', '1985-01-25', '2022-05-20', NULL, ARRAY['womens-ministry', 'prayer-team'], NULL, 'Active in womens Bible study. Great encourager.'),
  ('00000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Kevin', 'Martinez', 'kevin.m@email.com', '(555) 012-3456', 'member', '1990-01-27', '2021-01-22', NULL, ARRAY['tech-team', 'young-professional'], NULL, 'Runs sound booth. Works in IT.'),
  ('00000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Rachel', 'Kim', 'rachel.kim@email.com', '(555) 123-4560', 'member', '1987-01-30', '2025-01-24', NULL, ARRAY['childrens-ministry', 'teacher'], NULL, 'Teaches 3rd grade Sunday school. Very dedicated.'),
  ('00000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'Thomas', 'Wright', 'tom.wright@email.com', '(555) 234-5670', 'leader', '1970-12-25', '2018-06-10', NULL, ARRAY['elder', 'missions-team'], NULL, 'Oversees missions committee. Went on 3 mission trips.'),

  -- Recent visitors
  ('00000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'Cam', '1993', 'camd1993@gmail.com', '(555) 345-6780', 'visitor', '1990-02-14', NULL, '2025-01-21', ARRAY['first-time', 'young-family'], NULL, 'Test user for AI email features.'),
  ('00000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'Marcus', 'Taylor', 'marcus.t@email.com', '(555) 456-7801', 'visitor', '1987-09-08', NULL, '2025-01-23', ARRAY['first-time'], NULL, 'Coworker of James Peterson. First church visit in 5 years.'),
  ('00000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'Ashley', 'Robinson', 'ashley.r@email.com', '(555) 567-8902', 'visitor', '1993-05-21', NULL, '2025-01-24', ARRAY['first-time', 'college-student'], NULL, 'Graduate student at local university. Interested in young adults group.'),

  -- Regular attendees becoming members
  ('00000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 'Brian', 'Cooper', 'brian.cooper@email.com', '(555) 678-9013', 'regular', '1982-10-30', NULL, '2024-09-15', ARRAY['mens-group'], NULL, 'Been attending regularly for 4 months. Ready for membership class?'),
  ('00000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', 'Nicole', 'Davis', 'nicole.d@email.com', '(555) 789-0124', 'regular', '1991-01-28', NULL, '2024-10-01', ARRAY['young-adult', 'creative'], NULL, 'Graphic designer. Volunteered for bulletin design.'),

  -- Members with membership anniversaries
  ('00000000-0000-0000-0000-000000000018', '11111111-1111-1111-1111-111111111111', 'Daniel', 'Lee', 'daniel.lee@email.com', '(555) 890-1235', 'member', '1979-06-18', '2023-01-26', NULL, ARRAY['usher', 'parking-team'], NULL, 'Faithful usher. Never misses a Sunday.'),
  ('00000000-0000-0000-0000-000000000019', '11111111-1111-1111-1111-111111111111', 'Stephanie', 'Moore', 'steph.moore@email.com', '(555) 901-2346', 'member', '1986-01-07', '2022-01-29', NULL, ARRAY['hospitality', 'events-team'], NULL, 'Coordinates fellowship meals. Amazing cook!'),

  -- First-time givers
  ('00000000-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'Christopher', 'Hall', 'chris.hall@email.com', '(555) 012-3457', 'regular', '1991-03-25', NULL, '2024-11-10', ARRAY['young-professional'], NULL, 'Attending for 2 months. Made first donation last week!'),
  ('00000000-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'Lauren', 'White', 'lauren.w@email.com', '(555) 123-4561', 'member', '1989-08-14', '2023-02-12', NULL, ARRAY['choir', 'worship-team'], NULL, 'Beautiful soprano voice. Joined choir immediately.'),

  -- Inactive members for re-engagement
  ('00000000-0000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 'Andrew', 'Clark', 'andrew.c@email.com', '(555) 234-5671', 'inactive', '1985-01-25', '2021-04-15', NULL, ARRAY[]::text[], NULL, 'Stopped attending after job change. Moved across town.'),
  ('00000000-0000-0000-0000-000000000023', '11111111-1111-1111-1111-111111111111', 'Michelle', 'Young', 'michelle.y@email.com', '(555) 345-6781', 'inactive', '1983-04-02', '2020-08-20', NULL, ARRAY[]::text[], NULL, 'Family health issues. Last contact 2 months ago.'),

  -- Large donors
  ('00000000-0000-0000-0000-000000000024', '11111111-1111-1111-1111-111111111111', 'Richard', 'Anderson', 'richard.a@email.com', '(555) 456-7802', 'member', '1965-11-12', '2015-01-10', NULL, ARRAY['elder', 'major-donor'], NULL, 'Retired business owner. Very generous supporter of missions.'),
  ('00000000-0000-0000-0000-000000000025', '11111111-1111-1111-1111-111111111111', 'Patricia', 'Thomas', 'patricia.t@email.com', '(555) 567-8903', 'member', '1958-07-30', '2017-06-25', NULL, ARRAY['prayer-team', 'major-donor'], NULL, 'Prayer warrior. Supports benevolence fund regularly.'),

  -- Thompson family members
  ('00000000-0000-0000-0000-000000000026', '11111111-1111-1111-1111-111111111111', 'Mark', 'Thompson', 'mark.thompson@email.com', '(555) 789-0125', 'member', '1982-04-18', '2025-01-05', NULL, ARRAY['family'], 'ffffffff-0000-0000-0000-000000000001', 'Lisa Thompsons husband. Joined after visiting on New Years.'),
  ('00000000-0000-0000-0000-000000000027', '11111111-1111-1111-1111-111111111111', 'Emma', 'Thompson', NULL, '(555) 789-0125', 'member', '2017-06-10', '2025-01-05', NULL, ARRAY['child', 'kids-ministry'], 'ffffffff-0000-0000-0000-000000000001', 'Lisa & Marks daughter, age 8. Loves Sunday school.'),
  ('00000000-0000-0000-0000-000000000028', '11111111-1111-1111-1111-111111111111', 'Ethan', 'Thompson', NULL, NULL, 'member', '2020-03-22', '2025-01-05', NULL, ARRAY['child', 'kids-ministry'], 'ffffffff-0000-0000-0000-000000000001', 'Lisa & Marks son, age 5. In preschool class.'),

  -- Additional diverse members
  ('00000000-0000-0000-0000-000000000029', '11111111-1111-1111-1111-111111111111', 'Grace', 'Williams', 'grace.w@email.com', '(555) 111-2222', 'member', '1978-05-15', '2019-02-05', NULL, ARRAY['womens-ministry', 'hospitality'], NULL, 'Hosts monthly womens brunch. Very welcoming.'),
  ('00000000-0000-0000-0000-000000000030', '11111111-1111-1111-1111-111111111111', 'David', 'Park', 'david.park@email.com', '(555) 222-3333', 'member', '1985-09-20', '2020-02-14', NULL, ARRAY['tech-team', 'media'], NULL, 'Runs livestream. Software engineer.'),
  ('00000000-0000-0000-0000-000000000031', '11111111-1111-1111-1111-111111111111', 'Jennifer', 'Scott', 'jen.scott@email.com', '(555) 333-4444', 'regular', '1995-12-08', NULL, '2024-11-17', ARRAY['young-adult'], NULL, 'Moved to town recently. Looking for community.'),
  ('00000000-0000-0000-0000-000000000032', '11111111-1111-1111-1111-111111111111', 'William', 'Harris', 'will.harris@email.com', '(555) 444-5555', 'member', '1960-02-28', '2010-06-20', NULL, ARRAY['elder', 'teaching'], NULL, 'Retired professor. Leads adult Sunday school.'),
  ('00000000-0000-0000-0000-000000000033', '11111111-1111-1111-1111-111111111111', 'Susan', 'Harris', 'susan.harris@email.com', '(555) 444-5556', 'member', '1962-08-14', '2010-06-20', NULL, ARRAY['womens-ministry'], 'ffffffff-0000-0000-0000-000000000002', 'Williams wife. Active in prayer ministry.'),
  ('00000000-0000-0000-0000-000000000034', '11111111-1111-1111-1111-111111111111', 'Jason', 'Reed', 'jason.reed@email.com', '(555) 555-6666', 'visitor', '1998-04-05', NULL, '2025-01-19', ARRAY['first-time', 'young-adult'], NULL, 'College friend of Ashley. Came together last week.'),
  ('00000000-0000-0000-0000-000000000035', '11111111-1111-1111-1111-111111111111', 'Elizabeth', 'Adams', 'liz.adams@email.com', '(555) 666-7777', 'member', '1972-11-22', '2016-02-20', NULL, ARRAY['choir', 'hospitality'], NULL, 'Alto section leader. Coordinates potlucks.')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SMALL GROUPS
-- ============================================
INSERT INTO small_groups (id, church_id, name, description, leader_id, meeting_day, meeting_time, location, is_active) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Tuesday night mens Bible study and accountability group.', '00000000-0000-0000-0000-000000000004', 'Tuesday', '19:00', 'Room 201', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Community for 20s and 30s. Life, faith, and fellowship.', '00000000-0000-0000-0000-000000000010', 'Thursday', '19:30', 'Coffee House', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Wednesday morning womens Bible study and prayer group.', '00000000-0000-0000-0000-000000000009', 'Wednesday', '09:30', 'Fellowship Hall', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '11111111-1111-1111-1111-111111111111', 'Marriage Matters', 'Monthly gathering for married couples.', '00000000-0000-0000-0000-000000000032', 'Saturday', '18:00', 'Family Life Center', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Fellowship and Bible study for seniors 60+.', '00000000-0000-0000-0000-000000000025', 'Thursday', '10:00', 'Room 105', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- GROUP MEMBERSHIPS
-- ============================================
INSERT INTO group_memberships (group_id, person_id) VALUES
  -- Men of Faith
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000002'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000004'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000008'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000012'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000016'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000018'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000024'),
  -- Young Adults
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000003'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000006'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000010'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000017'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000020'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000030'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000031'),
  -- Women of Grace
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000009'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000011'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000019'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000021'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000025'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000029'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000033'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000035'),
  -- Marriage Matters
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '00000000-0000-0000-0000-000000000032'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '00000000-0000-0000-0000-000000000033'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '00000000-0000-0000-0000-000000000007'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '00000000-0000-0000-0000-000000000026'),
  -- Senior Saints
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '00000000-0000-0000-0000-000000000025'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '00000000-0000-0000-0000-000000000024'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '00000000-0000-0000-0000-000000000032'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '00000000-0000-0000-0000-000000000033')
ON CONFLICT DO NOTHING;

-- ============================================
-- INTERACTIONS (Communication logs)
-- ============================================
INSERT INTO interactions (id, church_id, person_id, type, content, created_by, created_at) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'note', 'First visit! Came with Maria Garcia. Very engaged during service. Asked about small groups.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2024-12-29 11:30:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff1', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'call', 'Called to check in. Emily shared shes been stressed with job situation. Prayed together.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2024-12-01 14:00:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff2', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000007', 'note', 'New Years service visitor. Family of 4. Kids enjoyed childrens church.', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-01-01 12:00:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff3', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'note', 'First-time visitor looking for a church home. Recently moved to the area.', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-01-21 11:45:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff4', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000014', 'note', 'James Petersons coworker. Hasnt been to church in years but seemed very open.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-23 12:15:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff5', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'visit', 'Met Richard for coffee to discuss his vision for missions giving. Very passionate about Southeast Asia.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-15 10:00:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff6', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'call', 'Called to check on family. Mother still in treatment. Appreciated the prayer.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-10 15:30:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff7', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'email', 'Sent first-time giver thank you email. Christopher replied saying he felt called to give.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-18 09:00:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff8', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000015', 'note', 'Graduate student interested in young adults group. Connected her with Kevin Martinez.', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-01-24 12:30:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff9', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', 'note', 'Brian has been very consistent. Recommended for next membership class.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-20 11:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TASKS
-- ============================================
INSERT INTO tasks (id, church_id, person_id, title, description, due_date, completed, priority, category, assigned_to, created_at) VALUES
  -- Today (Jan 30, 2026)
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Follow up with Sarah Mitchell', 'First-time visitor. Send welcome email and invite to coffee.', '2026-01-30', false, 'high', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-25'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000007', 'Connect Lisa Thompson with kids ministry', 'New visitor with 2 kids. Introduce to childrens pastor.', '2026-01-30', false, 'high', 'follow-up', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-01-27'),

  -- Tomorrow (Jan 31, 2026)
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'Check in on Emily Johnson', 'Inactive 6 weeks. Last mentioned job stress. Care call needed.', '2026-01-31', false, 'medium', 'care', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-20'),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111111', NULL, 'Prepare Q1 giving report', 'Compile giving data for elder meeting.', '2026-01-31', false, 'low', 'admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-01-25'),

  -- This week (Feb 1-6, 2026)
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'Thank Maria for bringing guest', 'She brought Sarah to service. Send appreciation note.', '2026-02-01', false, 'medium', 'outreach', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-28'),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'Follow up with Cam 1993', 'First-time visitor looking for church home. Send welcome email.', '2026-02-02', false, 'high', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-28'),
  ('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000014', 'Follow up with Marcus Taylor', 'James Petersons coworker. First church visit in 5 years.', '2026-02-03', false, 'high', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-29'),
  ('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000015', 'Connect Ashley with young adults', 'Graduate student interested in young adults group.', '2026-02-04', false, 'high', 'follow-up', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-01-29'),
  ('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'Check on Michelle Youngs family', 'Family health issues. Send care package and follow up.', '2026-02-05', false, 'high', 'care', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-25'),

  -- Later (Feb 7+, 2026)
  ('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', 'Invite Brian Cooper to membership class', 'Regular attender for 4 months. Ready for next step.', '2026-02-08', false, 'medium', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-30'),
  ('22222222-2222-2222-2222-222222222211', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'Thank Christopher Hall for first gift', 'Made first donation last week. Personal thank you.', '2026-02-10', false, 'medium', 'outreach', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-29'),
  ('22222222-2222-2222-2222-222222222212', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'Acknowledge Richard Andersons missions gift', '$5,000 missions gift. Schedule coffee with pastor.', '2026-02-12', false, 'high', 'outreach', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-28'),
  ('22222222-2222-2222-2222-222222222213', '11111111-1111-1111-1111-111111111111', NULL, 'Plan March events calendar', 'Coordinate with ministry leaders for March events.', '2026-02-15', false, 'low', 'admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-01-30'),
  ('22222222-2222-2222-2222-222222222214', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000022', 'Birthday outreach to Andrew Clark', 'Inactive member. Good re-engagement opportunity.', '2026-02-18', false, 'medium', 'care', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-30'),
  ('22222222-2222-2222-2222-222222222215', '11111111-1111-1111-1111-111111111111', NULL, 'Review volunteer schedule for March', 'Ensure all Sunday positions are filled for March.', '2026-02-20', false, 'medium', 'admin', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-01-30'),

  -- Completed task example
  ('22222222-2222-2222-2222-222222222216', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'Welcome James Peterson to volunteer team', 'Signed up for greeting team. Onboard him this week.', '2026-01-28', true, 'medium', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-22')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PRAYER REQUESTS
-- ============================================
INSERT INTO prayer_requests (id, church_id, person_id, content, is_private, is_answered, testimony, created_at, updated_at) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'Please pray for guidance in my job search. Feeling overwhelmed.', false, false, NULL, '2024-12-15', '2024-12-15'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'Thankful for my mothers successful surgery. Praying for quick recovery.', false, false, NULL, '2024-12-28', '2024-12-28'),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 'Wisdom needed for a difficult family decision.', true, true, 'God provided clarity through counsel from Pastor and peace in prayer.', '2024-11-10', '2024-12-20'),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'Urgent prayer for my mother Dorothy. Stage 3 cancer diagnosis.', false, false, NULL, '2025-01-24', '2025-01-24'),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000012', 'Pray for our missionaries in Southeast Asia. Facing challenges.', false, false, NULL, '2025-01-20', '2025-01-20'),
  ('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000029', 'Prayer for my daughter starting college next fall.', false, false, NULL, '2025-01-19', '2025-01-19'),
  ('33333333-3333-3333-3333-333333333307', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000031', 'Adjusting to new city. Pray for community and friendships.', false, false, NULL, '2025-01-15', '2025-01-15')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CALENDAR EVENTS
-- ============================================
INSERT INTO calendar_events (id, church_id, title, description, start_date, end_date, all_day, location, category) VALUES
  -- Week of Jan 25-31, 2026
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service with communion', '2026-01-25 10:00:00', '2026-01-25 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', 'Newcomers Lunch', 'Welcome lunch for new visitors', '2026-01-25 12:00:00', '2026-01-25 13:30:00', false, 'Fellowship Hall', 'event'),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', 'Elder Meeting', 'Monthly elders meeting', '2026-01-26 18:00:00', '2026-01-26 19:30:00', false, 'Conference Room', 'meeting'),
  ('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-01-27 19:00:00', '2026-01-27 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Weekly womens study - Prayer Warriors', '2026-01-28 09:30:00', '2026-01-28 11:00:00', false, 'Fellowship Hall', 'small-group'),
  ('44444444-4444-4444-4444-444444444406', '11111111-1111-1111-1111-111111111111', 'Youth Group', 'Wednesday night youth gathering', '2026-01-28 18:30:00', '2026-01-28 20:00:00', false, 'Youth Center', 'small-group'),
  ('44444444-4444-4444-4444-444444444407', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Weekly seniors fellowship and lunch', '2026-01-29 10:00:00', '2026-01-29 12:00:00', false, 'Room 105', 'small-group'),
  ('44444444-4444-4444-4444-444444444408', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Weekly young adults gathering', '2026-01-30 19:30:00', '2026-01-30 21:00:00', false, 'Coffee House', 'small-group'),
  ('44444444-4444-4444-4444-444444444409', '11111111-1111-1111-1111-111111111111', 'Worship Team Practice', 'Sunday service preparation', '2026-01-31 09:00:00', '2026-01-31 11:00:00', false, 'Main Sanctuary', 'meeting'),

  -- Week of Feb 1-7, 2026
  ('44444444-4444-4444-4444-444444444410', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service', '2026-02-01 10:00:00', '2026-02-01 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444411', '11111111-1111-1111-1111-111111111111', 'Super Bowl Fellowship', 'Watch party with food and fellowship', '2026-02-01 17:00:00', '2026-02-01 22:00:00', false, 'Family Life Center', 'event'),
  ('44444444-4444-4444-4444-444444444412', '11111111-1111-1111-1111-111111111111', 'Deacon Meeting', 'Monthly deacons meeting', '2026-02-02 18:30:00', '2026-02-02 20:00:00', false, 'Conference Room', 'meeting'),
  ('44444444-4444-4444-4444-444444444413', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-02-03 19:00:00', '2026-02-03 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444414', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Weekly womens study - Prayer Warriors', '2026-02-04 09:30:00', '2026-02-04 11:00:00', false, 'Fellowship Hall', 'small-group'),
  ('44444444-4444-4444-4444-444444444415', '11111111-1111-1111-1111-111111111111', 'Youth Group', 'Wednesday night youth gathering', '2026-02-04 18:30:00', '2026-02-04 20:00:00', false, 'Youth Center', 'small-group'),
  ('44444444-4444-4444-4444-444444444416', '11111111-1111-1111-1111-111111111111', 'Prayer Night', 'Monthly corporate prayer gathering', '2026-02-05 19:00:00', '2026-02-05 20:30:00', false, 'Chapel', 'service'),
  ('44444444-4444-4444-4444-444444444417', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Weekly seniors fellowship', '2026-02-05 10:00:00', '2026-02-05 12:00:00', false, 'Room 105', 'small-group'),
  ('44444444-4444-4444-4444-444444444418', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Weekly young adults gathering', '2026-02-06 19:30:00', '2026-02-06 21:00:00', false, 'Coffee House', 'small-group'),
  ('44444444-4444-4444-4444-444444444419', '11111111-1111-1111-1111-111111111111', 'Marriage Matters', 'Monthly couples workshop', '2026-02-07 18:00:00', '2026-02-07 20:00:00', false, 'Family Life Center', 'small-group'),

  -- Week of Feb 8-14, 2026
  ('44444444-4444-4444-4444-444444444420', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service', '2026-02-08 10:00:00', '2026-02-08 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444421', '11111111-1111-1111-1111-111111111111', 'Membership Class', 'New members orientation - Session 1', '2026-02-08 13:00:00', '2026-02-08 15:00:00', false, 'Room 105', 'event'),
  ('44444444-4444-4444-4444-444444444422', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-02-10 19:00:00', '2026-02-10 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444423', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Weekly womens study - Prayer Warriors', '2026-02-11 09:30:00', '2026-02-11 11:00:00', false, 'Fellowship Hall', 'small-group'),
  ('44444444-4444-4444-4444-444444444424', '11111111-1111-1111-1111-111111111111', 'Youth Group', 'Wednesday night youth gathering', '2026-02-11 18:30:00', '2026-02-11 20:00:00', false, 'Youth Center', 'small-group'),
  ('44444444-4444-4444-4444-444444444425', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Weekly seniors fellowship', '2026-02-12 10:00:00', '2026-02-12 12:00:00', false, 'Room 105', 'small-group'),
  ('44444444-4444-4444-4444-444444444426', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Weekly young adults gathering', '2026-02-13 19:30:00', '2026-02-13 21:00:00', false, 'Coffee House', 'small-group'),
  ('44444444-4444-4444-4444-444444444427', '11111111-1111-1111-1111-111111111111', 'Valentines Dinner', 'Couples date night dinner', '2026-02-14 18:00:00', '2026-02-14 21:00:00', false, 'Fellowship Hall', 'event'),

  -- Week of Feb 15-21, 2026
  ('44444444-4444-4444-4444-444444444428', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service', '2026-02-15 10:00:00', '2026-02-15 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444429', '11111111-1111-1111-1111-111111111111', 'Membership Class', 'New members orientation - Session 2', '2026-02-15 13:00:00', '2026-02-15 15:00:00', false, 'Room 105', 'event'),
  ('44444444-4444-4444-4444-444444444430', '11111111-1111-1111-1111-111111111111', 'Finance Committee', 'Quarterly budget review', '2026-02-16 18:00:00', '2026-02-16 19:30:00', false, 'Conference Room', 'meeting'),
  ('44444444-4444-4444-4444-444444444431', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-02-17 19:00:00', '2026-02-17 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444432', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Weekly womens study - Prayer Warriors', '2026-02-18 09:30:00', '2026-02-18 11:00:00', false, 'Fellowship Hall', 'small-group'),
  ('44444444-4444-4444-4444-444444444433', '11111111-1111-1111-1111-111111111111', 'Community Outreach', 'Food bank volunteer day', '2026-02-21 09:00:00', '2026-02-21 13:00:00', false, 'City Food Bank', 'event'),

  -- Week of Feb 22-28, 2026
  ('44444444-4444-4444-4444-444444444434', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service', '2026-02-22 10:00:00', '2026-02-22 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444435', '11111111-1111-1111-1111-111111111111', 'Baptism Service', 'Quarterly baptism celebration', '2026-02-22 12:30:00', '2026-02-22 13:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444436', '11111111-1111-1111-1111-111111111111', 'Elder Meeting', 'Monthly elders meeting', '2026-02-23 18:00:00', '2026-02-23 19:30:00', false, 'Conference Room', 'meeting'),
  ('44444444-4444-4444-4444-444444444437', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-02-24 19:00:00', '2026-02-24 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444438', '11111111-1111-1111-1111-111111111111', 'Ash Wednesday Service', 'Beginning of Lenten season', '2026-02-25 19:00:00', '2026-02-25 20:00:00', false, 'Chapel', 'service'),
  ('44444444-4444-4444-4444-444444444439', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Weekly seniors fellowship', '2026-02-26 10:00:00', '2026-02-26 12:00:00', false, 'Room 105', 'small-group'),
  ('44444444-4444-4444-4444-444444444440', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Weekly young adults gathering', '2026-02-27 19:30:00', '2026-02-27 21:00:00', false, 'Coffee House', 'small-group'),
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', 'Church Work Day', 'Spring cleaning and maintenance', '2026-02-28 08:00:00', '2026-02-28 12:00:00', false, 'Church Campus', 'event')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ATTENDANCE
-- ============================================
INSERT INTO attendance (id, church_id, person_id, event_id, event_type, event_name, date, checked_in_at) VALUES
  -- January 19 Sunday Service
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 09:45:00'),
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 09:30:00'),
  ('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 09:50:00'),
  ('55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 09:35:00'),
  ('55555555-5555-5555-5555-555555555505', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000034', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 10:00:00'),
  -- January 26 Sunday Service (more attendees)
  ('55555555-5555-5555-5555-555555555506', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:45:00'),
  ('55555555-5555-5555-5555-555555555507', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:55:00'),
  ('55555555-5555-5555-5555-555555555508', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:30:00'),
  ('55555555-5555-5555-5555-555555555509', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:50:00'),
  ('55555555-5555-5555-5555-555555555510', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:35:00'),
  ('55555555-5555-5555-5555-555555555511', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000009', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:40:00'),
  ('55555555-5555-5555-5555-555555555512', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:48:00'),
  ('55555555-5555-5555-5555-555555555513', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:52:00'),
  ('55555555-5555-5555-5555-555555555514', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:25:00'),
  ('55555555-5555-5555-5555-555555555515', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000032', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:20:00'),
  -- Small group attendance
  ('55555555-5555-5555-5555-555555555516', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', NULL, 'small-group', 'Men of Faith', '2025-01-21', '2025-01-21 19:00:00'),
  ('55555555-5555-5555-5555-555555555517', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', NULL, 'small-group', 'Men of Faith', '2025-01-21', '2025-01-21 18:55:00'),
  ('55555555-5555-5555-5555-555555555518', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', NULL, 'small-group', 'Men of Faith', '2025-01-21', '2025-01-21 19:05:00'),
  ('55555555-5555-5555-5555-555555555519', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', NULL, 'small-group', 'Young Adults', '2025-01-23', '2025-01-23 19:30:00'),
  ('55555555-5555-5555-5555-555555555520', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', NULL, 'small-group', 'Young Adults', '2025-01-23', '2025-01-23 19:25:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- GIVING (Donations)
-- ============================================
INSERT INTO giving (id, church_id, person_id, amount, fund, date, method, is_recurring, note) VALUES
  -- Regular recurring tithes
  ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 250.00, 'tithe', '2025-01-05', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 250.00, 'tithe', '2025-01-12', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666603', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 250.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666604', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 500.00, 'tithe', '2025-01-05', 'check', false, NULL),
  ('66666666-6666-6666-6666-666666666605', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 500.00, 'tithe', '2025-01-19', 'check', false, NULL),
  ('66666666-6666-6666-6666-666666666606', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 150.00, 'tithe', '2025-01-05', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666607', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 100.00, 'missions', '2025-01-05', 'online', false, NULL),
  ('66666666-6666-6666-6666-666666666608', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', 75.00, 'offering', '2025-01-05', 'cash', false, NULL),
  -- First-time givers
  ('66666666-6666-6666-6666-666666666609', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 50.00, 'tithe', '2025-01-17', 'online', false, 'First gift! Welcome gift from Christopher.'),
  ('66666666-6666-6666-6666-666666666610', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 25.00, 'offering', '2025-01-22', 'card', false, 'First-time visitor first gift.'),
  ('66666666-6666-6666-6666-666666666611', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', 100.00, 'tithe', '2025-01-23', 'online', false, 'Brians first tithe - becoming more committed!'),
  -- Large gifts (major donors)
  ('66666666-6666-6666-6666-666666666612', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 5000.00, 'missions', '2025-01-21', 'check', false, 'Year-end missions gift from Richard Anderson.'),
  ('66666666-6666-6666-6666-666666666613', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 2500.00, 'building', '2025-01-14', 'bank', false, 'Building fund contribution.'),
  ('66666666-6666-6666-6666-666666666614', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000025', 1500.00, 'benevolence', '2025-01-19', 'check', false, 'Patricias quarterly benevolence gift.'),
  ('66666666-6666-6666-6666-666666666615', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000012', 2000.00, 'missions', '2025-01-24', 'online', false, 'Thomas Wright - missions trip sponsorship.'),
  -- Monthly recurring givers
  ('66666666-6666-6666-6666-666666666616', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000009', 200.00, 'tithe', '2025-01-01', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666617', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', 150.00, 'tithe', '2025-01-01', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666618', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000011', 300.00, 'tithe', '2025-01-01', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666619', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000018', 175.00, 'tithe', '2025-01-01', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666620', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000021', 125.00, 'tithe', '2025-01-01', 'online', true, NULL),
  -- Various fund donations
  ('66666666-6666-6666-6666-666666666621', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000019', 50.00, 'benevolence', '2025-01-10', 'cash', false, NULL),
  ('66666666-6666-6666-6666-666666666622', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000017', 40.00, 'offering', '2025-01-17', 'card', false, NULL),
  ('66666666-6666-6666-6666-666666666623', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 75.00, 'tithe', '2025-01-17', 'online', false, NULL),
  ('66666666-6666-6666-6666-666666666624', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000026', 200.00, 'tithe', '2025-01-21', 'online', false, 'Mark Thompson - new member first gift.'),
  ('66666666-6666-6666-6666-666666666625', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000029', 175.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666626', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000030', 100.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666627', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000032', 400.00, 'tithe', '2025-01-12', 'check', false, NULL),
  ('66666666-6666-6666-6666-666666666628', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000033', 200.00, 'tithe', '2025-01-12', 'check', false, NULL),
  ('66666666-6666-6666-6666-666666666629', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000035', 150.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666630', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 1000.00, 'tithe', '2025-01-05', 'bank', true, 'Monthly tithe')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CAMPAIGNS (Fundraising)
-- ============================================
INSERT INTO campaigns (id, church_id, name, description, goal_amount, start_date, end_date, fund, is_active) VALUES
  ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', 'Building Fund 2025', 'Funds for sanctuary renovation and new HVAC system.', 150000.00, '2025-01-01', '2025-12-31', 'building', true),
  ('77777777-7777-7777-7777-777777777702', '11111111-1111-1111-1111-111111111111', 'Southeast Asia Missions', 'Support missionaries in Thailand and Vietnam.', 50000.00, '2025-01-01', '2025-06-30', 'missions', true),
  ('77777777-7777-7777-7777-777777777703', '11111111-1111-1111-1111-111111111111', 'Benevolence Emergency Fund', 'Help families in crisis with rent, utilities, and food.', 20000.00, '2025-01-01', '2025-12-31', 'benevolence', true),
  ('77777777-7777-7777-7777-777777777704', '11111111-1111-1111-1111-111111111111', 'Youth Summer Camp', 'Send youth to summer camp scholarships.', 10000.00, '2025-02-01', '2025-05-31', 'other', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PLEDGES
-- ============================================
INSERT INTO pledges (id, church_id, person_id, campaign_id, amount, frequency, start_date, end_date, fund, status, notes) VALUES
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', '77777777-7777-7777-7777-777777777701', 24000.00, 'monthly', '2025-01-01', '2025-12-31', 'building', 'active', '$2000/month for building fund'),
  ('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', '77777777-7777-7777-7777-777777777702', 12000.00, 'quarterly', '2025-01-01', '2025-06-30', 'missions', 'active', 'Passionate about SE Asia missions'),
  ('88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000025', '77777777-7777-7777-7777-777777777703', 6000.00, 'monthly', '2025-01-01', '2025-12-31', 'benevolence', 'active', '$500/month benevolence'),
  ('88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000012', '77777777-7777-7777-7777-777777777702', 6000.00, 'one-time', '2025-01-01', '2025-01-31', 'missions', 'completed', 'Missions trip sponsorship'),
  ('88888888-8888-8888-8888-888888888805', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000032', '77777777-7777-7777-7777-777777777701', 6000.00, 'monthly', '2025-01-01', '2025-12-31', 'building', 'active', '$500/month building pledge'),
  ('88888888-8888-8888-8888-888888888806', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', '77777777-7777-7777-7777-777777777701', 3600.00, 'monthly', '2025-01-01', '2025-12-31', 'building', 'active', '$300/month as finance team member')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONATION BATCHES (Sunday collections)
-- ============================================
INSERT INTO donation_batches (id, church_id, batch_date, batch_name, status, total_cash, total_checks, total_amount, check_count, created_by, closed_by, closed_at, notes) VALUES
  ('99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111111', '2025-01-05', 'Sunday Collection Jan 5', 'reconciled', 250.00, 1650.00, 1900.00, 4, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-06 10:00:00', 'First Sunday of 2025'),
  ('99999999-9999-9999-9999-999999999902', '11111111-1111-1111-1111-111111111111', '2025-01-12', 'Sunday Collection Jan 12', 'reconciled', 175.00, 1100.00, 1275.00, 3, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-13 10:00:00', NULL),
  ('99999999-9999-9999-9999-999999999903', '11111111-1111-1111-1111-111111111111', '2025-01-19', 'Sunday Collection Jan 19', 'closed', 325.00, 2500.00, 2825.00, 5, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-20 10:00:00', 'Strong giving week'),
  ('99999999-9999-9999-9999-999999999904', '11111111-1111-1111-1111-111111111111', '2025-01-26', 'Sunday Collection Jan 26', 'open', 150.00, 500.00, 650.00, 2, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, NULL, 'In progress')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BATCH ITEMS (Individual items in batches)
-- ============================================
INSERT INTO batch_items (id, batch_id, person_id, amount, method, fund, check_number, memo) VALUES
  -- Jan 5 batch
  ('aaaaaa01-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000004', 500.00, 'check', 'tithe', '1234', NULL),
  ('aaaaaa02-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000008', 150.00, 'check', 'tithe', '5678', NULL),
  ('aaaaaa03-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000024', 1000.00, 'check', 'tithe', '9012', 'Monthly tithe'),
  ('aaaaaa04-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000006', 75.00, 'cash', 'offering', NULL, NULL),
  ('aaaaaa05-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', NULL, 175.00, 'cash', 'offering', NULL, 'Anonymous cash'),
  -- Jan 12 batch
  ('aaaaaa06-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999902', '00000000-0000-0000-0000-000000000032', 400.00, 'check', 'tithe', '3456', NULL),
  ('aaaaaa07-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999902', '00000000-0000-0000-0000-000000000033', 200.00, 'check', 'tithe', '3457', NULL),
  ('aaaaaa08-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999902', '00000000-0000-0000-0000-000000000004', 500.00, 'check', 'tithe', '1235', NULL),
  ('aaaaaa09-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999902', NULL, 175.00, 'cash', 'offering', NULL, 'Loose plate'),
  -- Jan 19 batch
  ('aaaaaa10-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', '00000000-0000-0000-0000-000000000004', 500.00, 'check', 'tithe', '1236', NULL),
  ('aaaaaa11-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', '00000000-0000-0000-0000-000000000025', 1500.00, 'check', 'benevolence', '7890', 'Quarterly gift'),
  ('aaaaaa12-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', '00000000-0000-0000-0000-000000000019', 50.00, 'cash', 'benevolence', NULL, NULL),
  ('aaaaaa13-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', NULL, 275.00, 'cash', 'offering', NULL, 'Loose plate'),
  ('aaaaaa14-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', '00000000-0000-0000-0000-000000000008', 500.00, 'check', 'building', '5679', 'Building fund')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- RECURRING GIVING
-- ============================================
INSERT INTO recurring_giving (id, church_id, person_id, amount, frequency, fund, next_date, status) VALUES
  ('bbbbbb01-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 250.00, 'weekly', 'tithe', '2025-01-26', 'active'),
  ('bbbbbb02-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 150.00, 'weekly', 'tithe', '2025-01-26', 'active'),
  ('bbbbbb03-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000009', 200.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb04-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', 150.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb05-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000011', 300.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb06-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 1000.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb07-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000029', 175.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb08-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000030', 100.00, 'monthly', 'tithe', '2025-02-01', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SCHEDULED MESSAGES
-- ============================================
INSERT INTO scheduled_messages (id, church_id, person_id, channel, subject, body, scheduled_for, status, source_type, source_agent, ai_generated, created_by) VALUES
  -- Birthday messages
  ('cccccc01-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', 'email', 'Happy Birthday, Cam!', 'Dear Cam,\n\nWishing you a wonderful birthday filled with Gods blessings! We are so grateful for you and your gifts on the worship team.\n\nMay this year bring you closer to Gods purpose for your life.\n\nWith love,\nGrace Community Church', '2025-01-24 09:00:00', 'scheduled', 'birthday', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc02-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000009', 'both', 'Happy Birthday Tomorrow, Amanda!', 'Dear Amanda,\n\nJust a note to let you know were thinking of you as your special day approaches! Your heart for prayer and encouragement blesses so many.\n\nHave a blessed birthday!\n\nGrace Community Church', '2025-01-25 09:00:00', 'scheduled', 'birthday', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc03-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'email', 'Birthday Blessings, James!', 'Dear James,\n\nHappy birthday! Thank you for your faithful service on the greeting team. Your warm welcome makes such a difference to everyone who walks through our doors.\n\nMay God bless you abundantly this year!\n\nGrace Community Church', '2025-01-26 09:00:00', 'scheduled', 'birthday', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Membership anniversary messages
  ('cccccc04-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000011', 'email', 'Celebrating 1 Year Together!', 'Dear Rachel,\n\nCan you believe its been a year since you joined our church family? We are so blessed to have you, especially your dedication to our childrens ministry.\n\nThank you for being part of Grace Community Church!\n\nWith gratitude,\nPastor John', '2025-01-24 10:00:00', 'scheduled', 'anniversary', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc05-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000018', 'email', 'Happy 2-Year Anniversary!', 'Dear Daniel,\n\nTwo years ago you became part of our family, and we couldnt be more grateful! Your faithful service as an usher has been such a blessing.\n\nThank you for your commitment to Grace Community Church.\n\nBlessings,\nPastor John', '2025-01-26 10:00:00', 'scheduled', 'anniversary', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Donation thank you messages
  ('cccccc06-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'email', 'Thank You for Your Generous Missions Gift', 'Dear Richard,\n\nThank you for your extraordinary gift of $5,000 to our missions fund. Your generosity will help support missionaries around the world.\n\nYour heart for missions is truly inspiring.\n\nWith deep gratitude,\nPastor John', '2025-01-21 14:00:00', 'sent', 'donation', 'donation-processing-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc07-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'email', 'Thank You for Your First Gift!', 'Dear Christopher,\n\nThank you so much for your generous gift! Were honored that you chose to support Grace Community Church.\n\nYour giving helps us serve our community.\n\nBlessings,\nGrace Community Church', '2025-01-17 15:00:00', 'sent', 'donation', 'donation-processing-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Welcome/follow-up messages
  ('cccccc08-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'email', 'Welcome to Grace Community Church!', 'Dear Cam,\n\nIt was wonderful to have you visit us! We hope you felt at home and experienced Gods presence with us.\n\nWed love to help you get connected. Our newcomers lunch is this Sunday after service.\n\nWarmly,\nPastor John', '2025-01-22 10:00:00', 'sent', 'follow_up', 'new-member-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc09-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000014', 'both', 'Great to Meet You, Marcus!', 'Hi Marcus,\n\nIt was great to have you visit! James mentioned youre his coworker - were so glad he invited you.\n\nHope to see you again soon!\n\nPastor John', '2025-01-24 10:00:00', 'scheduled', 'follow_up', 'new-member-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc10-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000015', 'email', 'Welcome, Ashley! Info About Young Adults', 'Hi Ashley,\n\nWelcome to Grace Community Church! I heard youre interested in our young adults group.\n\nWe meet every Thursday at 7:30 PM at the Coffee House downtown. Kevin Martinez leads the group.\n\nSee you soon!\nPastor John', '2025-01-25 10:00:00', 'scheduled', 'follow_up', 'new-member-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Drip campaign messages
  ('cccccc11-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000026', 'email', 'Getting Connected at Grace', 'Hi Mark,\n\nIts been a week since you joined our church family - welcome again! We want to help you get connected.\n\nHere are some ways to get involved:\n- Join a small group\n- Serve on a team\n- Attend our monthly fellowship dinner\n\nLet us know how we can help!\n\nBlessings,\nGrace Community Church', '2025-01-26 09:00:00', 'scheduled', 'drip_campaign', 'new-member-agent', false, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MESSAGE ARCHIVE (Sent messages history)
-- ============================================
INSERT INTO message_archive (id, church_id, person_id, scheduled_message_id, channel, direction, subject, body, sent_at, delivered_at, opened_at, provider, external_id, status) VALUES
  ('dddddd01-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'cccccc06-cccc-cccc-cccc-cccccccccccc', 'email', 'outbound', 'Thank You for Your Generous Missions Gift', 'Dear Richard,\n\nThank you for your extraordinary gift of $5,000...', '2025-01-21 14:00:00', '2025-01-21 14:01:00', '2025-01-21 16:30:00', 'resend', 'msg_abc123', 'opened'),
  ('dddddd02-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'cccccc07-cccc-cccc-cccc-cccccccccccc', 'email', 'outbound', 'Thank You for Your First Gift!', 'Dear Christopher,\n\nThank you so much for your generous gift...', '2025-01-17 15:00:00', '2025-01-17 15:01:00', '2025-01-17 18:00:00', 'resend', 'msg_def456', 'opened'),
  ('dddddd03-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'cccccc08-cccc-cccc-cccc-cccccccccccc', 'email', 'outbound', 'Welcome to Grace Community Church!', 'Dear Cam,\n\nIt was wonderful to have you visit us...', '2025-01-22 10:00:00', '2025-01-22 10:01:00', '2025-01-22 11:15:00', 'resend', 'msg_ghi789', 'opened'),
  ('dddddd04-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', NULL, 'email', 'outbound', 'We Miss You, Emily', 'Dear Emily,\n\nWeve noticed youve been away for a while. We wanted to reach out...', '2025-01-10 09:00:00', '2025-01-10 09:01:00', NULL, 'resend', 'msg_jkl012', 'delivered'),
  ('dddddd05-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', NULL, 'email', 'outbound', 'Thinking of You', 'Dear Michelle,\n\nWe heard about your mothers health situation...', '2025-01-12 10:00:00', '2025-01-12 10:01:00', '2025-01-12 14:30:00', 'resend', 'msg_mno345', 'opened')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- INBOUND MESSAGES (Replies)
-- ============================================
INSERT INTO inbound_messages (id, church_id, person_id, channel, from_address, subject, body, ai_category, ai_sentiment, ai_suggested_response, ai_confidence, status, in_reply_to, received_at) VALUES
  ('eeeeee01-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'email', 'camd1993@gmail.com', 'Re: Welcome to Grace Community Church!', 'Thank you so much for the warm welcome! Yes, I would love to attend the newcomers lunch this Sunday. Is there anything I should bring?\n\nAlso, do you have a womens Bible study? Id love to get connected with other women in the church.\n\nThanks,\nCam', 'question', 'positive', 'Great to hear from you! No need to bring anything to the newcomers lunch - just yourself! And yes, we have a wonderful womens Bible study that meets Wednesday mornings at 9:30 AM. Amanda Foster leads it and would love to have you join.', 0.92, 'new', 'dddddd03-dddd-dddd-dddd-dddddddddddd', '2025-01-22 13:00:00'),
  ('eeeeee02-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'email', 'richard.a@email.com', 'Re: Thank You for Your Generous Missions Gift', 'Pastor John,\n\nThank you for the kind note. I feel strongly led to support our missionaries, especially the team in Southeast Asia.\n\nI would love to meet and discuss how the church is supporting missions work. Could we schedule a lunch next week?\n\nRichard', 'other', 'positive', 'Richard, thank you so much for your heart for missions! I would be honored to meet with you. How about Tuesday or Wednesday of next week? Looking forward to our conversation!', 0.88, 'new', 'dddddd01-dddd-dddd-dddd-dddddddddddd', '2025-01-21 18:00:00'),
  ('eeeeee03-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'sms', '(555) 567-8901', NULL, 'Hi Pastor, sorry I havent been around. Work has been really hard and Im struggling. Could use some prayer.', 'prayer_request', 'negative', 'Emily, thank you for reaching out. Im so sorry to hear youre struggling. Youre not alone - were here for you. Can I call you this week? Wed love to pray with you.', 0.95, 'flagged', NULL, '2025-01-23 15:30:00'),
  ('eeeeee04-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000014', 'sms', '(555) 456-7801', NULL, 'Hey, thanks for the message! Church was different than I expected - in a good way. James said theres a mens group? When does that meet?', 'question', 'positive', 'So glad you enjoyed your visit, Marcus! Yes, we have a great mens group called Men of Faith that meets Tuesdays at 7 PM in Room 201. Robert Chen leads it and James is a regular. Would you like James to bring you next week?', 0.91, 'new', NULL, '2025-01-24 10:30:00'),
  ('eeeeee05-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'email', 'michelle.y@email.com', 'Prayer Request - Urgent', 'Dear Pastor,\n\nI need to ask for urgent prayer. My mother was just diagnosed with cancer and were all in shock. The doctors say its stage 3.\n\nI know I havent been to church in a while but I dont know where else to turn. Could the prayer team pray for her? Her name is Dorothy Young.\n\nThank you,\nMichelle', 'prayer_request', 'urgent', 'Dear Michelle, Im so sorry to hear about your mothers diagnosis. Please know that you and Dorothy are in our prayers right now. Im adding her to our prayer chain immediately. Can I call you today?', 0.97, 'flagged', NULL, '2025-01-24 08:30:00'),
  ('eeeeee06-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'email', 'chris.hall@email.com', 'Re: Thank You for Your First Gift!', 'Thanks for the note! Happy to support the church. Quick question - is there a way to set up automatic monthly giving? Id like to be more consistent.', 'question', 'positive', 'Great question, Christopher! Yes, you can set up recurring giving through our online portal at give.gracechurch.org. Just select Make this recurring when you enter your gift. If you need any help, our finance team can assist.', 0.93, 'new', 'dddddd02-dddd-dddd-dddd-dddddddddddd', '2025-01-18 09:45:00'),
  ('eeeeee07-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', 'email', 'cdeichmiller11@gmail.com', 'Re: Happy Birthday!', 'Thank you so much for the birthday wishes! I feel so blessed to be part of this church family. See you Sunday!', 'thanks', 'positive', 'Youre so welcome! Were blessed to have you. Looking forward to seeing you Sunday!', 0.96, 'read', NULL, '2025-01-24 11:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DAILY DIGESTS
-- ============================================
INSERT INTO daily_digests (id, church_id, user_id, digest_date, priority_tasks, people_to_contact, messages_to_send, birthdays_today, follow_ups_due, ai_summary, ai_recommendations, generated_at, viewed_at) VALUES
  ('ffffff01-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-24',
   '[{"id": "22222222-2222-2222-2222-222222222203", "title": "Check in on Emily Johnson", "priority": "medium"}, {"id": "22222222-2222-2222-2222-222222222209", "title": "Check on Michelle Youngs family", "priority": "high"}]',
   '[{"id": "00000000-0000-0000-0000-000000000005", "name": "Emily Johnson", "reason": "Inactive member reached out"}, {"id": "00000000-0000-0000-0000-000000000023", "name": "Michelle Young", "reason": "Urgent prayer request"}]',
   '[{"id": "cccccc01-cccc-cccc-cccc-cccccccccccc", "personName": "Cam Deich", "type": "birthday"}, {"id": "cccccc04-cccc-cccc-cccc-cccccccccccc", "personName": "Rachel Kim", "type": "anniversary"}]',
   '[{"id": "00000000-0000-0000-0000-000000000006", "name": "Cam Deich"}]',
   '[{"id": "00000000-0000-0000-0000-000000000013", "name": "Cam 1993", "daysSinceVisit": 3}, {"id": "00000000-0000-0000-0000-000000000014", "name": "Marcus Taylor", "daysSinceVisit": 1}]',
   'Today requires attention to pastoral care. Michelle Youngs urgent prayer request about her mothers cancer diagnosis should be prioritized. Emily Johnson also reached out after being inactive. Two birthdays today (Cam Deich) and Rachel Kims 1-year membership anniversary. Good day for visitor follow-up with 2 recent visitors.',
   '["Call Michelle Young immediately regarding her mothers diagnosis", "Follow up with Emily Johnson - she reached out about work struggles", "Send birthday greeting to Cam Deich", "Acknowledge Rachel Kims 1-year anniversary", "Plan visitor follow-up for Marcus Taylor"]',
   '2025-01-24 06:00:00', '2025-01-24 08:15:00')
ON CONFLICT DO NOTHING;

-- ============================================
-- DRIP CAMPAIGNS
-- ============================================
INSERT INTO drip_campaigns (id, church_id, name, description, trigger_type, is_active, created_by) VALUES
  ('11112222-1111-2222-1111-222211112222', '11111111-1111-1111-1111-111111111111', 'New Visitor Welcome Sequence', 'Automated welcome series for first-time visitors over 30 days.', 'new_visitor', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11112222-1111-2222-1111-222211112223', '11111111-1111-1111-1111-111111111111', 'New Member Onboarding', 'Help new members get connected in their first 60 days.', 'new_member', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11112222-1111-2222-1111-222211112224', '11111111-1111-1111-1111-111111111111', 'First-Time Giver Follow-up', 'Thank and encourage first-time givers.', 'donation', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11112222-1111-2222-1111-222211112225', '11111111-1111-1111-1111-111111111111', 'Re-engagement Campaign', 'Reach out to inactive members.', 'manual', false, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DRIP CAMPAIGN STEPS
-- ============================================
INSERT INTO drip_campaign_steps (id, campaign_id, step_number, delay_days, delay_hours, channel, subject, body, use_ai_personalization) VALUES
  -- New Visitor Welcome Sequence
  ('22223333-2222-3333-2222-333322223331', '11112222-1111-2222-1111-222211112222', 1, 0, 2, 'email', 'Welcome to Grace Community Church!', 'Dear {{first_name}},\n\nThank you for visiting Grace Community Church! We hope you felt welcome and experienced Gods love with us.\n\nWed love to help you get connected. Feel free to reach out with any questions.\n\nBlessings,\nPastor John', true),
  ('22223333-2222-3333-2222-333322223332', '11112222-1111-2222-1111-222211112222', 2, 3, 0, 'email', 'Getting to Know Grace Church', 'Hi {{first_name}},\n\nWe wanted to share a bit more about who we are and what we believe. At Grace Community Church, we...\n\nHope to see you again soon!', false),
  ('22223333-2222-3333-2222-333322223333', '11112222-1111-2222-1111-222211112222', 3, 7, 0, 'both', 'An Invitation Just for You', 'Hi {{first_name}},\n\nWed love to invite you to our Newcomers Lunch this Sunday! Its a great way to meet others and learn about ways to get involved.\n\nNo RSVP needed - just come!', true),
  ('22223333-2222-3333-2222-333322223334', '11112222-1111-2222-1111-222211112222', 4, 14, 0, 'email', 'Find Your Place at Grace', 'Hi {{first_name}},\n\nWere so glad youve been visiting! Here are some ways to get more connected:\n\n- Small Groups\n- Serving Teams\n- Classes\n\nLet us know how we can help!', false),
  ('22223333-2222-3333-2222-333322223335', '11112222-1111-2222-1111-222211112222', 5, 30, 0, 'email', 'Checking In', 'Hi {{first_name}},\n\nIts been a month since your first visit. How are you doing? Wed love to hear from you and answer any questions.\n\nWere here for you!', true),
  -- New Member Onboarding
  ('22223333-2222-3333-2222-333322223336', '11112222-1111-2222-1111-222211112223', 1, 0, 1, 'email', 'Welcome to the Family!', 'Dear {{first_name}},\n\nCongratulations on becoming a member of Grace Community Church! Were so excited to have you as part of our family.\n\nHeres what to expect in your first few weeks...', true),
  ('22223333-2222-3333-2222-333322223337', '11112222-1111-2222-1111-222211112223', 2, 7, 0, 'email', 'Getting Connected - Week 1', 'Hi {{first_name}},\n\nIts been a week since you joined! Here are some ways to get connected:\n\n- Join a Small Group\n- Sign up to serve\n- Attend our next fellowship event', false),
  ('22223333-2222-3333-2222-333322223338', '11112222-1111-2222-1111-222211112223', 3, 30, 0, 'email', 'One Month Check-In', 'Hi {{first_name}},\n\nCan you believe its been a month already? How has your experience been so far? Wed love to hear from you!', true),
  ('22223333-2222-3333-2222-333322223339', '11112222-1111-2222-1111-222211112223', 4, 60, 0, 'email', 'Two Month Milestone', 'Hi {{first_name}},\n\nYouve been part of our church family for two months now! We hope youre feeling at home.\n\nHave you found a small group or serving opportunity yet? Let us know how we can help!', false),
  -- First-Time Giver Follow-up
  ('22223333-2222-3333-2222-333322223340', '11112222-1111-2222-1111-222211112224', 1, 0, 0, 'email', 'Thank You for Your Gift!', 'Dear {{first_name}},\n\nThank you for your generous gift to Grace Community Church! Your giving helps us serve our community and share Gods love.\n\nWere so grateful for you!', true),
  ('22223333-2222-3333-2222-333322223341', '11112222-1111-2222-1111-222211112224', 2, 7, 0, 'email', 'Your Impact at Grace', 'Hi {{first_name}},\n\nWe wanted to share how your giving is making a difference. This month, your generosity helped us...\n\nThank you for partnering with us!', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DRIP CAMPAIGN ENROLLMENTS
-- ============================================
INSERT INTO drip_campaign_enrollments (id, campaign_id, person_id, current_step, status, enrolled_at, completed_at, next_message_at) VALUES
  -- Visitor welcome sequence enrollments
  ('33334444-3333-4444-3333-444433334441', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000013', 2, 'active', '2025-01-21 12:00:00', NULL, '2025-01-28 12:00:00'),
  ('33334444-3333-4444-3333-444433334442', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000014', 1, 'active', '2025-01-23 12:00:00', NULL, '2025-01-26 12:00:00'),
  ('33334444-3333-4444-3333-444433334443', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000015', 1, 'active', '2025-01-24 12:00:00', NULL, '2025-01-27 12:00:00'),
  ('33334444-3333-4444-3333-444433334444', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000034', 1, 'active', '2025-01-19 12:00:00', NULL, '2025-01-22 12:00:00'),
  -- New member onboarding enrollments
  ('33334444-3333-4444-3333-444433334445', '11112222-1111-2222-1111-222211112223', '00000000-0000-0000-0000-000000000026', 2, 'active', '2025-01-05 10:00:00', NULL, '2025-02-04 10:00:00'),
  ('33334444-3333-4444-3333-444433334446', '11112222-1111-2222-1111-222211112223', '00000000-0000-0000-0000-000000000007', 1, 'active', '2025-01-05 10:00:00', NULL, '2025-01-12 10:00:00'),
  -- First-time giver enrollments
  ('33334444-3333-4444-3333-444433334447', '11112222-1111-2222-1111-222211112224', '00000000-0000-0000-0000-000000000020', 2, 'active', '2025-01-17 15:00:00', NULL, '2025-01-24 15:00:00'),
  ('33334444-3333-4444-3333-444433334448', '11112222-1111-2222-1111-222211112224', '00000000-0000-0000-0000-000000000016', 1, 'active', '2025-01-23 12:00:00', NULL, '2025-01-30 12:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- GIVING STATEMENTS (Year-end tax statements)
-- ============================================
INSERT INTO giving_statements (id, church_id, person_id, year, total_amount, by_fund, generated_at, sent_at, sent_method) VALUES
  ('44445555-4444-5555-4444-555544445551', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 2024, 48000.00, '{"tithe": 24000, "missions": 15000, "building": 9000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445552', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000025', 2024, 18000.00, '{"tithe": 12000, "benevolence": 6000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445553', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 2024, 13000.00, '{"tithe": 13000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445554', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 2024, 26000.00, '{"tithe": 26000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445555', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 2024, 15600.00, '{"tithe": 10400, "missions": 3200, "building": 2000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445556', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000032', 2024, 9600.00, '{"tithe": 9600}', '2025-01-15 10:00:00', NULL, 'print')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPANDED DATA: 15 NEW PEOPLE (36-50)
-- ============================================

-- The Rodriguez Family (fam-rodriguez)
-- Carlos (deacon, men's group), Elena (women's ministry, hospitality), Isabella (youth), Diego (kids)
-- The Washington Family (fam-washington)
-- Derek (usher, men's group), Keisha (choir, women's ministry), Zion (kids)
-- The Patel Couple (fam-patel) - young professionals, regular attenders
-- Raj, Priya
-- Singles/Other:
-- Ruth Patterson - 78, longest-standing member, prayer warrior
-- Marcus Greene - 29, tech team volunteer, recently joined
-- Olivia Foster - 23, college student, recent visitor
-- Samuel Jackson - 33, single dad, regular
-- Lily Jackson - 8, Samuel's daughter (fam-jackson)
-- Dorothy Mitchell - 73, inactive due to health

INSERT INTO people (id, church_id, first_name, last_name, email, phone, status, birth_date, join_date, first_visit, address, city, state, zip, photo_url, tags, family_id, notes) VALUES
  -- Rodriguez Family
  ('00000000-0000-0000-0000-000000000036', '11111111-1111-1111-1111-111111111111', 'Carlos', 'Rodriguez', 'carlos.rodriguez@email.com', '(555) 901-2345', 'member', '1983-07-14', '2021-03-15', '2021-01-10', '890 Cedar Lane', 'Springfield', 'IL', '62704', NULL, ARRAY['deacon', 'mens-group', 'spanish-ministry'], 'ffffffff-0000-0000-0000-000000000003', 'Bilingual. Serves as deacon - leads Spanish-language prayer group. Construction business owner.'),
  ('00000000-0000-0000-0000-000000000037', '11111111-1111-1111-1111-111111111111', 'Elena', 'Rodriguez', 'elena.rodriguez@email.com', '(555) 901-2346', 'member', '1985-11-22', '2021-03-15', '2021-01-10', '890 Cedar Lane', 'Springfield', 'IL', '62704', NULL, ARRAY['womens-ministry', 'hospitality', 'spanish-ministry'], 'ffffffff-0000-0000-0000-000000000003', 'Coordinates church potlucks. Active in women''s Bible study. Nurse at Springfield General.'),
  ('00000000-0000-0000-0000-000000000038', '11111111-1111-1111-1111-111111111111', 'Isabella', 'Rodriguez', NULL, NULL, 'member', '2011-09-30', '2021-03-15', '2021-01-10', '890 Cedar Lane', 'Springfield', 'IL', '62704', NULL, ARRAY['youth-group', 'child'], 'ffffffff-0000-0000-0000-000000000003', '8th grader. Active in youth worship band - plays guitar.'),
  ('00000000-0000-0000-0000-000000000039', '11111111-1111-1111-1111-111111111111', 'Diego', 'Rodriguez', NULL, NULL, 'member', '2015-04-18', '2021-03-15', '2021-01-10', '890 Cedar Lane', 'Springfield', 'IL', '62704', NULL, ARRAY['kids-ministry', 'child'], 'ffffffff-0000-0000-0000-000000000003', '5th grader. Loves the kids ministry program.'),

  -- Washington Family
  ('00000000-0000-0000-0000-000000000040', '11111111-1111-1111-1111-111111111111', 'Derek', 'Washington', 'derek.washington@email.com', '(555) 234-5678', 'member', '1980-08-05', '2022-06-12', '2022-04-03', '456 Elm Street', 'Springfield', 'IL', '62701', NULL, ARRAY['usher', 'mens-group', 'volunteer'], 'ffffffff-0000-0000-0000-000000000004', 'Faithful usher. Joined men''s group immediately. Works at the fire department.'),
  ('00000000-0000-0000-0000-000000000041', '11111111-1111-1111-1111-111111111111', 'Keisha', 'Washington', 'keisha.washington@email.com', '(555) 234-5679', 'member', '1982-03-19', '2022-06-12', '2022-04-03', '456 Elm Street', 'Springfield', 'IL', '62701', NULL, ARRAY['choir', 'womens-ministry'], 'ffffffff-0000-0000-0000-000000000004', 'Beautiful voice - joined choir first week. Active in women''s ministry. Elementary school teacher.'),
  ('00000000-0000-0000-0000-000000000042', '11111111-1111-1111-1111-111111111111', 'Zion', 'Washington', NULL, NULL, 'member', '2018-01-30', '2022-06-12', '2022-04-03', '456 Elm Street', 'Springfield', 'IL', '62701', NULL, ARRAY['child', 'kids-ministry'], 'ffffffff-0000-0000-0000-000000000004', '2nd grader. Energetic and loves Sunday school crafts.'),

  -- Patel Couple
  ('00000000-0000-0000-0000-000000000043', '11111111-1111-1111-1111-111111111111', 'Raj', 'Patel', 'raj.patel@techcorp.com', '(555) 345-6789', 'regular', '1988-10-12', NULL, '2024-10-20', '1200 Tech Parkway, Apt 305', 'Springfield', 'IL', '62702', NULL, ARRAY['young-professional', 'newcomer'], 'ffffffff-0000-0000-0000-000000000005', 'Software engineer, relocated from Bay Area. Exploring faith. Attends regularly but hasn''t committed to membership yet.'),
  ('00000000-0000-0000-0000-000000000044', '11111111-1111-1111-1111-111111111111', 'Priya', 'Patel', 'priya.patel@email.com', '(555) 345-6790', 'regular', '1990-06-08', NULL, '2024-10-20', '1200 Tech Parkway, Apt 305', 'Springfield', 'IL', '62702', NULL, ARRAY['young-adult', 'newcomer'], 'ffffffff-0000-0000-0000-000000000005', 'Interested in women''s group but hasn''t attended yet. Graphic designer, works from home.'),

  -- Singles/Other
  ('00000000-0000-0000-0000-000000000045', '11111111-1111-1111-1111-111111111111', 'Ruth', 'Patterson', 'ruth.patterson@email.com', '(555) 111-2233', 'member', '1947-05-20', '2008-01-15', '2007-11-04', '22 Quiet Oaks Drive', 'Springfield', 'IL', '62703', NULL, ARRAY['prayer-team', 'senior', 'founding-member'], NULL, 'Longest-standing active member. Prayer warrior - leads Tuesday morning prayer. Widowed 2019. Retired schoolteacher. Beloved by everyone.'),
  ('00000000-0000-0000-0000-000000000046', '11111111-1111-1111-1111-111111111111', 'Marcus', 'Greene', 'marcus.greene@email.com', '(555) 456-1122', 'member', '1996-03-28', '2024-01-20', '2023-11-05', '789 Downtown Lofts, Unit 12', 'Springfield', 'IL', '62701', NULL, ARRAY['tech-team', 'young-adult', 'volunteer'], NULL, 'Runs the sound board and live stream every Sunday. IT professional. Started attending after breakup, found community here.'),
  ('00000000-0000-0000-0000-000000000047', '11111111-1111-1111-1111-111111111111', 'Olivia', 'Foster', 'olivia.foster@university.edu', '(555) 567-3344', 'visitor', '2002-08-15', NULL, '2026-02-09', '300 University Ave, Dorm B-204', 'Springfield', 'IL', '62701', NULL, ARRAY['first-time', 'college-student'], NULL, 'UIS grad student studying social work. Visited twice so far. Looking for community away from home. From Chicago.'),
  ('00000000-0000-0000-0000-000000000048', '11111111-1111-1111-1111-111111111111', 'Samuel', 'Jackson', 'sam.jackson@email.com', '(555) 678-4455', 'regular', '1992-12-03', NULL, '2024-07-14', '155 Maple Court', 'Springfield', 'IL', '62704', NULL, ARRAY['single-parent', 'volunteer'], 'ffffffff-0000-0000-0000-000000000006', 'Single dad raising Lily. Works nights at warehouse. Attends when schedule allows. Helped with fall festival setup. Going through tough custody situation.'),
  ('00000000-0000-0000-0000-000000000049', '11111111-1111-1111-1111-111111111111', 'Lily', 'Jackson', NULL, NULL, 'regular', '2017-10-25', NULL, '2024-07-14', '155 Maple Court', 'Springfield', 'IL', '62704', NULL, ARRAY['child', 'kids-ministry'], 'ffffffff-0000-0000-0000-000000000006', 'Sweet girl. Loves kids ministry. Dad brings her whenever he can.'),
  ('00000000-0000-0000-0000-000000000050', '11111111-1111-1111-1111-111111111111', 'Dorothy', 'Mitchell', 'dorothy.mitchell@email.com', '(555) 789-5566', 'inactive', '1952-09-18', '2012-05-10', '2012-03-18', '45 Sunrise Senior Living', 'Springfield', 'IL', '62703', NULL, ARRAY['senior', 'homebound'], NULL, 'Moved to assisted living after hip surgery in 2024. Husband Harold visits church occasionally. Misses the community terribly. Would love visitors.')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPANDED: INTERACTIONS FOR NEW PEOPLE
-- ============================================
INSERT INTO interactions (id, church_id, person_id, type, content, created_by, created_at) VALUES
  -- Carlos Rodriguez
  ('22222222-2222-2222-2222-222222222236', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 'visit', 'Deacon board meeting - Carlos attended monthly deacon meeting. Discussed Spanish ministry expansion and building fund progress.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-20 19:00:00'),
  ('22222222-2222-2222-2222-222222222237', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 'note', 'Carlos volunteered for building project - Carlos offered his construction company to do pro-bono work on the fellowship hall renovation. Huge blessing.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-12 11:00:00'),
  -- Elena Rodriguez
  ('22222222-2222-2222-2222-222222222238', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 'note', 'Elena organized potluck - Elena coordinated the January fellowship dinner. 85 people attended - great turnout!', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-18 14:00:00'),
  -- Derek Washington
  ('22222222-2222-2222-2222-222222222239', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 'call', 'Check-in call with Derek - Called to check in after Derek missed two weeks. He was on shift at fire station. All good - back this Sunday.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-15 10:30:00'),
  -- Keisha Washington
  ('22222222-2222-2222-2222-222222222240', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000041', 'note', 'Keisha choir solo - Keisha sang a beautiful solo during worship. Several people mentioned how moved they were. She has a real gift.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-19 12:00:00'),
  -- Raj Patel
  ('22222222-2222-2222-2222-222222222241', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000043', 'visit', 'Coffee with Raj - Met Raj for coffee to discuss his faith journey. He grew up Hindu, wife is Christian. Very open and asking good questions. Gave him a Bible.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-08 14:00:00'),
  ('22222222-2222-2222-2222-222222222242', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000043', 'note', 'Raj offered to help with church website - Raj mentioned he could help modernize our website. Connected him with Marcus Greene on tech team.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-19 11:00:00'),
  -- Ruth Patterson
  ('22222222-2222-2222-2222-222222222243', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'visit', 'Home visit with Ruth - Visited Ruth at home. She is doing well physically but lonely since Harold passed. Prayed together. She is still sharp as a tack at 78.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-22 14:00:00'),
  ('22222222-2222-2222-2222-222222222244', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'note', 'Ruth mentoring young women - Ruth has been informally mentoring several younger women in the church. A real Titus 2 woman. Should recognize her somehow.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-10 09:00:00'),
  -- Marcus Greene
  ('22222222-2222-2222-2222-222222222245', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 'note', 'Marcus sound system upgrade - Marcus researched and proposed a sound system upgrade. Budget ~$3,500. Presented to deacons.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-21 18:00:00'),
  -- Olivia Foster (visitor)
  ('22222222-2222-2222-2222-222222222246', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000047', 'note', 'First-time visitor: Olivia Foster - College student from UIS. Seemed a bit shy but stayed for coffee after service. Connected her with Ashley Bennett (similar age).', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-02-09 12:30:00'),
  ('22222222-2222-2222-2222-222222222247', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000047', 'note', 'Olivia returned - 2nd visit - Olivia came back! Sat with Ashley this time. Mentioned she is studying social work and wants to make a difference. Good fit for outreach team eventually.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-02-16 12:30:00'),
  -- Samuel Jackson
  ('22222222-2222-2222-2222-222222222248', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000048', 'call', 'Samuel called about custody situation - Samuel called upset about custody hearing next week. Prayed with him on the phone. Connected him with the church pro-bono legal contact.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-20 21:00:00'),
  ('22222222-2222-2222-2222-222222222249', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000048', 'note', 'Samuel helped with fall festival - Samuel showed up early Saturday to set up the fall festival. Really stepped up despite his tough schedule. Lily had a blast.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2024-10-26 09:00:00'),
  -- Dorothy Mitchell
  ('22222222-2222-2222-2222-222222222250', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000050', 'visit', 'Visited Dorothy at Sunrise Senior Living - Brought Dorothy communion and flowers from the church. She cried - so grateful. Harold was there too. She watches the livestream every Sunday (Marcus set her up).', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-16 15:00:00'),
  ('22222222-2222-2222-2222-222222222251', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000050', 'call', 'Called Dorothy to check in - Weekly check-in call. Dorothy sounded good. PT is helping with mobility. Mentioned she would love visitors from the women group.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-23 10:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPANDED: ATTENDANCE FOR NEW PEOPLE
-- ============================================
INSERT INTO attendance (id, church_id, person_id, event_type, event_name, date, checked_in_at) VALUES
  -- Carlos Rodriguez - very consistent
  ('88880036-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880036-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 'sunday', 'Sunday Worship', '2025-01-12', '2025-01-12 10:00:00'),
  ('88880036-8888-8888-8888-888888880103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  ('88880036-8888-8888-8888-888888880104', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 'small-group', 'Men of Faith', '2025-01-14', '2025-01-14 19:00:00'),
  ('88880036-8888-8888-8888-888888880105', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 'small-group', 'Men of Faith', '2025-01-21', '2025-01-21 19:00:00'),
  -- Elena Rodriguez
  ('88880037-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880037-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 'sunday', 'Sunday Worship', '2025-01-12', '2025-01-12 10:00:00'),
  ('88880037-8888-8888-8888-888888880103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  ('88880037-8888-8888-8888-888888880104', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 'small-group', 'Women''s Bible Study', '2025-01-08', '2025-01-08 09:30:00'),
  ('88880037-8888-8888-8888-888888880105', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 'small-group', 'Women''s Bible Study', '2025-01-15', '2025-01-15 09:30:00'),
  ('88880037-8888-8888-8888-888888880106', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 'small-group', 'Women''s Bible Study', '2025-01-22', '2025-01-22 09:30:00'),
  -- Isabella Rodriguez (youth)
  ('88880038-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000038', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880038-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000038', 'sunday', 'Sunday Worship', '2025-01-12', '2025-01-12 10:00:00'),
  ('88880038-8888-8888-8888-888888880103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000038', 'small-group', 'Youth Group', '2025-01-10', '2025-01-10 18:30:00'),
  ('88880038-8888-8888-8888-888888880104', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000038', 'small-group', 'Youth Group', '2025-01-17', '2025-01-17 18:30:00'),
  -- Diego Rodriguez (kids)
  ('88880039-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000039', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880039-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000039', 'sunday', 'Sunday Worship', '2025-01-12', '2025-01-12 10:00:00'),
  -- Derek Washington
  ('88880040-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880040-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  ('88880040-8888-8888-8888-888888880103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 'small-group', 'Men of Faith', '2025-01-07', '2025-01-07 19:00:00'),
  ('88880040-8888-8888-8888-888888880104', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 'small-group', 'Men of Faith', '2025-01-21', '2025-01-21 19:00:00'),
  -- Keisha Washington
  ('88880041-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000041', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880041-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000041', 'sunday', 'Sunday Worship', '2025-01-12', '2025-01-12 10:00:00'),
  ('88880041-8888-8888-8888-888888880103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000041', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  ('88880041-8888-8888-8888-888888880104', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000041', 'small-group', 'Women''s Bible Study', '2025-01-08', '2025-01-08 09:30:00'),
  -- Zion Washington
  ('88880042-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000042', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880042-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000042', 'sunday', 'Sunday Worship', '2025-01-12', '2025-01-12 10:00:00'),
  -- Raj Patel - regular but not every week
  ('88880043-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000043', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880043-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000043', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  -- Priya Patel
  ('88880044-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000044', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880044-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000044', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  -- Ruth Patterson - never misses
  ('88880045-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880045-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'sunday', 'Sunday Worship', '2025-01-12', '2025-01-12 10:00:00'),
  ('88880045-8888-8888-8888-888888880103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  ('88880045-8888-8888-8888-888888880104', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'special', 'Tuesday Morning Prayer', '2025-01-07', '2025-01-07 06:00:00'),
  ('88880045-8888-8888-8888-888888880105', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'special', 'Tuesday Morning Prayer', '2025-01-14', '2025-01-14 06:00:00'),
  ('88880045-8888-8888-8888-888888880106', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'special', 'Tuesday Morning Prayer', '2025-01-21', '2025-01-21 06:00:00'),
  -- Marcus Greene - consistent member + tech team
  ('88880046-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880046-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 'sunday', 'Sunday Worship', '2025-01-12', '2025-01-12 10:00:00'),
  ('88880046-8888-8888-8888-888888880103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  ('88880046-8888-8888-8888-888888880104', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 'special', 'Tech Team Setup', '2025-01-05', '2025-01-05 08:30:00'),
  ('88880046-8888-8888-8888-888888880105', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 'special', 'Tech Team Setup', '2025-01-12', '2025-01-12 08:30:00'),
  ('88880046-8888-8888-8888-888888880106', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 'special', 'Tech Team Setup', '2025-01-19', '2025-01-19 08:30:00'),
  -- Olivia Foster - 2 visits
  ('88880047-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000047', 'sunday', 'Sunday Worship', '2026-02-09', '2026-02-09 10:00:00'),
  ('88880047-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000047', 'sunday', 'Sunday Worship', '2026-02-16', '2026-02-16 10:00:00'),
  -- Samuel Jackson - sporadic
  ('88880048-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000048', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880048-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000048', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00'),
  -- Lily Jackson
  ('88880049-8888-8888-8888-888888880101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000049', 'sunday', 'Sunday Worship', '2025-01-05', '2025-01-05 10:00:00'),
  ('88880049-8888-8888-8888-888888880102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000049', 'sunday', 'Sunday Worship', '2025-01-19', '2025-01-19 10:00:00')
  -- Dorothy Mitchell - no attendance (homebound, watches livestream)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPANDED: GIVING FOR NEW PEOPLE
-- ============================================
INSERT INTO giving (id, church_id, person_id, amount, fund, date, method, is_recurring, note) VALUES
  -- Carlos Rodriguez - generous, consistent tither
  ('99990036-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 500.00, 'tithe', '2025-01-05', 'check', false, NULL),
  ('99990036-9999-9999-9999-999999990102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 500.00, 'tithe', '2025-01-12', 'check', false, NULL),
  ('99990036-9999-9999-9999-999999990103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 500.00, 'tithe', '2025-01-19', 'check', false, NULL),
  ('99990036-9999-9999-9999-999999990104', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 1000.00, 'building', '2025-01-19', 'check', false, 'Extra building fund gift'),
  -- Elena Rodriguez
  ('99990037-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 200.00, 'tithe', '2025-01-05', 'online', true, NULL),
  ('99990037-9999-9999-9999-999999990102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 200.00, 'tithe', '2025-01-12', 'online', true, NULL),
  ('99990037-9999-9999-9999-999999990103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 200.00, 'tithe', '2025-01-19', 'online', true, NULL),
  -- Derek Washington - solid giver
  ('99990040-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 300.00, 'tithe', '2025-01-05', 'online', true, NULL),
  ('99990040-9999-9999-9999-999999990102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 300.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('99990040-9999-9999-9999-999999990103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 100.00, 'benevolence', '2025-01-19', 'cash', false, NULL),
  -- Keisha Washington
  ('99990041-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000041', 150.00, 'tithe', '2025-01-12', 'online', false, NULL),
  -- Raj Patel - occasional, exploring
  ('99990043-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000043', 100.00, 'other', '2025-01-19', 'online', false, 'First gift'),
  -- Ruth Patterson - faithful, modest fixed income
  ('99990045-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 50.00, 'tithe', '2025-01-05', 'check', false, NULL),
  ('99990045-9999-9999-9999-999999990102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 50.00, 'tithe', '2025-01-12', 'check', false, NULL),
  ('99990045-9999-9999-9999-999999990103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 50.00, 'tithe', '2025-01-19', 'check', false, NULL),
  -- Marcus Greene
  ('99990046-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 100.00, 'tithe', '2025-01-05', 'online', true, NULL),
  ('99990046-9999-9999-9999-999999990102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 100.00, 'tithe', '2025-01-12', 'online', true, NULL),
  ('99990046-9999-9999-9999-999999990103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 100.00, 'tithe', '2025-01-19', 'online', true, NULL),
  -- Samuel Jackson - gives when he can
  ('99990048-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000048', 40.00, 'other', '2025-01-19', 'cash', false, NULL),
  -- Dorothy Mitchell - still gives from home
  ('99990050-9999-9999-9999-999999990101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000050', 100.00, 'tithe', '2025-01-10', 'check', false, 'Mailed in by Harold')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPANDED: PRAYER REQUESTS FOR NEW PEOPLE
-- ============================================
INSERT INTO prayer_requests (id, church_id, person_id, content, is_private, is_answered, created_at, updated_at) VALUES
  ('77770036-7777-7777-7777-777777770101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 'Pray for our construction business - we have a big project bid coming up that could help fund the building renovation.', false, false, '2025-01-15 10:00:00', '2025-01-15 10:00:00'),
  ('77770037-7777-7777-7777-777777770101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 'Please pray for my mother in Mexico who is having health issues. We are trying to get her a visa to visit.', false, false, '2025-01-18 09:00:00', '2025-01-18 09:00:00'),
  ('77770040-7777-7777-7777-777777770101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 'Safety on the job. We responded to a bad fire last week and it reminded me how dangerous the work is.', false, false, '2025-01-13 20:00:00', '2025-01-13 20:00:00'),
  ('77770043-7777-7777-7777-777777770101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000043', 'Pray for me as I explore Christianity. My Hindu family does not understand my interest and it is causing tension.', true, false, '2025-01-10 15:00:00', '2025-01-10 15:00:00'),
  ('77770045-7777-7777-7777-777777770101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 'Continued strength and health. Also praying for the young people of our church - they are the future.', false, false, '2025-01-06 07:00:00', '2025-01-06 07:00:00'),
  ('77770048-7777-7777-7777-777777770101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000048', 'Please pray for my custody situation with Lily. The hearing is next week and I need Gods peace and favor.', true, false, '2025-01-20 21:30:00', '2025-01-20 21:30:00'),
  ('77770050-7777-7777-7777-777777770101', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000050', 'Pray for my recovery from hip surgery and that I can return to church someday. I miss my church family so much.', false, false, '2025-01-05 11:00:00', '2025-01-05 11:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPANDED: GIVING STATEMENTS FOR NEW PEOPLE (2024)
-- ============================================
INSERT INTO giving_statements (id, church_id, person_id, year, total_amount, by_fund, generated_at, sent_at, sent_method) VALUES
  ('44445555-4444-5555-4444-555544445561', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000036', 2024, 28000.00, '{"tithe": 24000, "building": 4000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445562', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000037', 2024, 9600.00, '{"tithe": 9600}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445563', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000040', 2024, 10800.00, '{"tithe": 9000, "benevolence": 1800}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445564', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000045', 2024, 2600.00, '{"tithe": 2600}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'print'),
  ('44445555-4444-5555-4444-555544445565', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000046', 2024, 3600.00, '{"tithe": 3600}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445566', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000050', 2024, 5200.00, '{"tithe": 5200}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'print')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPANDED: SCHEDULED MESSAGES FOR NEW PEOPLE
-- ============================================
INSERT INTO scheduled_messages (id, church_id, person_id, channel, subject, body, scheduled_for, status, source_type, source_agent, ai_generated, created_by) VALUES
  -- Welcome message for Olivia Foster (recent visitor)
  ('cccccc12-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000047', 'email', 'So Glad You Visited, Olivia!', 'Hi Olivia,\n\nIt was wonderful to meet you at Grace Community Church! We hope you felt welcome. As a grad student, we know how important community is - especially away from home.\n\nOur young adults group meets Thursdays at 7:30 PM. Ashley Bennett would love to introduce you around!\n\nBlessings,\nPastor John', '2026-02-11 10:00:00', 'sent', 'follow_up', 'new-member-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Check-in for Dorothy Mitchell
  ('cccccc13-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000050', 'email', 'Thinking of You, Dorothy', 'Dear Dorothy,\n\nWe miss you at Grace Community Church! We wanted you to know that you are thought of and prayed for every week.\n\nWe hope you are enjoying the livestream. Several ladies from the womens group would love to visit you soon.\n\nWith love,\nGrace Community Church', '2025-01-25 10:00:00', 'scheduled', 'pastoral_care', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- First-time giver thank you for Raj
  ('cccccc14-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000043', 'email', 'Thank You for Your First Gift, Raj!', 'Dear Raj,\n\nThank you so much for your generous gift to Grace Community Church! We are honored that you chose to support our ministry.\n\nYour generosity helps us serve our community and share Gods love.\n\nBlessings,\nPastor John', '2025-01-20 14:00:00', 'sent', 'donation', 'donation-processing-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPANDED: DRIP CAMPAIGN ENROLLMENTS FOR NEW PEOPLE
-- ============================================
INSERT INTO drip_campaign_enrollments (id, campaign_id, person_id, current_step, status, enrolled_at, completed_at, next_message_at) VALUES
  -- Olivia Foster - visitor welcome sequence
  ('33334444-3333-4444-3333-444433334451', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000047', 1, 'active', '2026-02-09 12:00:00', NULL, '2026-02-12 12:00:00'),
  -- Raj Patel - first-time giver follow-up
  ('33334444-3333-4444-3333-444433334452', '11112222-1111-2222-1111-222211112224', '00000000-0000-0000-0000-000000000043', 1, 'active', '2025-01-19 15:00:00', NULL, '2025-01-26 15:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- END OF SEED DATA
-- ============================================
-- Total: 50 people in congregation
-- 9 families: Johnson, Thompson, Davis, Williams, Anderson, Lee, Rodriguez, Washington, Jackson
-- 2 couples: Martinez, Patel
-- 5 singles: Ruth Patterson, Marcus Greene, Olivia Foster, Dorothy Mitchell, plus existing singles
--
-- HOW TO LOAD INTO SUPABASE (no CLI needed):
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Run each migration file (001 through 004) in order
-- 3. Then paste and run this entire seed.sql file
-- All inserts use ON CONFLICT DO NOTHING so it is safe to re-run
