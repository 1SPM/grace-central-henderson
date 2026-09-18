-- GRACE -- carry a portal visitor's story to their phone, then onto a real account
-- Migration: 082_visitor_story_handoff.sql
--
-- The Discovery + Validation pilot's walkthrough ends with a QR scan. The six
-- "Let us know" tutorial panels already capture a visitor's answers in the
-- page; nothing has ever persisted them, so the scan carried nothing and the
-- "Create your account" screen created nothing. These two tables are the
-- missing middle: a durable draft, and a one-use token that moves it to a
-- phone.
--
-- WHY TWO TABLES. The draft outlives the token. A member may regenerate the QR
-- (venue wifi, a mis-scan, a second attempt), and an UNCLAIMED draft is still
-- the pilot's research record. Conflating them would mean either re-storing
-- the payload per QR or destroying research data when a token burns. This is
-- the same split migration 080 made from 079.
--
-- ANONYMITY. person_id is nullable and stays null unless the visitor finishes
-- Clerk sign-up -- exactly the posture of workshop_simulations (079): someone
-- who walks the portal and stops still counts as evidence, and is never linked
-- to a person.
--
-- WHAT IS NOT HERE. docs/MEMBER_MOBILE_HANDOFF.md sets the allowlist, and it
-- is enforced in api/_lib/storySegments.ts, not by a CHECK: journal text, care
-- notes, Wallet free text, payment data, tokens and account identifiers never
-- enter `sections`. The segmentation answers are enum-only, and deliberately
-- carry no numeric confidence scale -- a number invites a derived "score",
-- which this product refuses to build about its members.

