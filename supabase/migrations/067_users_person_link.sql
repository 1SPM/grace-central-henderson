-- 067_users_person_link.sql
--
-- Links a staff login (users) to the person record that carries their
-- public-facing identity — bio, photo, Verified Leader stats
-- (src/config/*Leaders.ts, LeaderProfile.personId). Without this, "the
-- signed-in staff member" and "the verified leader shown on the roster /
-- campus" are two unconnected representations of the same human.
--
-- Nullable and SET NULL on delete: most staff rows are not also a public
-- leader profile, and a person being removed must not take their login
-- down with it — the two lifecycles are independent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_person_id ON users(person_id) WHERE person_id IS NOT NULL;

COMMENT ON COLUMN users.person_id IS
  'The people row carrying this staff member''s public identity (bio, photo, Verified Leader stats), when they have one. NULL for staff with no public leader profile.';
