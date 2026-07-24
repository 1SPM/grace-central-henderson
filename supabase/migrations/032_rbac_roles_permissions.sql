-- GRACE — Shared platform foundation, Part 2: RBAC
-- Migration: 032_rbac_roles_permissions.sql
--
-- Server-enforced role-based access control, independent of any hidden-UI
-- authorization. This is the schema half of the model; the enforcement
-- half lives in api/_lib/authz.ts (resolveActor / requirePermission),
-- which is the PRIMARY control today — see the RLS caveat in migration 038.
--
-- Design:
--   roles            — the 13 roles named in the WorkOS spec, seeded as
--                       system roles (church_id NULL = template available
--                       to every tenant). A church can add custom roles
--                       later (church_id set) without a schema change.
--   permissions       — a catalog of (module, action) pairs with a
--                       sensitivity tag. Key format: "<module>.<action>".
--   role_permissions  — grants, with an optional JSONB `scope` for
--                       ministry-scoped or record-scoped narrowing
--                       (e.g. {"ministry_scoped": true}).
--   user_roles        — assigns a role to a user within a church, with an
--                       optional `ministry` column for field-level scoping
--                       (e.g. a Ministry Leader role granted only for
--                       "Youth"). Supports multiple roles per user.
--
-- Idempotent throughout.

