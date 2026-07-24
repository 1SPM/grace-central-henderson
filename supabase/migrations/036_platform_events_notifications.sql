-- GRACE — Shared platform foundation, Part 6: platform events + notifications
-- Migration: 036_platform_events_notifications.sql
--
-- Two distinct concerns that are easy to conflate:
--
--   audit_logs (existing, migration 010) — the SECURITY/COMPLIANCE trail.
--     Extended here (not duplicated — see WORKOS spec's "audit_events"
--     entity, which this table already satisfies in shape) with
--     source_app, reason, and correlation_id so it also carries the fields
--     the WorkOS spec asks for. Append-only, restricted read, service-role
--     write only — unchanged posture.
--
--   platform_events (new) — the DOMAIN/BUSINESS event stream WorkOS
--     workflows subscribe to (member.profile.updated, care.request.submitted,
--     work_order.completed, ...). Not security-sensitive by default, higher
--     volume, meant to be queried/replayed by the agent layer WITHOUT
--     giving agents direct table access to people/giving/care_requests —
--     see api/_lib/platformEvents.ts.
--
-- notifications — outbound notices to a user or person, optionally tied to
-- the platform_event that triggered them.
--
-- Idempotent throughout.

-- ============================================
-- 1. audit_logs: extend for WorkOS parity
-- ============================================

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS source_app TEXT
  CHECK (source_app IN ('admin_dashboard', 'member_portal', 'workos', 'system', 'webhook'));
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;

COMMENT ON COLUMN audit_logs.source_app IS 'Which surface originated the action: admin_dashboard, member_portal, workos (agent-originated), system (cron/internal), or webhook.';
COMMENT ON COLUMN audit_logs.correlation_id IS 'Ties together audit rows and platform_events that belong to the same logical operation (e.g. one Work Order approval flow).';

-- ============================================
-- 2. platform_events
-- ============================================

CREATE TABLE IF NOT EXISTS platform_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source_app TEXT NOT NULL DEFAULT 'system'
    CHECK (source_app IN ('admin_dashboard', 'member_portal', 'workos', 'system', 'webhook')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  subject_type TEXT,
  subject_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  correlation_id UUID NOT NULL DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_church_type ON platform_events(church_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_subject ON platform_events(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_correlation ON platform_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_created_at ON platform_events(church_id, created_at DESC);

-- Append-only, same defense-in-depth pattern as audit_logs.
CREATE OR REPLACE FUNCTION public.platform_events_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'platform_events is append-only; UPDATE/DELETE are not permitted (op=%)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_platform_events_no_update ON platform_events;
CREATE TRIGGER trig_platform_events_no_update
  BEFORE UPDATE OR DELETE ON platform_events
  FOR EACH ROW EXECUTE FUNCTION public.platform_events_block_mutation();

-- ============================================
-- 3. notifications
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  title TEXT NOT NULL,
  body TEXT,
  related_event_id UUID REFERENCES platform_events(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (recipient_user_id IS NOT NULL OR recipient_person_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user ON notifications(recipient_user_id, status) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_person ON notifications(recipient_person_id, status) WHERE recipient_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_church ON notifications(church_id, created_at DESC);

-- ============================================
-- 4. RLS
-- ============================================

ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- platform_events: same posture as audit_logs — church-scoped read, no
-- direct insert/update/delete policy (service role / API only writes).
DROP POLICY IF EXISTS "platform_events read own church" ON platform_events;
CREATE POLICY "platform_events read own church" ON platform_events FOR SELECT
  USING (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON notifications;
CREATE POLICY "tenant_isolation" ON notifications FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "member self access" ON notifications;
CREATE POLICY "member self access" ON notifications FOR ALL
  USING (recipient_person_id = public.get_person_id())
  WITH CHECK (recipient_person_id = public.get_person_id());

COMMENT ON TABLE platform_events IS
  'Append-only domain-event stream (member.profile.updated, work_order.completed, ...). Written exclusively by api/_lib/platformEvents.ts. Read by WorkOS workflows and the admin activity feed — never grants agents direct table access.';
COMMENT ON TABLE notifications IS
  'Outbound notice to a staff user or member, optionally correlated to the platform_event that triggered it.';
