-- GRACE — Shared platform foundation, Part 7: care requests, volunteer
-- interests, artifacts, metric definitions
-- Migration: 037_care_volunteer_artifacts_metrics.sql
--
-- Entity-mapping note (per WORKOS spec "do not duplicate existing entities
-- unnecessarily"):
--   - groups              → existing `small_groups` / `group_memberships` (018/001). Not duplicated.
--   - events               → existing `calendar_events` (001). Not duplicated.
--   - event_registrations   → existing `event_rsvps` (018_portal_content.sql). Not duplicated.
--   - campaigns             → existing `campaigns` (003_ai_messaging_system.sql). Not duplicated.
--   - care_requests/        → NEW. Distinct from the existing `anchor_conversations`
--     care_assignments        (006/019), which model AI leader-avatar chat threads.
--                              care_requests is the structured WorkOS-facing intake
--                              record (submitted → triaged → assigned → resolved)
--                              that a Work Order or staff assignment can reference;
--                              it does not replace Anchor's conversational layer.
--
-- Idempotent throughout.

-- ============================================
-- 1. care_requests
-- ============================================

CREATE TABLE IF NOT EXISTS care_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  submitted_via TEXT NOT NULL DEFAULT 'portal' CHECK (submitted_via IN ('portal', 'staff', 'agent')),
  category TEXT CHECK (category IN (
    'marriage', 'addiction', 'grief', 'faith-questions', 'crisis',
    'financial', 'anxiety-depression', 'parenting', 'general'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'crisis')),
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'triaged', 'assigned', 'in_progress', 'resolved', 'closed'
  )),
  is_confidential BOOLEAN NOT NULL DEFAULT true,
  crisis_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_requests_church_status ON care_requests(church_id, status);
CREATE INDEX IF NOT EXISTS idx_care_requests_person ON care_requests(person_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_crisis ON care_requests(church_id) WHERE crisis_flagged;

DROP TRIGGER IF EXISTS set_updated_at ON care_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON care_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. care_assignments
-- ============================================

CREATE TABLE IF NOT EXISTS care_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_request_id UUID NOT NULL REFERENCES care_requests(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  assigned_to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role_in_case TEXT DEFAULT 'primary' CHECK (role_in_case IN ('primary', 'secondary', 'observer')),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'active', 'completed', 'reassigned')),
  notes TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_care_assignments_request ON care_assignments(care_request_id);
CREATE INDEX IF NOT EXISTS idx_care_assignments_assignee ON care_assignments(assigned_to_user_id) WHERE status IN ('assigned', 'active');

-- ============================================
-- 3. volunteer_interests
-- ============================================

CREATE TABLE IF NOT EXISTS volunteer_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  group_id UUID REFERENCES small_groups(id) ON DELETE SET NULL,
  event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'placed', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_interests_church_status ON volunteer_interests(church_id, status);
CREATE INDEX IF NOT EXISTS idx_volunteer_interests_person ON volunteer_interests(person_id);

DROP TRIGGER IF EXISTS set_updated_at ON volunteer_interests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON volunteer_interests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. artifacts
-- ============================================

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('document', 'report', 'export', 'media', 'dataset')),
  title TEXT NOT NULL,
  storage_url TEXT,
  checksum TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'internal'
    CHECK (sensitivity IN ('public', 'internal', 'restricted', 'confidential')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_church ON artifacts(church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_work_order ON artifacts(work_order_id);

-- ============================================
-- 5. metric_definitions
-- ============================================

CREATE TABLE IF NOT EXISTS metric_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE, -- NULL = platform-wide definition
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  calculation TEXT, -- human-readable formula/source-of-truth pointer, not executable SQL
  sensitivity TEXT NOT NULL DEFAULT 'internal'
    CHECK (sensitivity IN ('public', 'internal', 'restricted', 'confidential')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_definitions_church_key
  ON metric_definitions (COALESCE(church_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

-- ============================================
-- 6. RLS
-- ============================================

ALTER TABLE care_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;

-- care_requests / care_assignments: confidential-tier. Tenant isolation is
-- structural; "pastoral notes must not be exposed to unrelated staff" is
-- enforced by the care.view/care.manage permission gate in
-- api/_routes/care-requests.ts (only Pastoral Care, Senior Pastor, System
-- Administrator hold that permission — see migration 032 seed grants), NOT
-- by a broader staff-wide RLS read. A member may read/create their own.
DROP POLICY IF EXISTS "tenant_isolation" ON care_requests;
CREATE POLICY "tenant_isolation" ON care_requests FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "member self access" ON care_requests;
CREATE POLICY "member self access" ON care_requests FOR ALL
  USING (person_id = public.get_person_id())
  WITH CHECK (person_id = public.get_person_id());

DROP POLICY IF EXISTS "tenant_isolation" ON care_assignments;
CREATE POLICY "tenant_isolation" ON care_assignments FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON volunteer_interests;
CREATE POLICY "tenant_isolation" ON volunteer_interests FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "member self access" ON volunteer_interests;
CREATE POLICY "member self access" ON volunteer_interests FOR ALL
  USING (person_id = public.get_person_id())
  WITH CHECK (person_id = public.get_person_id());

DROP POLICY IF EXISTS "tenant_isolation" ON artifacts;
CREATE POLICY "tenant_isolation" ON artifacts FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "metric_definitions read" ON metric_definitions;
CREATE POLICY "metric_definitions read" ON metric_definitions FOR SELECT
  USING (church_id IS NULL OR church_id = public.get_church_id());

COMMENT ON TABLE care_requests IS 'Structured pastoral-care intake record. Distinct from anchor_conversations (AI leader-avatar chat) — see migration header.';
