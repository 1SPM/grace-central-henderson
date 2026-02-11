-- GRACE CRM - Leader Onboarding & Pastoral Sessions
-- Migration: 002_leader_onboarding_sessions.sql

-- ============================================
-- LEADER APPLICATIONS (Onboarding Pipeline)
-- ============================================

CREATE TABLE leader_applications (
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
  references JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PASTORAL SESSIONS (Session Tracking)
-- ============================================

CREATE TABLE pastoral_sessions (
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

CREATE TABLE leader_availability (
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

CREATE INDEX idx_leader_applications_church ON leader_applications(church_id);
CREATE INDEX idx_leader_applications_status ON leader_applications(church_id, status);
CREATE INDEX idx_leader_applications_person ON leader_applications(person_id);

CREATE INDEX idx_pastoral_sessions_church ON pastoral_sessions(church_id);
CREATE INDEX idx_pastoral_sessions_leader ON pastoral_sessions(leader_id);
CREATE INDEX idx_pastoral_sessions_person ON pastoral_sessions(person_id);
CREATE INDEX idx_pastoral_sessions_date ON pastoral_sessions(church_id, started_at DESC);
CREATE INDEX idx_pastoral_sessions_category ON pastoral_sessions(church_id, category);

CREATE INDEX idx_leader_availability_leader ON leader_availability(leader_id);

-- ============================================
-- ROW-LEVEL SECURITY
-- ============================================

ALTER TABLE leader_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_availability ENABLE ROW LEVEL SECURITY;

-- Leader Applications: scoped to church
CREATE POLICY "Church members can view leader applications"
  ON leader_applications FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can manage leader applications"
  ON leader_applications FOR ALL
  USING (church_id = auth.church_id());

-- Pastoral Sessions: scoped to church
CREATE POLICY "Church members can view pastoral sessions"
  ON pastoral_sessions FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can manage pastoral sessions"
  ON pastoral_sessions FOR ALL
  USING (church_id = auth.church_id());

-- Leader Availability: scoped to church
CREATE POLICY "Church members can view leader availability"
  ON leader_availability FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Church members can manage leader availability"
  ON leader_availability FOR ALL
  USING (church_id = auth.church_id());

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON leader_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON pastoral_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