create table visitor_story_drafts (
  id uuid primary key default uuid_generate_v4(),
  church_id uuid not null references churches(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  preferred_name text,
  sections jsonb not null default '{}',
  segments jsonb not null default '{}',
  -- What the visitor actually agreed to, captured at the moment they agreed.
  -- Stored on the row rather than only in `consents` so the pilot record stays
  -- honestly reconstructible even if a member later changes a preference.
  consent_carry_story boolean not null,
  consent_money_sections boolean not null default false,
  consent_followup boolean not null default false,
  -- Survives the Clerk redirect and is consumed once, so a scraped draft id
  -- plus any signed-in session cannot attach someone else's story.
  attach_nonce_sha256 text,
  attach_expires_at timestamptz,
  -- Null until a senior pastor releases follow-up church-wide. Research reads
  -- happen through the service role regardless; this gates the per-person
  -- staff view, so "the church decides" is a database fact, not a UI habit.
  staff_visible_at timestamptz,
  claimed_at timestamptz,
  source text not null default 'faithful_portal',
  created_at timestamptz not null default now()
);

comment on table visitor_story_drafts is
  'A portal visitor''s tutorial answers, optionally carried to a phone and attached to a real member account at sign-up. person_id null = anonymous research record.';
comment on column visitor_story_drafts.sections is
  'Allowlisted panel answers, {panelKey: string[]}. Enforced in api/_lib/storySegments.ts -- never journal, care notes, Wallet free text, payment data or identifiers.';
comment on column visitor_story_drafts.segments is
  'Pilot segmentation: age_band, language_preference, attendance_mode, digital_confidence. Enum values only; no numeric scale, by design.';
comment on column visitor_story_drafts.consent_money_sections is
  'Separate opt-in for the Wallet/Impact sections, off by default -- MEMBER_MOBILE_HANDOFF.md requires a distinct allowlist and confirmation for money-adjacent content.';
comment on column visitor_story_drafts.staff_visible_at is
  'Church approval gate for the per-person follow-up view. Set via POST /api/story/approve-followup (pilot_research.approve).';

create index visitor_story_drafts_church_created_idx
  on visitor_story_drafts (church_id, created_at desc);
create index visitor_story_drafts_person_idx
  on visitor_story_drafts (person_id) where person_id is not null;

create table visitor_story_handoffs (
  id uuid primary key default uuid_generate_v4(),
  church_id uuid not null references churches(id) on delete cascade,
  draft_id uuid not null references visitor_story_drafts(id) on delete cascade,
  -- SHA-256 of the token, never the token. 045_portal_preview_tokens stores its
  -- token in plaintext; this one is displayed on a screen in a room full of
  -- people, and migration 053 shows how easily a table joins an anon-readable
  -- list later. Hashing makes that class of mistake non-exploitable.
  token_sha256 text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  cancelled_at timestamptz,
  first_used_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table visitor_story_handoffs is
  'One-use, short-lived token moving a visitor_story_draft from the desktop walkthrough to a phone. Redeem only via redeem_visitor_story_handoff().';
comment on column visitor_story_handoffs.token_sha256 is
  'SHA-256 of the raw token. The raw value exists only inside the QR code.';

create index visitor_story_handoffs_draft_idx on visitor_story_handoffs (draft_id);
create index visitor_story_handoffs_expiry_idx on visitor_story_handoffs (expires_at)
  where redeemed_at is null and cancelled_at is null;

-- ── Atomic single-use redemption ─────────────────────────────────────────────
--
-- The whole guarantee is one conditional UPDATE. Two phones scanning the same
-- screen: the first takes the row lock; the second blocks there, and under READ
-- COMMITTED Postgres RE-EVALUATES the WHERE clause against the updated row once
-- the lock releases. `redeemed_at is null` is then false, so it updates zero
-- rows and gets already_used. That re-check is the correctness argument -- not
-- the lock itself, and not a preceding SELECT, which is the race that
-- api/giving/_donor-portal-callback.ts still has.
--
-- On zero rows a second, read-only lookup says WHY, so the phone can show
-- expired / cancelled / already used rather than one opaque failure.
create or replace function public.redeem_visitor_story_handoff(
  p_token_sha256 text,
  p_church_id uuid
)
returns table (status text, draft_id uuid)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_draft_id uuid;
  v_exists boolean;
  v_redeemed timestamptz;
  v_cancelled timestamptz;
  v_expires timestamptz;
begin
  update visitor_story_handoffs h
     set redeemed_at   = now(),
         use_count     = h.use_count + 1,
         first_used_at = coalesce(h.first_used_at, now()),
         last_used_at  = now()
   where h.token_sha256 = p_token_sha256
     and h.church_id    = p_church_id
     and h.redeemed_at  is null
     and h.cancelled_at is null
     and h.expires_at   > now()
  returning h.draft_id into v_draft_id;

  if v_draft_id is not null then
    return query select 'ok'::text, v_draft_id;
    return;
  end if;

  -- Deliberately scoped by church_id as well: a token belonging to another
  -- tenant must be indistinguishable from one that does not exist, so this
  -- never confirms a token is real somewhere else.
  select true, h.redeemed_at, h.cancelled_at, h.expires_at
    into v_exists, v_redeemed, v_cancelled, v_expires
    from visitor_story_handoffs h
   where h.token_sha256 = p_token_sha256
     and h.church_id    = p_church_id;

  if v_exists is null then
    return query select 'unknown'::text, null::uuid;
  elsif v_cancelled is not null then
    return query select 'cancelled'::text, null::uuid;
  elsif v_redeemed is not null then
    return query select 'already_used'::text, null::uuid;
  else
    return query select 'expired'::text, null::uuid;
  end if;
end;
$$;

comment on function public.redeem_visitor_story_handoff(text, uuid) is
  'Atomically consumes a story handoff token. Service-role only. Returns ok/unknown/cancelled/already_used/expired.';

-- SECURITY INVOKER, not DEFINER: migration 070 makes this argument, and 056
-- revoked anon EXECUTE on definer helpers. Called with the service-role key.
revoke execute on function public.redeem_visitor_story_handoff(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_visitor_story_handoff(text, uuid) to service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
--
-- Written only by the public story API routes using the service-role key (same
-- trust boundary as api/_connect-card.ts) -- no anon or authenticated insert
-- policy anywhere, and neither table is ever added to migration 053's
-- demo_anon_read list.

alter table visitor_story_drafts enable row level security;
alter table visitor_story_handoffs enable row level security;

-- visitor_story_handoffs intentionally has NO policies: Postgres defaults to
-- deny, so only the service role reaches it. 045 grants its token table to
-- every authenticated principal in the church; that is not repeated here.

create policy visitor_story_drafts_staff_select on visitor_story_drafts
  for select
  using (
    church_id = get_church_id()
    and staff_visible_at is not null
    and user_has_permission(get_app_user_id(), get_church_id(), 'pilot_research.view')
  );

-- FOR SELECT, not FOR ALL as 042_member_portal_support.sql uses for
-- member_journey_items: a member should be able to read their own story back,
-- but must not be able to rewrite a research record after the fact.
create policy visitor_story_drafts_member_self on visitor_story_drafts
  for select
  using (person_id = public.get_person_id());

-- ── Permissions ──────────────────────────────────────────────────────────────
--
-- A new key rather than reusing analytics.view: these rows are a named
-- individual's own words about what they are hoping to find, not an aggregate.
INSERT INTO permissions (key, module, action, sensitivity, description) VALUES
  ('pilot_research.view', 'pilot_research', 'view', 'confidential', 'View individual pilot participants'' story responses (requires church follow-up approval)'),
  ('pilot_research.approve', 'pilot_research', 'approve', 'confidential', 'Release pilot story responses to staff for follow-up, church-wide')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  grants JSONB := '{
    "senior_pastor": ["pilot_research.view", "pilot_research.approve"],
    "system_administrator": ["pilot_research.view"]
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

-- ═══ ROLLBACK ═══
-- Rolling back DESTROYS pilot research data: unclaimed drafts are the record of
-- every visitor who walked the portal and did not sign up. Export first:
--   copy (select * from visitor_story_drafts) to stdout with csv header;
--
-- drop policy if exists visitor_story_drafts_member_self on visitor_story_drafts;
-- drop policy if exists visitor_story_drafts_staff_select on visitor_story_drafts;
-- drop function if exists public.redeem_visitor_story_handoff(text, uuid);
-- drop table if exists visitor_story_handoffs;   -- FK to drafts: drop first
-- drop table if exists visitor_story_drafts;
-- delete from role_permissions where permission_id in
--   (select id from permissions where key in ('pilot_research.view','pilot_research.approve'));
-- delete from permissions where key in ('pilot_research.view','pilot_research.approve');
