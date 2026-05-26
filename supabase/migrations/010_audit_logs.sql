-- GRACE CRM — Audit log (Sprint 1)
-- Migration: 010_audit_logs.sql
--
-- Append-only audit trail for every state-changing action across the API.
-- Written by api/_middleware/audit.ts on every successful mutation.
--
-- RLS posture (per DECISIONS.md ADR-003):
--   - RLS enabled
--   - One SELECT policy: members of the church can read their own church's rows
--   - NO insert/update/delete policy → only the service role can write,
--     and UPDATE/DELETE are denied for everyone including service role
--     (server code must never edit history; reversals are new rows).
--
-- This unblocks TD-003 and SOC 2 evidence collection for "who changed what,
-- when, from where."
--
-- All statements idempotent (IF NOT EXISTS).

-- ============================================
-- TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id     UUID REFERENCES churches(id) ON DELETE SET NULL,

  -- WHO
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_clerk_id TEXT,                              -- preserved even if user row goes away
  actor_role    TEXT,                               -- snapshot of role at write time

  -- WHAT
  action        TEXT NOT NULL,                      -- e.g. 'create', 'update', 'delete', 'login', 'invite'
  entity_type   TEXT NOT NULL,                      -- e.g. 'person', 'task', 'giving'
  entity_id     TEXT,                               -- TEXT (not UUID) so we can record non-uuid ids too

  -- DIFFERENTIAL — null for create, both populated for update, before-only for delete
  before        JSONB,
  after         JSONB,

  -- WHERE / HOW
  route         TEXT,                               -- request path
  method        TEXT,                               -- HTTP verb
  ip_address    INET,                               -- request IP (server-trusted)
  user_agent    TEXT,
  request_id    TEXT,                               -- correlation id propagated from client

  -- WHEN
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_church_time      ON audit_logs(church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time       ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity           ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time      ON audit_logs(action, created_at DESC);

-- ============================================
-- ROW-LEVEL SECURITY
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Reads: members of the church can see their own church's audit trail.
-- This policy returns 0 rows until the Clerk→Supabase JWT integration is
-- live (today, auth.jwt() carries no church_id — see migration 005 comment).
-- Server code uses the service role for staff dashboards, which bypasses RLS.
DROP POLICY IF EXISTS "audit_logs read own church" ON audit_logs;
CREATE POLICY "audit_logs read own church"
  ON audit_logs
  FOR SELECT
  USING (church_id IS NOT NULL AND church_id = public.get_church_id());

-- No INSERT policy → only service role can write (auth/anon get nothing).
-- No UPDATE / DELETE policy → audit history is append-only by structural
-- design. The service role ALSO cannot edit because we ship no policy
-- allowing it. The only way to "correct" a row is to write a new one
-- referencing the old.

-- ============================================
-- DEFENSE IN DEPTH — trigger refuses UPDATE/DELETE even if a policy
-- is added by accident later.
-- ============================================

CREATE OR REPLACE FUNCTION public.audit_logs_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; UPDATE/DELETE are not permitted (op=%)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_audit_logs_no_update ON audit_logs;
CREATE TRIGGER trig_audit_logs_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_block_mutation();

COMMENT ON TABLE audit_logs IS
  'Append-only audit trail. Written by api/_middleware/audit.ts on every state-changing API call. RLS limits reads to own church; writes are service-role only; UPDATE/DELETE blocked by trigger.';
