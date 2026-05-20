-- GRACE CRM - Anchor Marketplace (Phase 1 of next-level pivot)
-- Migration: 006_anchor_marketplace.sql
--
-- Adds platform-level verified leader marketplace with AI clones.
-- Cross-church: a single leader can serve members from any participating church.
-- Phase 2 will add pgvector + per-person memory; this migration is intentionally narrow.
-- All statements idempotent (IF NOT EXISTS / IF EXISTS).

-- ============================================
-- ANCHOR LEADERS (Platform-Level Marketplace)
-- ============================================

CREATE TABLE IF NOT EXISTS anchor_leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Optional link back to the church that originally onboarded this leader
  source_application_id UUID REFERENCES leader_applications(id) ON DELETE SET NULL,
  source_church_id UUID REFERENCES churches(id) ON DELETE SET NULL,

  -- Public profile
  display_name TEXT NOT NULL,
  title TEXT NOT NULL,
  bio TEXT NOT NULL,
  photo_url TEXT,
  intro_video_url TEXT,

  -- Filterable attributes
  expertise_areas TEXT[] NOT NULL DEFAULT '{}',
  credentials TEXT[] NOT NULL DEFAULT '{}',
  years_of_practice INTEGER,
  personality_traits TEXT[] NOT NULL DEFAULT '{}',
  spiritual_focus_areas TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'English',
  gender TEXT CHECK (gender IN ('male', 'female', 'non-binary', 'unspecified')),
  denomination TEXT,
  anchor_verse TEXT,

  -- Marketplace flags
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_accepting_new_conversations BOOLEAN NOT NULL DEFAULT true,

  -- Pricing (platform default; per-church overrides in visibility table)
  ai_chat_price_cents INTEGER NOT NULL DEFAULT 0,
  human_session_price_cents INTEGER NOT NULL DEFAULT 0,

  -- Aggregated stats (denormalized for fast browse)
  total_conversations INTEGER NOT NULL DEFAULT 0,
  total_sessions_completed INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2),
  rating_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ANCHOR AI PERSONAS (Clone Training & Config)
-- ============================================

CREATE TABLE IF NOT EXISTS anchor_ai_personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL UNIQUE REFERENCES anchor_leaders(id) ON DELETE CASCADE,

  -- Generated system prompt — assembled from training data below.
  -- Regenerated whenever leader updates their intake.
  system_prompt TEXT NOT NULL,

  -- Raw training inputs (kept so we can regenerate the system prompt deterministically)
  theology_positions JSONB NOT NULL DEFAULT '{}',
  stock_phrases TEXT[] NOT NULL DEFAULT '{}',
  anchor_verses TEXT[] NOT NULL DEFAULT '{}',
  tone_directness INTEGER CHECK (tone_directness BETWEEN 1 AND 10),
  tone_scripture_weight INTEGER CHECK (tone_scripture_weight BETWEEN 1 AND 10),
  tone_warmth INTEGER CHECK (tone_warmth BETWEEN 1 AND 10),

  -- Disclosure copy — each leader can customize how their AI introduces itself
  disclosure_message TEXT NOT NULL DEFAULT 'I''m an AI companion trained on this leader''s notes and teaching. I can pray with you, talk through what you''re carrying, and book you in with the real person whenever you want.',

  -- Boundaries
  refuses_to_discuss TEXT[] NOT NULL DEFAULT '{}',
  always_recommend_human_for TEXT[] NOT NULL DEFAULT '{"crisis","abuse","suicide","self-harm"}',

  -- Approval (separate from leader.is_verified — persona must be reviewed independently)
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ANCHOR LEADER VISIBILITY (Per-Church Curation)
-- ============================================
-- Each church curates which platform leaders appear in their member portal.
-- Empty rows for a church => show all published leaders by default.
-- Any rows for a church => show only explicitly is_visible=true rows.

CREATE TABLE IF NOT EXISTS anchor_leader_visibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES anchor_leaders(id) ON DELETE CASCADE,

  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,

  -- Per-church price overrides (NULL = use platform default)
  override_ai_chat_price_cents INTEGER,
  override_human_session_price_cents INTEGER,

  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (church_id, leader_id)
);

-- ============================================
-- ANCHOR INTAKE RESPONSES (Member Quiz Answers)
-- ============================================

