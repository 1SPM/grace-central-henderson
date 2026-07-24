-- GRACE — Shared platform foundation, Part 5: approvals + agent platform
-- Migration: 035_approvals_agent_platform.sql
--
-- approvals    — a human-in-the-loop gate on any proposed action (a Work
--                Order transition, an agent action, or a standalone
--                request). This is how WorkOS agents get "minimum required
--                data + no unrestricted database access": an agent
--                proposes, a permitted human decides.
-- agent_runs   — one row per agent execution (mirrors the existing
--                agent_executions table's intent but is WorkOS-scoped and
--                linkable to a work_order; agent_executions/agent_logs/
--                agent_stats from migration 004 remain as-is for the
--                existing Ask-Grace-adjacent agents — see ARCHITECTURE.md
--                §8 — this is not a rename, it is the new WorkOS lane).
-- agent_actions— an individual write an agent wants to make; if
--                requires_approval is true, execution is blocked until the
--                linked approvals row is decided 'approve' or
--                'approve_with_changes'.
-- validations  — pass/fail checks against a Work Order, task, or agent
--                action (either system-run or human-reviewed).
--
-- Idempotent throughout.

-- ============================================
-- 1. approvals
-- ============================================

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- e.g. 'work_order', 'agent_action', 'communication_campaign'
  entity_id TEXT,
  proposed_action TEXT NOT NULL,
  requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_agent TEXT,
  affected_resources JSONB NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  supporting_evidence JSONB NOT NULL DEFAULT '[]',
  approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT CHECK (decision IN ('approve', 'approve_with_changes', 'return_for_revision', 'reject', 'escalate')),
  decision_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'decided', 'expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requested_by_user_id IS NOT NULL OR requested_by_agent IS NOT NULL),
  CHECK ((status = 'decided') = (decision IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_approvals_church_status ON approvals(church_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_work_order ON approvals(work_order_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON approvals(approver_user_id) WHERE status = 'pending';

DROP TRIGGER IF EXISTS set_updated_at ON approvals;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. agent_runs
-- ============================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  agent_key TEXT NOT NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_church ON agent_runs(church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_work_order ON agent_runs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_key ON agent_runs(church_id, agent_key);

-- ============================================
-- 3. agent_actions
-- ============================================

CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- e.g. 'create_task', 'send_communication', 'update_person'
  target_entity_type TEXT,
  target_entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  approval_id UUID REFERENCES approvals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'executed', 'rejected', 'failed')),
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Structural gate: an action cannot be marked executed unless it either
  -- didn't require approval, or its linked approval was decided favorably.
  -- (Full enforcement of "favorably" lives in api/_lib/authz.ts /
  -- work-order-service, since that requires reading the approvals row's
  -- decision value — a CHECK constraint can't join another table. This
  -- constraint blocks the structurally-impossible case: executed with no
  -- approval link at all when one was required.)
  CHECK (NOT (status = 'executed' AND requires_approval AND approval_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_run ON agent_actions(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_approval ON agent_actions(approval_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions(church_id, status);

-- ============================================
-- 4. validations
-- ============================================

CREATE TABLE IF NOT EXISTS validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  agent_action_id UUID REFERENCES agent_actions(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL, -- e.g. 'schema_check', 'policy_check', 'human_review'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed')),
  details JSONB NOT NULL DEFAULT '{}',
  validated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_by_system TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (work_order_id IS NOT NULL OR agent_action_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_validations_work_order ON validations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_validations_agent_action ON validations(agent_action_id);

-- ============================================
-- 5. RLS
-- ============================================

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON approvals;
CREATE POLICY "tenant_isolation" ON approvals FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON agent_runs;
CREATE POLICY "tenant_isolation" ON agent_runs FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON agent_actions;
CREATE POLICY "tenant_isolation" ON agent_actions FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON validations;
CREATE POLICY "tenant_isolation" ON validations FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE approvals IS 'Human-in-the-loop decision gate. Decisions: approve, approve_with_changes, return_for_revision, reject, escalate.';
COMMENT ON TABLE agent_actions IS 'A single proposed write from an agent run. Agents never write to product tables directly — api/_lib/agentPlatform.ts is the only writer, and it enforces the approval gate before dispatching to the target service.';
