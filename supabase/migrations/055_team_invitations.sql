-- GRACE CRM — Staff/team invitations
-- Migration: 055_team_invitations.sql
--
-- Mirrors member_invitations (016) but for CRM staff access rather than
-- congregation portal access: no people row required, and the granted
-- role is a CRM role (admin/pastor/staff/volunteer), never 'member'.
-- Redemption (api/team/_accept-invitation.ts) upserts a users row and
-- writes the role to Clerk publicMetadata, same shape as
-- billing/_create-church.ts uses for the founding admin.
--
-- Idempotent: IF NOT EXISTS / DROP IF EXISTS throughout.

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pastor', 'staff', 'volunteer')),
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

-- One live invitation per email per church (re-invites revoke the previous row).
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_church_email_pending
  ON team_invitations(church_id, lower(email)) WHERE status IN ('pending', 'sent');

CREATE INDEX IF NOT EXISTS idx_team_invitations_church
  ON team_invitations(church_id, status);

DROP TRIGGER IF EXISTS set_updated_at ON team_invitations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Church-scoped read for staff; writes are service-role / API only
-- (the invite + accept routes use the Supabase service key, same as
-- member_invitations).
DROP POLICY IF EXISTS "team_invitations read own church" ON team_invitations;
CREATE POLICY "team_invitations read own church"
  ON team_invitations FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE team_invitations IS
  'CRM staff invitations issued by church admins. Tokens redeemed at sign-up bind the new Clerk user to a users row with the granted role — separate from member_invitations, which grants member-portal access, not CRM access.';