CREATE TABLE IF NOT EXISTS anchor_intake_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  topics TEXT[] NOT NULL DEFAULT '{}',
  tone_preference INTEGER CHECK (tone_preference BETWEEN 1 AND 10),
  gender_preference TEXT CHECK (gender_preference IN ('male', 'female', 'no_preference')),
  free_text TEXT,

  -- Match output (what we recommended at intake time)
  matched_leader_ids UUID[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ANCHOR CONVERSATIONS (AI Clone Chat Threads)
-- ============================================

CREATE TABLE IF NOT EXISTS anchor_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES anchor_leaders(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,

  -- For anonymous chats, store a session token instead of person_id
  anonymous_session_id TEXT,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'idle', 'handoff_offered', 'handoff_accepted', 'closed', 'archived'
  )),

  topic TEXT,

  -- Crisis flag — set when AI detects crisis keywords or member explicitly signals
  crisis_flagged BOOLEAN NOT NULL DEFAULT false,
  crisis_flagged_at TIMESTAMPTZ,

  -- Loose link to pastoral_sessions if member booked a real-human session from this thread
  handoff_pastoral_session_id UUID,

  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,

  -- A conversation must have either a person_id or an anonymous_session_id
  CHECK (person_id IS NOT NULL OR anonymous_session_id IS NOT NULL)
);

-- ============================================
-- ANCHOR MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS anchor_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES anchor_conversations(id) ON DELETE CASCADE,

  sender TEXT NOT NULL CHECK (sender IN ('member', 'ai_clone', 'human_leader', 'system')),
  content TEXT NOT NULL,

  -- Special-message flags
  is_disclosure BOOLEAN NOT NULL DEFAULT false,
  is_handoff_offer BOOLEAN NOT NULL DEFAULT false,
  is_crisis_flag BOOLEAN NOT NULL DEFAULT false,

  -- LLM stats (when sender='ai_clone')
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_anchor_leaders_published
  ON anchor_leaders(is_published, is_verified) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_anchor_leaders_expertise
  ON anchor_leaders USING GIN (expertise_areas);

CREATE INDEX IF NOT EXISTS idx_anchor_personas_leader
  ON anchor_ai_personas(leader_id);

CREATE INDEX IF NOT EXISTS idx_anchor_visibility_church
  ON anchor_leader_visibility(church_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_anchor_visibility_leader
  ON anchor_leader_visibility(leader_id);

CREATE INDEX IF NOT EXISTS idx_anchor_intake_person
  ON anchor_intake_responses(church_id, person_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anchor_conversations_church
  ON anchor_conversations(church_id, status);
CREATE INDEX IF NOT EXISTS idx_anchor_conversations_person
  ON anchor_conversations(person_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_anchor_conversations_leader
  ON anchor_conversations(leader_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_anchor_conversations_active
  ON anchor_conversations(status, last_message_at DESC)
  WHERE status IN ('active', 'idle');

CREATE INDEX IF NOT EXISTS idx_anchor_messages_conversation
  ON anchor_messages(conversation_id, created_at);

-- ============================================
-- TRIGGERS — auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION anchor_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_anchor_leaders_touch ON anchor_leaders;
CREATE TRIGGER trig_anchor_leaders_touch BEFORE UPDATE ON anchor_leaders
  FOR EACH ROW EXECUTE FUNCTION anchor_touch_updated_at();

DROP TRIGGER IF EXISTS trig_anchor_personas_touch ON anchor_ai_personas;
CREATE TRIGGER trig_anchor_personas_touch BEFORE UPDATE ON anchor_ai_personas
  FOR EACH ROW EXECUTE FUNCTION anchor_touch_updated_at();

DROP TRIGGER IF EXISTS trig_anchor_visibility_touch ON anchor_leader_visibility;
CREATE TRIGGER trig_anchor_visibility_touch BEFORE UPDATE ON anchor_leader_visibility
  FOR EACH ROW EXECUTE FUNCTION anchor_touch_updated_at();

-- ============================================
-- TRIGGERS — bump conversation.last_message_at on new message
-- ============================================

CREATE OR REPLACE FUNCTION anchor_bump_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE anchor_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_anchor_messages_bump ON anchor_messages;
CREATE TRIGGER trig_anchor_messages_bump AFTER INSERT ON anchor_messages
  FOR EACH ROW EXECUTE FUNCTION anchor_bump_conversation_timestamp();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE anchor_leaders IS 'Platform-level verified ministry leader marketplace listings. Cross-church.';
COMMENT ON TABLE anchor_ai_personas IS 'AI clone config per leader. system_prompt assembled from structured intake. Phase 1 = prompt-only.';
COMMENT ON TABLE anchor_leader_visibility IS 'Per-church curation. Empty = show all published; any rows = show only allowed.';
COMMENT ON TABLE anchor_intake_responses IS 'Member quiz answers + recommended matches.';
COMMENT ON TABLE anchor_conversations IS 'AI clone chat thread. Human bookings reuse existing pastoral_sessions.';
COMMENT ON TABLE anchor_messages IS 'Individual messages. Sender = member | ai_clone | human_leader | system.';

-- ============================================
-- NOTE: RLS policies for these tables to be added in a follow-up migration
-- (matching the pattern in 005_row_level_security.sql)
-- ============================================
