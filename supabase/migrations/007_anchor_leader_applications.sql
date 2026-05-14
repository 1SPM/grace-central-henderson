-- GRACE CRM - Anchor Marketplace: public leader applications
-- Migration: 007_anchor_leader_applications.sql
--
-- Platform-level application funnel for the verified leader marketplace.
-- Distinct from `leader_applications` (002) which is church-scoped (church_id NOT NULL).
-- This table is the intake for ANYONE applying to become an anchor_leader —
-- no church affiliation required. Reviewed applications are promoted into
-- `anchor_leaders` (006) by an admin.
-- All statements idempotent (IF NOT EXISTS / IF EXISTS).

CREATE TABLE IF NOT EXISTS anchor_leader_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Applicant identity + contact (email required so we can reach them)
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- Who they are
  role TEXT,                        -- pastor | counselor | spiritual_director | influencer | author | other
  audience_url TEXT,                -- link to their socials / podcast / channel / substack
  audience_size TEXT,               -- rough range, free text
  expertise_areas TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,                         -- "tell us about your ministry"
  motivation TEXT,                  -- "why do you want to join"

  -- Pipeline
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'reviewing', 'approved', 'rejected'
  )),
  status_notes TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  -- Loose link to the published listing once promoted
  anchor_leader_id UUID REFERENCES anchor_leaders(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anchor_leader_applications_status
  ON anchor_leader_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anchor_leader_applications_email
  ON anchor_leader_applications(email);

-- updated_at trigger — reuses anchor_touch_updated_at() defined in 006
DROP TRIGGER IF EXISTS trig_anchor_leader_applications_touch ON anchor_leader_applications;
CREATE TRIGGER trig_anchor_leader_applications_touch BEFORE UPDATE ON anchor_leader_applications
  FOR EACH ROW EXECUTE FUNCTION anchor_touch_updated_at();

-- RLS — service role only. Public submissions go through the /api/leader-apply
-- endpoint, which uses the service role key. No anon access.
ALTER TABLE anchor_leader_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON anchor_leader_applications;
CREATE POLICY "Service role full access" ON anchor_leader_applications
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE anchor_leader_applications IS 'Public intake funnel for the verified leader marketplace. Promoted into anchor_leaders on approval.';