-- ============================================
-- 1. roles
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE, -- NULL = system role template
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One key per church; system templates share the key across churches
-- (church_id IS NULL rows are the templates, not per-church rows).
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_church_key
  ON roles (COALESCE(church_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

DROP TRIGGER IF EXISTS set_updated_at ON roles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. permissions
-- ============================================

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE, -- "<module>.<action>"
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'internal'
    CHECK (sensitivity IN ('public', 'internal', 'restricted', 'confidential')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- ============================================
-- 3. role_permissions
-- ============================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope JSONB NOT NULL DEFAULT '{}', -- e.g. {"ministry_scoped": true}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================
-- 4. user_roles
-- ============================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  ministry TEXT, -- narrows a ministry-scoped role grant (e.g. "Youth"); NULL = unscoped
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_active
  ON user_roles(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_church ON user_roles(church_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ============================================
-- 5. Permission-check helper
-- ============================================

-- Used by RLS policies (migration 038) AND mirrored in api/_lib/authz.ts for
-- the primary server-side check (the app resolves permissions via a direct
-- query rather than depending on this being callable through PostgREST,
-- since the anon/authenticated Supabase client path is not yet fully wired
-- to Clerk — see DECISIONS.md ADR-003 and TECH_DEBT.md TD-001).
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id UUID, p_church_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND ur.church_id = p_church_id
      AND ur.revoked_at IS NULL
      AND p.key = p_permission_key
  );
$$;

COMMENT ON FUNCTION public.user_has_permission IS
  'Church-scoped permission check. Mirrored in api/_lib/authz.ts (loadActorPermissions) which is the primary enforcement path today; this function backs RLS defense-in-depth (migration 038) and is available for direct SQL/report use.';

-- ============================================
-- 6. RLS
-- ============================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- roles: readable if it's a system template or belongs to the caller's church.
DROP POLICY IF EXISTS "roles read" ON roles;
CREATE POLICY "roles read" ON roles FOR SELECT
  USING (church_id IS NULL OR church_id = public.get_church_id());

-- permissions catalog is global reference data — readable by any
-- authenticated caller (no PII, defines nothing on its own).
DROP POLICY IF EXISTS "permissions read" ON permissions;
CREATE POLICY "permissions read" ON permissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "role_permissions read" ON role_permissions;
CREATE POLICY "role_permissions read" ON role_permissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id
            AND (r.church_id IS NULL OR r.church_id = public.get_church_id()))
  );

DROP POLICY IF EXISTS "tenant_isolation" ON user_roles;
CREATE POLICY "tenant_isolation" ON user_roles FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());
-- No policy grants INSERT/UPDATE/DELETE to anon/authenticated beyond the
-- tenant_isolation ALL policy above; in practice role grants are written
-- by the service role from api/_routes (admin.manage_roles permission
-- gate), matching the pattern used for people/tasks elsewhere in the app.

-- ============================================
-- 7. Seed: 13 system roles
-- ============================================

INSERT INTO roles (church_id, key, name, description, is_system) VALUES
  (NULL, 'system_administrator',  'System Administrator',    'Full platform access across all modules. Grants and revokes roles.', true),
  (NULL, 'executive_leadership',  'Executive Leadership',    'Cross-ministry visibility and approval authority; not a finance or care operator.', true),
  (NULL, 'senior_pastor',         'Senior Pastor',           'Full pastoral and congregational oversight; approves Work Orders.', true),
  (NULL, 'ministry_leader',       'Ministry Leader',         'Manages people, groups, and events within an assigned ministry.', true),
  (NULL, 'pastoral_care',         'Pastoral Care',           'Access to care requests and pastoral records; confidential-tier module.', true),
  (NULL, 'member_services',       'Member Services',         'Manages people, households, and member consent on members'' behalf.', true),
  (NULL, 'communications',        'Communications',          'Manages messaging and outbound communications; no pastoral or financial access.', true),
  (NULL, 'volunteer_coordinator', 'Volunteer Coordinator',   'Manages volunteer interest intake and placement.', true),
  (NULL, 'finance',               'Finance',                 'Giving and financial-ledger access; no care-record access.', true),
  (NULL, 'impact_card_operations','Impact Card Operations',  'Manages Impact Card / neobank operational data.', true),
  (NULL, 'analyst',               'Analyst',                 'Read-only analytics access across non-confidential modules.', true),
  (NULL, 'auditor',               'Auditor',                 'Read-only access to audit trail, Work Orders, and approvals. Never a manage/decide grant.', true),
  (NULL, 'member_portal_user',    'Member Portal User',      'Self-service member: own profile, own consent, own portal activity only.', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. Seed: permission catalog
-- ============================================

INSERT INTO permissions (key, module, action, sensitivity, description) VALUES
  ('people.view',            'people',           'view',    'internal',     'View congregant directory records'),
  ('people.manage',          'people',           'manage',  'internal',     'Create/update congregant records'),
  ('people.export',          'people',           'export',  'restricted',   'Export congregant data'),
  ('households.view',        'households',       'view',    'internal',     'View household groupings'),
  ('households.manage',      'households',       'manage',  'internal',     'Create/update household groupings'),
  ('groups.view',            'groups',           'view',    'public',       'View small groups'),
  ('groups.manage',          'groups',           'manage',  'internal',     'Manage small groups and memberships'),
  ('events.view',            'events',           'view',    'public',       'View calendar events'),
  ('events.manage',          'events',           'manage',  'internal',     'Manage calendar events'),
  ('giving_financial.view',  'giving_financial', 'view',    'restricted',   'View giving and ledger records'),
  ('giving_financial.manage','giving_financial', 'manage',  'restricted',   'Record/adjust giving and ledger entries'),
  ('giving_financial.export','giving_financial', 'export',  'restricted',   'Export financial data'),
  ('care.view',              'care',             'view',    'confidential', 'View pastoral care requests and notes'),
  ('care.manage',            'care',             'manage',  'confidential', 'Manage/assign pastoral care requests'),
  ('communications.view',    'communications',   'view',    'internal',     'View communication campaigns/history'),
  ('communications.manage',  'communications',   'manage',  'internal',     'Create/edit communication campaigns'),
  ('communications.send',    'communications',   'send',    'internal',     'Send email/SMS communications'),
  ('volunteer.view',         'volunteer',        'view',    'internal',     'View volunteer interest submissions'),
  ('volunteer.manage',       'volunteer',        'manage',  'internal',     'Triage and place volunteer interest submissions'),
  ('impact_card.view',       'impact_card',      'view',    'restricted',   'View Impact Card / neobank data'),
  ('impact_card.manage',     'impact_card',      'manage',  'restricted',   'Manage Impact Card / neobank operations'),
  ('work_orders.view',       'work_orders',      'view',    'internal',     'View Work Orders'),
  ('work_orders.manage',     'work_orders',      'manage',  'internal',     'Create/update Work Orders and tasks'),
  ('work_orders.approve',    'work_orders',      'approve', 'internal',     'Move a Work Order through Awaiting Approval'),
  ('approvals.view',         'approvals',        'view',    'internal',     'View approval requests'),
  ('approvals.decide',       'approvals',        'decide',  'internal',     'Decide (approve/reject/escalate) an approval request'),
  ('audit.view',             'audit',            'view',    'restricted',   'View the audit trail and platform event log'),
  ('analytics.view',         'analytics',        'view',    'internal',     'View aggregate analytics and metric definitions'),
  ('admin.manage_roles',     'admin',            'manage',  'restricted',   'Assign/revoke roles and permissions'),
  ('admin.manage_settings',  'admin',            'manage',  'restricted',   'Manage church/tenant settings'),
  ('consent.view',           'consent',          'view',    'internal',     'View member consent and communication preferences'),
  ('consent.manage',         'consent',          'manage',  'internal',     'Update consent/preferences on a member''s behalf'),
  ('consent.manage_own',     'consent',          'manage',  'public',       'Update the caller''s own consent and preferences'),
  ('portal.self_service',    'portal',           'view',    'public',       'Baseline member-portal self-service access (own profile, own activity)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 9. Seed: default role → permission grants
-- ============================================

-- system_administrator: everything.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key = 'system_administrator' AND r.church_id IS NULL
ON CONFLICT DO NOTHING;

-- Helper macro pattern: grant a role a list of permission keys.
DO $$
DECLARE
  grants JSONB := '{
    "executive_leadership": ["people.view","households.view","groups.view","groups.manage","events.view","events.manage","communications.view","volunteer.view","work_orders.view","work_orders.approve","approvals.view","approvals.decide","analytics.view","audit.view","giving_financial.view","impact_card.view"],
    "senior_pastor": ["people.view","people.manage","households.view","households.manage","groups.view","groups.manage","events.view","events.manage","care.view","care.manage","communications.view","communications.manage","volunteer.view","work_orders.view","work_orders.manage","work_orders.approve","approvals.view","approvals.decide","analytics.view","consent.view"],
    "ministry_leader": ["people.view","groups.view","groups.manage","events.view","events.manage","volunteer.view","volunteer.manage","work_orders.view","work_orders.manage","communications.view"],
    "pastoral_care": ["people.view","care.view","care.manage","communications.view","work_orders.view","consent.view"],
    "member_services": ["people.view","people.manage","households.view","households.manage","groups.view","events.view","communications.view","consent.view","consent.manage","work_orders.view"],
    "communications": ["communications.view","communications.manage","communications.send","people.view","groups.view","events.view","work_orders.view"],
    "volunteer_coordinator": ["volunteer.view","volunteer.manage","people.view","groups.view","events.view","work_orders.view"],
    "finance": ["giving_financial.view","giving_financial.manage","giving_financial.export","people.view","work_orders.view"],
    "impact_card_operations": ["impact_card.view","impact_card.manage","people.view","work_orders.view"],
    "analyst": ["analytics.view","people.view","groups.view","events.view","giving_financial.view"],
    "auditor": ["audit.view","work_orders.view","approvals.view","analytics.view","consent.view"],
    "member_portal_user": ["consent.manage_own","portal.self_service"]
  }'::jsonb;
  role_key TEXT;
  perm_key TEXT;
BEGIN
  FOR role_key IN SELECT jsonb_object_keys(grants) LOOP
    FOR perm_key IN SELECT jsonb_array_elements_text(grants -> role_key) LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.key = role_key AND r.church_id IS NULL AND p.key = perm_key
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON TABLE roles IS 'System-template (church_id NULL) and per-church custom roles. See TECH_DEBT.md for the custom-role admin UI gap.';
COMMENT ON TABLE user_roles IS 'Assigns a role to a user within a church, optionally scoped to a ministry. Multiple active rows per user are additive (union of permissions).';
