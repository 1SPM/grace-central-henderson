-- GRACE CRM — Member identity foundation (Portal-CRM Alignment, Phase A)
-- Migration: 016_member_identity.sql
--
-- Binds member-portal logins to CRM people records:
--   1. people.clerk_user_id    — links an authenticated Clerk user to their person row
--   2. people.portal_enabled   — operator pre-qualification flag (Central Henderson
--                                partitions which members may activate portal accounts)
--   3. member_invitations      — invitation tokens issued from the admin People page
--   4. users.role CHECK        — widened to include 'pastor' and 'member' (the TS layer
--                                already supports both; the 001 constraint predates them)
--
-- Idempotent: IF NOT EXISTS / DROP IF EXISTS throughout.

-- ============================================
-- 1. people: Clerk linkage + portal access flag
-- ============================================

ALTER TABLE people ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS portal_last_seen_at TIMESTAMPTZ;
-- Directory privacy (Phase B uses this; shipped here so people schema changes land once)
ALTER TABLE people ADD COLUMN IF NOT EXISTS directory_opt_in BOOLEAN NOT NULL DEFAULT true;

-- One Clerk user maps to at most one person.
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_clerk_user_id
  ON people(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_portal_enabled
  ON people(church_id) WHERE portal_enabled;

-- ============================================
-- 2. users: widen role constraint
-- ============================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'pastor', 'staff', 'volunteer', 'member'));

-- ============================================
-- 3. member_invitations
-- ============================================

CREATE TABLE IF NOT EXISTS member_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'accepted', 'revoked', 'expired')),
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  clerk_invitation_id TEXT,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live invitation per person (re-invites revoke/expire the previous row).
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_invitations_person_pending
  ON member_invitations(person_id) WHERE status IN ('pending', 'sent');

CREATE INDEX IF NOT EXISTS idx_member_invitations_church
  ON member_invitations(church_id, status);

DROP TRIGGER IF EXISTS set_updated_at ON member_invitations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON member_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. RLS
-- ============================================

ALTER TABLE member_invitations ENABLE ROW LEVEL SECURITY;

-- Church-scoped read for staff; writes are service-role / API only.
DROP POLICY IF EXISTS "member_invitations read own church" ON member_invitations;
CREATE POLICY "member_invitations read own church"
  ON member_invitations FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE member_invitations IS
  'Portal invitations issued by church staff. Tokens redeemed during member sign-up bind the new Clerk user to people.clerk_user_id.';
COMMENT ON COLUMN people.clerk_user_id IS
  'Clerk user ID for the member''s portal login. Set when an invitation is accepted.';
COMMENT ON COLUMN people.portal_enabled IS
  'Operator pre-qualification: only enabled people may activate or use a portal account.';
