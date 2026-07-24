-- GRACE — Realtime queue updates + staff notification preferences
-- Migration: 051_realtime_notifications.sql
--
-- Three additions:
--   1. Enables Supabase Realtime on platform_events so the Decision
--      Queue can subscribe to postgres_changes INSERTs. Safe to expose:
--      platform_events already has a SELECT-only RLS policy scoped to
--      church_id = get_church_id() (migration 036), which Realtime's
--      postgres_changes respects — a session only ever receives change
--      events for its own church.
--   2. staff_notification_prefs — self-scoped category x channel
--      toggles, read/written by api/workos/_notification-prefs.ts.
--   3. notification_cursors — service-role-only progress marker for the
--      digest cron (api/cron/_notify.ts). RLS is enabled with no policy:
--      the service-role key bypasses RLS entirely, and no other role
--      should ever read or write this table.
--   4. users.phone — nullable, staff-entered. Needed so the crisis SMS
--      path (api/portal/_care.ts) has a real phone number to check
--      against, rather than plumbing that can structurally never fire
--      (the users table previously had no phone column at all).
--
-- Idempotent throughout.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'platform_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE platform_events;
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE TABLE IF NOT EXISTS staff_notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  user_id UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN
    ('crisis','approvals','finance','agents','digest')),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, channel)
);

CREATE INDEX IF NOT EXISTS idx_staff_notification_prefs_user
  ON staff_notification_prefs(user_id);

CREATE TABLE IF NOT EXISTS notification_cursors (
  job TEXT PRIMARY KEY,
  last_event_created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE staff_notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON staff_notification_prefs;
CREATE POLICY "tenant_isolation" ON staff_notification_prefs FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- notification_cursors: no policy — RLS-enabled with zero policies means
-- every role except the service key (which bypasses RLS) is denied by
-- default. That is the intended posture, not an oversight.

COMMENT ON TABLE staff_notification_prefs IS
  'Self-scoped per-user notification preferences (category x channel), read/written only by the acting user via api/workos/_notification-prefs.ts.';
COMMENT ON TABLE notification_cursors IS
  'Service-role-only progress marker for the digest cron (api/cron/_notify.ts) — intentionally has no RLS policy.';
