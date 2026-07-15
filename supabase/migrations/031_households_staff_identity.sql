-- GRACE — Shared platform foundation, Part 1: identity (households, staff profiles, account status)
-- Migration: 031_households_staff_identity.sql
--
-- Adds the identity primitives the Admin Dashboard, Members Portal, and
-- WorkOS agent layer will all share:
--   1. households / household_members — relationship model between people,
--      reused by directory, giving statements, and care routing.
--   2. staff_profiles — the staff-side counterpart to a `people` row; a
--      `users` row is "who can log in", `staff_profiles` is "what they do."
--   3. users.account_status — session/account lifecycle, enforced in
--      api/_lib/authz.ts on every authenticated request (deactivated or
--      suspended users are rejected even with a valid Clerk token).
--
-- Reuses existing `churches` (tenant root) and `people`/`users` (identity)
-- rather than introducing a parallel `organizations`/`members` table set —
-- see DECISIONS.md ADR-002. Idempotent throughout.

-- ============================================
-- 1. households
-- ============================================

CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'member'
    CHECK (relationship IN ('head', 'spouse', 'child', 'dependent', 'other', 'member')),
  is_primary_contact BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, person_id)
);

-- people.household_id is additive and does not replace the pre-existing,
-- unused `family_id` column from 001_initial_schema.sql (no FK was ever
-- attached to family_id; leaving it alone rather than risk a silent data
-- migration — see TECH_DEBT.md for the follow-up to reconcile the two).
ALTER TABLE people ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_households_church_id ON households(church_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_person ON household_members(person_id);
CREATE INDEX IF NOT EXISTS idx_people_household_id ON people(household_id);

DROP TRIGGER IF EXISTS set_updated_at ON households;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. staff_profiles
-- ============================================

CREATE TABLE IF NOT EXISTS staff_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  department TEXT,
  ministry TEXT,
  employment_type TEXT DEFAULT 'staff'
    CHECK (employment_type IN ('staff', 'clergy', 'volunteer', 'contractor')),
  hire_date DATE,
  phone TEXT,
  phone_extension TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_church_id ON staff_profiles(church_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_ministry ON staff_profiles(church_id, ministry);

DROP TRIGGER IF EXISTS set_updated_at ON staff_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. users: account lifecycle
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'invited', 'suspended', 'deactivated'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(church_id, account_status);

COMMENT ON COLUMN users.account_status IS
  'Session/account lifecycle. Enforced server-side in api/_lib/authz.ts (resolveActor) on every authenticated request — a valid Clerk token from a non-active account is rejected with 403, independent of RLS.';

-- ============================================
-- 4. RLS
-- ============================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON households;
CREATE POLICY "tenant_isolation" ON households FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON household_members;
CREATE POLICY "tenant_isolation" ON household_members FOR ALL
  USING (EXISTS (SELECT 1 FROM households h WHERE h.id = household_members.household_id AND h.church_id = public.get_church_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM households h WHERE h.id = household_members.household_id AND h.church_id = public.get_church_id()));

DROP POLICY IF EXISTS "tenant_isolation" ON staff_profiles;
CREATE POLICY "tenant_isolation" ON staff_profiles FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE households IS 'Household grouping for people records. Shared by directory, care routing, and giving statements.';
COMMENT ON TABLE staff_profiles IS 'Staff-side detail record for a users row (title, ministry, employment type). Distinct from people, which models congregants.';
