-- GRACE — Member Portal self-service sign-up
-- Migration: 078_portal_self_signup.sql
--
-- Lets a congregation member (or anyone front-facing) create their own
-- Member Portal account without a staff member provisioning it first
-- (see api/portal/_self-signup.ts). Two new columns on `people` track
-- that path so the sensitive-data surface can stay staff-reviewed even
-- though login access itself no longer requires staff approval:
--
--   self_registered   — true when this person's clerk_user_id was bound
--                        by their own sign-up, not by staff (Set up
--                        portal account / invite accept). portal_enabled
--                        is still set true immediately in this path — it
--                        gates login, not review status.
--   staff_reviewed_at — null until a staff member (portal.provision_member
--                        permission) confirms the self-signed-up identity.
--                        Only self_registered rows are ever pending; a
--                        staff-provisioned row has no review step at all.
--
-- Read together, "self_registered = true AND staff_reviewed_at IS NULL"
-- is the actor.identityVerified = false case (api/_lib/authz.ts) that
-- hides giving history, Impact Card, and care-request history until
-- reviewed. Idempotent: IF NOT EXISTS / DROP IF EXISTS throughout.

ALTER TABLE people ADD COLUMN IF NOT EXISTS self_registered BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS staff_reviewed_at TIMESTAMPTZ;

-- Staff "pending review" queue: self-registered, not yet reviewed.
CREATE INDEX IF NOT EXISTS idx_people_pending_self_signup_review
  ON people(church_id)
  WHERE self_registered AND staff_reviewed_at IS NULL;

COMMENT ON COLUMN people.self_registered IS
  'True when clerk_user_id was bound via member self-signup (api/portal/_self-signup.ts), not staff provisioning.';
COMMENT ON COLUMN people.staff_reviewed_at IS
  'Set when staff confirms a self-registered identity. NULL = pending review; gates the sensitive-data tools/routes via actor.identityVerified.';
