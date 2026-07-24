-- GRACE — public demo read access for the Faithful demo tenant
-- Migration: 053_demo_tenant_anon_read.sql
--
-- WHY: the classic CRM (People, Giving, Calendar, Care, Prayer, etc.)
-- reads Supabase directly from the browser with the anon key and relies
-- on a Clerk JWT to satisfy the church-scoped `tenant_isolation` RLS
-- (church_id = get_church_id()). The public demo URL has no Clerk
-- session, so get_church_id() is NULL and every classic-CRM screen
-- rendered EMPTY — even though the Faithful demo tenant is fully
-- populated. Only the server-actor endpoints (WorkOS, portal) showed
-- data, because they resolve a demo actor with the service key.
--
-- The original design (see src/lib/supabase.ts and migration 005)
-- assumed permissive anon reads; the correct production RLS hardening
-- in 011/038 closed that path without a demo carve-out. This migration
-- restores the demo — and ONLY the demo — by granting anon SELECT on
-- the Faithful demo tenant's rows.
--
-- SAFETY:
--   * Read-only, `anon` role only, additive to `tenant_isolation`.
--   * Hardcoded to the Faithful demo church_id. Central Henderson
--     (11111111-...) and every real client are NOT in this policy and
--     stay fully isolated — a real tenant can never be exposed here.
--   * The Faithful tenant contains only fabricated demo personas
--     (all @example.com), no real PII. Verified before applying.
--
-- SCOPE: the church_id-scoped tables the browser reads directly for
-- display. Person/join-scoped link tables (group_memberships,
-- household_members, community_comments/reactions, member_connections)
-- use a different RLS predicate and are intentionally NOT included here
-- — the core directory/giving/calendar/care/prayer lists populate; a
-- follow-up can extend to the join tables if relationship depth is
-- needed in the demo.
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE.

DO $$
DECLARE
  demo_church CONSTANT uuid := '22222222-2222-2222-2222-222222222222';
  t text;
  demo_tables text[] := ARRAY[
    'people','households','small_groups','calendar_events','event_rsvps',
    'attendance','tasks','interactions','prayer_requests','discipleship_milestones',
    'announcements','giving','recurring_giving','pledges','donation_batches',
    'giving_statements','member_activity_events','community_posts','campaigns',
    'volunteer_interests','care_requests','staff_profiles','users'
  ];
BEGIN
  FOREACH t IN ARRAY demo_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_anon_read ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY demo_anon_read ON public.%I FOR SELECT TO anon USING (church_id = %L)',
      t, demo_church
    );
  END LOOP;
END $$;
