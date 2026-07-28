-- GRACE CRM — RLS read/write policies for `campaigns`
-- Migration: 065_campaigns_rls.sql
--
-- `campaigns` had RLS ENABLED but only a single policy: the anon
-- `demo_anon_read` grant added for the Faithful demo tenant. With RLS on and
-- no policy covering the authenticated role, every signed-in staff user read
-- back ZERO campaigns and could not insert or update one — the table was
-- effectively write-only-by-service-role and invisible to the app.
--
-- That went unnoticed because nothing read the table: the Impact Campaigns UI
-- kept its campaigns in React state (useCollectionManagement). Wiring that
-- hook to Supabase makes the gap load-bearing, so the policies land first.
--
-- Mirrors the sibling `pledges` / `giving` policies exactly, so the whole
-- giving surface gates on one pair of permissions:
--   read  → giving_financial.view
--   write → giving_financial.manage
-- The existing anon demo-read policy is left untouched (permissive policies
-- are OR'd, so the demo tenant keeps working).

DROP POLICY IF EXISTS "campaigns read" ON campaigns;
CREATE POLICY "campaigns read" ON campaigns
  FOR SELECT
  USING (
    church_id = get_church_id()
    AND user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.view')
  );

DROP POLICY IF EXISTS "campaigns write" ON campaigns;
CREATE POLICY "campaigns write" ON campaigns
  FOR ALL
  USING (
    church_id = get_church_id()
    AND user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage')
  )
  WITH CHECK (
    church_id = get_church_id()
    AND user_has_permission(get_app_user_id(), get_church_id(), 'giving_financial.manage')
  );
