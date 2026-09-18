-- GRACE -- a separate survey track for the Faithful demo tenant
-- Migration: 084_pilot_survey_faithful_track.sql
--
-- 083 allowed four tracks, all of them Central's. Faithful needs its own
-- question group: three of Central's questions name Central by the pilot
-- document's own wording, and a Faithful participant should not be asked to
-- rate channels that are not theirs. Faithful's group also asks about the
-- "Let us know" onboarding, which is where that walkthrough actually happens.
--
-- This is a widening of the allowed values only. No existing row changes, and
-- the unique key stays (church_id, track, respondent_key), so the two churches'
-- answers are now separated twice over -- by church and by track -- rather
-- than relying on church_id alone.

alter table pilot_survey_responses
  drop constraint pilot_survey_responses_track_check;

alter table pilot_survey_responses
  add constraint pilot_survey_responses_track_check
  check (track in ('members', 'members_faithful', 'admin', 'team', 'impact'));

comment on column pilot_survey_responses.track is
  'Which question group answered this. members = Central''s pilot-verbatim set; members_faithful = the Faithful demo set, which also covers the "Let us know" onboarding. Defined in api/_lib/pilotSurvey.ts.';

-- ═══ ROLLBACK ═══
-- Only safe while no members_faithful rows exist; the narrower constraint
-- would reject them. Check first:
--   select count(*) from pilot_survey_responses where track = 'members_faithful';
--
-- alter table pilot_survey_responses drop constraint pilot_survey_responses_track_check;
-- alter table pilot_survey_responses add constraint pilot_survey_responses_track_check
--   check (track in ('members', 'admin', 'team', 'impact'));
