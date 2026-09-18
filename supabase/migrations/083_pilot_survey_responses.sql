-- GRACE -- Discovery + Validation pilot survey responses (Track C: members)
-- Migration: 083_pilot_survey_responses.sql
--
-- The pilot needs evidence, and until now there was nowhere to put it: no
-- survey, rating or feedback table existed anywhere in the codebase, so
-- fieldwork would have run on paper or an external tool.
--
-- NO person_id, DELIBERATELY. The pilot document's privacy boundaries say
-- "Separate participant identity from survey analysis where practical" and
-- "Report aggregated themes and scores. Do not expose identifiable sensitive
-- responses in the findings deck." A foreign key to people would make the
-- opposite easy and the right thing require discipline. Instead:
--
--   respondent_key   a random per-response token minted by the client. It
--                    identifies a response for editing within a sitting; it
--                    identifies no person, and nothing maps it back to one.
--   story_draft_id   optional join to the walkthrough's segmentation
--                    (age band, language, attendance mode, digital
--                    confidence). This is what lets the scaled survey answer
--                    the question a staged cohort exists to answer -- does
--                    comprehension differ by language, or by digital
--                    confidence -- WITHOUT naming anyone. visitor_story_drafts
--                    rows are themselves anonymous until a member chooses to
--                    attach one to an account.
--
-- Answers are jsonb keyed by question key, validated against
-- api/_lib/pilotSurvey.ts. Every question is skippable -- the participant
-- script promises exactly that -- so a partial row is expected, not an error.

create table pilot_survey_responses (
  id uuid primary key default uuid_generate_v4(),
  church_id uuid not null references churches(id) on delete cascade,
  track text not null check (track in ('members', 'admin', 'team', 'impact')),
  respondent_key text not null,
  story_draft_id uuid references visitor_story_drafts(id) on delete set null,
  answers jsonb not null default '{}',
  -- Null while a member is still working through it; set when they finish.
  completed_at timestamptz,
  source text not null default 'member_portal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, track, respondent_key)
);

comment on table pilot_survey_responses is
  'Discovery + Validation pilot survey answers. Deliberately carries no person_id: the pilot document requires participant identity to be separable from survey analysis.';
comment on column pilot_survey_responses.respondent_key is
  'Random per-response token from the client. Identifies a response for editing within a sitting, never a person.';
comment on column pilot_survey_responses.story_draft_id is
  'Optional link to the walkthrough segmentation, so results can be read by language or digital confidence without identifying anyone.';
comment on column pilot_survey_responses.answers is
  'Question key -> answer. Validated against MEMBER_SURVEY in api/_lib/pilotSurvey.ts; unknown keys are rejected, not dropped.';

create index pilot_survey_responses_church_track_idx
  on pilot_survey_responses (church_id, track, created_at desc);
create index pilot_survey_responses_draft_idx
  on pilot_survey_responses (story_draft_id) where story_draft_id is not null;

drop trigger if exists set_updated_at on pilot_survey_responses;
create trigger set_updated_at before update on pilot_survey_responses
  for each row execute function update_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
--
-- Written only by the public survey API route with the service-role key (same
-- trust boundary as api/_connect-card.ts) -- no anon or authenticated insert
-- policy, and never added to migration 053's demo_anon_read list.
alter table pilot_survey_responses enable row level security;

-- Reusing pilot_research.view from migration 082: these are the same
-- participants' own words about the same pilot, and splitting the permission
-- would mean two things to grant and one to forget.
create policy pilot_survey_responses_staff_select on pilot_survey_responses
  for select
  using (
    church_id = get_church_id()
    and user_has_permission(get_app_user_id(), get_church_id(), 'pilot_research.view')
  );

-- ═══ ROLLBACK ═══
-- Rolling back DESTROYS pilot evidence that cannot be recollected -- the
-- members who answered are anonymous and cannot be asked again. Export first:
--   copy (select * from pilot_survey_responses) to stdout with csv header;
--
-- drop policy if exists pilot_survey_responses_staff_select on pilot_survey_responses;
-- drop trigger if exists set_updated_at on pilot_survey_responses;
-- drop table if exists pilot_survey_responses;
