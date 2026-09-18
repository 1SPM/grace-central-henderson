-- GRACE — stop the Faithful demo's public anon read from exposing real people
-- Migration: 081_demo_anon_read_exclude_self_registered.sql
--
-- WHY: migration 053 granted the `anon` role SELECT across 23 tables in the
-- Faithful demo tenant so the classic CRM screens would populate on the public
-- demo URL. Its safety argument was explicit:
--
--     "The Faithful tenant contains only fabricated demo personas
--      (all @example.com), no real PII. Verified before applying."
--
-- That sentence is about to stop being true. The Discovery + Validation pilot
-- creates REAL workshop participants in this same tenant: they complete Clerk
-- sign-up, land in `people`, and generate activity. Under 053 as written, a
-- participant's name, email and activity become readable by anyone holding the
-- publishable anon key — which ships in the browser bundle of every page.
--
-- Migrations 056, 060 and 063 each deliberately preserved 053 ("demo_anon_read
-- is never dropped"), so this is the first migration to narrow it. It does not
-- drop the demo carve-out; it excludes real sign-ups from it.
--
-- HOW: `people.self_registered` (migration 078) already separates the two
-- populations exactly. It is NOT NULL DEFAULT false, so every seeded demo
-- persona is false, and `api/portal/_self-signup.ts` sets it true on every
-- account a real person creates. No new column, no backfill, no data change.
--
--   people                -> church_id = demo AND NOT self_registered
--   15 person-scoped tables -> same, resolved through their person column
--   7 non-person tables     -> unchanged (hold no participant PII)
--
-- Two properties worth knowing:
--   * The subquery reads `people`, so it is itself subject to `people`'s anon
--     policy above. If that policy is ever dropped, this FAILS CLOSED rather
--     than opening up.
--   * The subquery is uncorrelated, so the planner hashes it once per query
--     rather than per row. On a ~181-person demo tenant no new index is needed.
--
-- SAFETY: strictly narrowing, `anon` role only. Central Henderson
-- (11111111-...) and every real client were never in 053's policy and are
-- untouched. The worst failure mode is a demo screen showing fewer rows.
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE.

DO $$
DECLARE
  demo_church CONSTANT uuid := '22222222-2222-2222-2222-222222222222';
  t text;
  person_col text;

  -- Tables whose rows belong to an individual. Column names verified against
  -- the migrations that created each table, not assumed: member_activity_events
  -- has a NULLABLE person_id (ON DELETE SET NULL) and community_posts uses
  -- author_person_id, so neither can be handled by a blanket 'person_id'.
  person_scoped CONSTANT text[][] := ARRAY[
    ['attendance','person_id'],
    ['tasks','person_id'],
    ['interactions','person_id'],
    ['prayer_requests','person_id'],
    ['giving','person_id'],
    ['recurring_giving','person_id'],
    ['pledges','person_id'],
    ['giving_statements','person_id'],
    ['event_rsvps','person_id'],
    ['discipleship_milestones','person_id'],
    ['member_activity_events','person_id'],
    ['volunteer_interests','person_id'],
    ['care_requests','person_id'],
    ['community_posts','author_person_id'],
    -- users is a staff table, but it carries a nullable person_id: if a
    -- participant is ever given a staff account it would link here. Staff rows
    -- have person_id NULL and stay visible through the IS NULL branch, so
    -- including this costs nothing and fails closed.
    ['users','person_id']
  ];

  -- Left church-only on purpose. These describe the church itself or its
  -- staff, not a participant: households and small_groups are containers whose
  -- membership lives in join tables 053 never exposed; calendar_events,
  -- announcements and campaigns are broadcast content; donation_batches is a
  -- staff bookkeeping envelope (the per-person rows are in `giving`, narrowed
  -- above); staff_profiles is a staff record a participant never gets.
  --   households, small_groups, calendar_events, announcements,
  --   donation_batches, campaigns, staff_profiles
BEGIN
  -- people: the row that makes a participant identifiable at all.
  DROP POLICY IF EXISTS demo_anon_read ON public.people;
  EXECUTE format(
    'CREATE POLICY demo_anon_read ON public.people FOR SELECT TO anon '
    'USING (church_id = %L AND NOT self_registered)',
    demo_church
  );

  FOR i IN 1 .. array_length(person_scoped, 1) LOOP
    t := person_scoped[i][1];
    person_col := person_scoped[i][2];
    EXECUTE format('DROP POLICY IF EXISTS demo_anon_read ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY demo_anon_read ON public.%I FOR SELECT TO anon '
      'USING (church_id = %L AND (%I IS NULL OR %I IN ('
      '  SELECT p.id FROM public.people p '
      '  WHERE p.church_id = %L AND NOT p.self_registered)))',
      t, demo_church, person_col, person_col, demo_church
    );
  END LOOP;
END $$;

-- ═══ ROLLBACK ═══
-- Reverting restores 053's behaviour, which re-exposes any real pilot
-- participant already signed up into the Faithful tenant. Do not roll back
-- without first confirming `select count(*) from people where church_id =
-- '22222222-2222-2222-2222-222222222222' and self_registered` returns 0.
--
-- DO $$
-- DECLARE
--   demo_church CONSTANT uuid := '22222222-2222-2222-2222-222222222222';
--   t text;
--   demo_tables text[] := ARRAY[
--     'people','attendance','tasks','interactions','prayer_requests',
--     'giving','recurring_giving','pledges','giving_statements','event_rsvps',
--     'discipleship_milestones','member_activity_events','volunteer_interests',
--     'care_requests','community_posts','users'
--   ];
-- BEGIN
--   FOREACH t IN ARRAY demo_tables LOOP
--     EXECUTE format('DROP POLICY IF EXISTS demo_anon_read ON public.%I', t);
--     EXECUTE format(
--       'CREATE POLICY demo_anon_read ON public.%I FOR SELECT TO anon USING (church_id = %L)',
--       t, demo_church);
--   END LOOP;
-- END $$;
