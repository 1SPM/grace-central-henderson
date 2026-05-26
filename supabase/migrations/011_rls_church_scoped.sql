-- GRACE CRM — Church-scoped RLS policies (Sprint 1, Part 3)
-- Migration: 011_rls_church_scoped.sql
--
-- ⚠️  DO NOT APPLY UNTIL THE CLERK→SUPABASE INTEGRATION IS LIVE.
--
-- Applying this migration before Supabase third-party auth is configured to
-- trust Clerk will return ZERO ROWS to every client read across the entire
-- application — the policies require `auth.jwt() -> 'app_metadata' ->>
-- 'church_id'` to be non-null, and today it is null because the client uses
-- the anon key directly.
--
-- Prerequisite checklist (operator-driven, no automation):
--   1. Supabase Dashboard → Authentication → Third-Party Auth → add Clerk
--      provider (paste the Clerk Frontend API URL).
--   2. Clerk Dashboard → JWT Templates → New → name = "supabase". The
--      claims MUST include `app_metadata.church_id` for the current user.
--   3. Verify that AuthContext's Clerk token provider (registered via
--      src/lib/supabase.ts → setClerkTokenProvider) is returning tokens
--      whose decoded payload contains the church_id claim.
--   4. Run the cross-tenant smoke test (tools/lint-rls-cross-tenant.test.ts —
--      lands alongside this migration) against staging with two real
--      Clerk-issued tokens, confirm zero-row leakage.
--   5. THEN apply this migration to production.
--
-- The migration is idempotent — DROP IF EXISTS before CREATE — so you
-- can re-apply safely while iterating.

-- ============================================
-- Replace the permissive policies from 005 with church-scoped ones.
-- Tables that already have non-trivial policies (anchor_*, audit_logs)
-- are NOT touched here.
-- ============================================

-- ---- direct church_id column ----------------------------------------

-- churches: a member sees only their own church row.
DROP POLICY IF EXISTS "Service role full access" ON churches;
DROP POLICY IF EXISTS "churches read own"        ON churches;
CREATE POLICY "churches read own"
  ON churches FOR SELECT
  USING (id = public.get_church_id());

-- users: see members of your own church.
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "users in own church"      ON users;
CREATE POLICY "users in own church"
  ON users FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

-- One pattern, many tables. Macro via DO block for brevity + idempotence.
DO $$
DECLARE
  t TEXT;
  scoped_tables TEXT[] := ARRAY[
    'people',
    'small_groups',
    'interactions',
    'tasks',
    'prayer_requests',
    'calendar_events',
    'attendance',
    'giving',
    'leader_applications',
    'pastoral_sessions',
    'leader_availability',
    'scheduled_messages',
    'message_archive',
    'inbound_messages',
    'daily_digests',
    'drip_campaigns',
    'campaigns',
    'pledges',
    'donation_batches',
    'recurring_giving',
    'giving_statements',
    'agent_logs',
    'agent_stats',
    'agent_executions'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_isolation" ON %I FOR ALL '
      'USING (church_id = public.get_church_id()) '
      'WITH CHECK (church_id = public.get_church_id())',
      t
    );
  END LOOP;
END $$;

-- ---- FK-derived church_id (no direct column) ------------------------

-- group_memberships: scoped via small_groups.church_id
DROP POLICY IF EXISTS "Service role full access" ON group_memberships;
DROP POLICY IF EXISTS "tenant_isolation"         ON group_memberships;
CREATE POLICY "tenant_isolation"
  ON group_memberships FOR ALL
  USING (
    EXISTS (SELECT 1 FROM small_groups sg
            WHERE sg.id = group_memberships.group_id
              AND sg.church_id = public.get_church_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM small_groups sg
            WHERE sg.id = group_memberships.group_id
              AND sg.church_id = public.get_church_id())
  );

-- batch_items: scoped via donation_batches.church_id
DROP POLICY IF EXISTS "Service role full access" ON batch_items;
DROP POLICY IF EXISTS "tenant_isolation"         ON batch_items;
CREATE POLICY "tenant_isolation"
  ON batch_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM donation_batches db
            WHERE db.id = batch_items.batch_id
              AND db.church_id = public.get_church_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM donation_batches db
            WHERE db.id = batch_items.batch_id
              AND db.church_id = public.get_church_id())
  );

-- drip_campaign_steps: scoped via drip_campaigns.church_id
DROP POLICY IF EXISTS "Service role full access" ON drip_campaign_steps;
DROP POLICY IF EXISTS "tenant_isolation"         ON drip_campaign_steps;
CREATE POLICY "tenant_isolation"
  ON drip_campaign_steps FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drip_campaigns dc
            WHERE dc.id = drip_campaign_steps.campaign_id
              AND dc.church_id = public.get_church_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drip_campaigns dc
            WHERE dc.id = drip_campaign_steps.campaign_id
              AND dc.church_id = public.get_church_id())
  );

-- drip_campaign_enrollments: scoped via drip_campaigns.church_id
DROP POLICY IF EXISTS "Service role full access" ON drip_campaign_enrollments;
DROP POLICY IF EXISTS "tenant_isolation"         ON drip_campaign_enrollments;
CREATE POLICY "tenant_isolation"
  ON drip_campaign_enrollments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drip_campaigns dc
            WHERE dc.id = drip_campaign_enrollments.campaign_id
              AND dc.church_id = public.get_church_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drip_campaigns dc
            WHERE dc.id = drip_campaign_enrollments.campaign_id
              AND dc.church_id = public.get_church_id())
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.get_church_id() IS
  'Pulls church_id from auth.jwt() -> app_metadata. Returns NULL when JWT is missing or claim is absent — RLS policies that compare against it then deny by default. See migration 011.';
