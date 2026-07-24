-- GRACE — Shared platform foundation, Part 4: Work Orders
-- Migration: 034_work_orders.sql
--
-- The backend model for WorkOS units of work: a work_order is the
-- top-level unit (staff- or agent-initiated), work_order_tasks are its
-- checklist items, work_order_dependencies model ordering between whole
-- Work Orders, and work_order_evidence attaches proof of completion
-- (files, links, notes, validation results) for the approval/audit trail.
--
-- Idempotent throughout.

-- ============================================
-- 1. work_orders
-- ============================================

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'planning', 'awaiting_approval', 'in_progress',
    'blocked', 'under_review', 'completed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ministry TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'internal'
    CHECK (sensitivity IN ('public', 'internal', 'restricted', 'confidential')),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_agent TEXT, -- set instead of requested_by_user_id for agent-originated Work Orders
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  deliverable_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requested_by_user_id IS NOT NULL OR requested_by_agent IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_work_orders_church_status ON work_orders(church_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_owner ON work_orders(owner_user_id) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_work_orders_due_date ON work_orders(church_id, due_date) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_work_orders_ministry ON work_orders(church_id, ministry);

DROP TRIGGER IF EXISTS set_updated_at ON work_orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. work_order_tasks
-- ============================================

CREATE TABLE IF NOT EXISTS work_order_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'blocked', 'completed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_tasks_work_order ON work_order_tasks(work_order_id, position);
CREATE INDEX IF NOT EXISTS idx_wo_tasks_owner ON work_order_tasks(owner_user_id) WHERE status NOT IN ('completed', 'cancelled');

DROP TRIGGER IF EXISTS set_updated_at ON work_order_tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON work_order_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. work_order_dependencies
-- ============================================

CREATE TABLE IF NOT EXISTS work_order_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  depends_on_work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'relates_to')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (work_order_id <> depends_on_work_order_id),
  UNIQUE (work_order_id, depends_on_work_order_id)
);

CREATE INDEX IF NOT EXISTS idx_wo_deps_work_order ON work_order_dependencies(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_deps_depends_on ON work_order_dependencies(depends_on_work_order_id);

-- ============================================
-- 4. work_order_evidence
-- ============================================

CREATE TABLE IF NOT EXISTS work_order_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  task_id UUID REFERENCES work_order_tasks(id) ON DELETE SET NULL,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'link', 'note', 'validation_result')),
  url TEXT,
  content TEXT,
  submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_by_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (submitted_by_user_id IS NOT NULL OR submitted_by_agent IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_wo_evidence_work_order ON work_order_evidence(work_order_id);

-- ============================================
-- 5. RLS
-- ============================================

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_evidence ENABLE ROW LEVEL SECURITY;

-- Structural note: Work Orders are staff/agent-only by product requirement
-- ("portal users must never access internal Work Orders"). RLS here is
-- tenant-only (church_id); the member_portal_user role is never granted
-- work_orders.view/manage in migration 032, and the API layer
-- (api/_routes/work-orders.ts) is the primary enforcement of that boundary
-- since the Members Portal has no Supabase session today (it calls the
-- API, not Supabase, directly — see ARCHITECTURE.md §5).
DROP POLICY IF EXISTS "tenant_isolation" ON work_orders;
CREATE POLICY "tenant_isolation" ON work_orders FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON work_order_tasks;
CREATE POLICY "tenant_isolation" ON work_order_tasks FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON work_order_evidence;
CREATE POLICY "tenant_isolation" ON work_order_evidence FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

DROP POLICY IF EXISTS "tenant_isolation" ON work_order_dependencies;
CREATE POLICY "tenant_isolation" ON work_order_dependencies FOR ALL
  USING (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_dependencies.work_order_id AND wo.church_id = public.get_church_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_dependencies.work_order_id AND wo.church_id = public.get_church_id())
  );

COMMENT ON TABLE work_orders IS 'Top-level WorkOS unit of work. States per WORKOS spec: draft/planning/awaiting_approval/in_progress/blocked/under_review/completed/cancelled.';
COMMENT ON TABLE work_order_evidence IS 'Proof of task/Work-Order completion: files, links, notes, or a validation_result row referencing the validations table.';
