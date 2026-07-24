-- GRACE — Shared platform foundation, Part 3: consent & preferences
-- Migration: 033_consent_communication_preferences.sql
--
-- Member-controlled consent is a first-class, per-type record (not a single
-- boolean) so each consent type has its own grant/withdraw timestamp and
-- audit trail. `communication_preferences` is the derived, denormalized
-- read-model consumed by the messaging pipeline (scheduled_messages,
-- drip_campaigns) for a fast single-row lookup per person.
--
-- Idempotent throughout.

-- ============================================
-- 1. consents
-- ============================================

CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'email',
    'sms',
    'push_notification',
    'pastoral_contact',
    'directory_visibility',
    'photograph',
    'group_visibility',
    'prayer_request_visibility',
    'volunteer_communications',
    'impact_card_communications'
  )),
  status TEXT NOT NULL DEFAULT 'denied' CHECK (status IN ('granted', 'denied', 'withdrawn')),
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'staff', 'import', 'agent')),
  recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_consents_church_id ON consents(church_id);
CREATE INDEX IF NOT EXISTS idx_consents_person_id ON consents(person_id);

DROP TRIGGER IF EXISTS set_updated_at ON consents;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON consents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. communication_preferences (denormalized read-model)
-- ============================================

CREATE TABLE IF NOT EXISTS communication_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  preferred_channel TEXT DEFAULT 'email' CHECK (preferred_channel IN ('email', 'sms', 'push', 'none')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  topics JSONB NOT NULL DEFAULT '{}', -- e.g. {"events": true, "giving_reminders": false}
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_prefs_church_id ON communication_preferences(church_id);

DROP TRIGGER IF EXISTS set_updated_at ON communication_preferences;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON communication_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. data_subject_requests (export / deactivation)
-- ============================================

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('data_export', 'account_deactivation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'denied')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsr_church_status ON data_subject_requests(church_id, status);
CREATE INDEX IF NOT EXISTS idx_dsr_person ON data_subject_requests(person_id);

-- ============================================
-- 4. Member self-access helper
-- ============================================

-- Mirrors public.get_church_id() (migration 005/011): pulls the caller's
-- Clerk subject from auth.jwt() and resolves it to a people.id via the
-- clerk_user_id linkage established in migration 016. Returns NULL (and
-- therefore denies by default) when the JWT is missing, unlinked, or the
-- Clerk↔Supabase JWT trust described in TECH_DEBT.md TD-001 isn't wired
-- yet — same fail-closed posture as get_church_id().
CREATE OR REPLACE FUNCTION public.get_person_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.people
  WHERE clerk_user_id = (auth.jwt() ->> 'sub')
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_person_id() IS
  'Resolves the calling Clerk user to their people.id for member-self-access RLS policies. NULL when unresolved (fail-closed).';

-- ============================================
-- 5. RLS
-- ============================================

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;

-- Staff: church-scoped access (server-side permission gate — consent.view /
-- consent.manage — is the primary control; see api/_routes/consents.ts).
DROP POLICY IF EXISTS "tenant_isolation" ON consents;
CREATE POLICY "tenant_isolation" ON consents FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- Member self-access: a member may read/write only their own consent rows,
-- resolved via public.get_person_id() (defined above).
DROP POLICY IF EXISTS "member self access" ON consents;
CREATE POLICY "member self access" ON consents FOR ALL
  USING (person_id = public.get_person_id())
  WITH CHECK (person_id = public.get_person_id());

DROP POLICY IF EXISTS "tenant_isolation" ON communication_preferences;
CREATE POLICY "tenant_isolation" ON communication_preferences FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "member self access" ON communication_preferences;
CREATE POLICY "member self access" ON communication_preferences FOR ALL
  USING (person_id = public.get_person_id())
  WITH CHECK (person_id = public.get_person_id());

DROP POLICY IF EXISTS "tenant_isolation" ON data_subject_requests;
CREATE POLICY "tenant_isolation" ON data_subject_requests FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "member self access" ON data_subject_requests;
CREATE POLICY "member self access" ON data_subject_requests FOR ALL
  USING (person_id = public.get_person_id())
  WITH CHECK (person_id = public.get_person_id());

COMMENT ON TABLE consents IS
  'Per-type, per-person consent record. One row per (person_id, consent_type); status changes are also written to audit_events (consent.changed) by api/_routes/consents.ts, not tracked via history rows here.';
COMMENT ON TABLE communication_preferences IS
  'Denormalized read-model derived from consents (email/sms/push) plus channel/topic preferences. Kept in sync by api/_routes/consents.ts on every consent write.';
