-- Workshop spend simulation ("Me" + "Us" stages of the Maya -> Me -> Us ->
-- Pastor -> Real Pilot workshop experience). A workshop attendee is
-- deliberately NOT required to be an authenticated member or have gone
-- through self-signup/staff review -- person_id is nullable so anyone who
-- scans the workshop QR code can participate without an account. There is
-- no real spend-to-impact formula anywhere in the codebase (impact is
-- driven by actual processor interchange fees, not a percentage of spend
-- -- see api/neobank/_index.ts); illustrative_rate_bps records exactly
-- which illustrative rate produced projected_impact_micro_usd for a given
-- row, so the number shown is always honestly reconstructible even if the
-- rate is tuned later.

create table workshop_simulations (
  id uuid primary key default uuid_generate_v4(),
  church_id uuid not null references churches(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  display_name text,
  monthly_spend_micro_usd bigint not null check (monthly_spend_micro_usd >= 0),
  allocations jsonb not null,
  illustrative_rate_bps integer not null,
  projected_impact_micro_usd bigint not null check (projected_impact_micro_usd >= 0),
  source text not null default 'workshop',
  created_at timestamptz not null default now()
);

comment on table workshop_simulations is 'A workshop attendee''s "if I used the Impact Card" simulation (North Star doc: Maya -> Me -> Us -> Pastor -> Real Pilot). Not a real transaction or a real member account -- person_id is nullable, no card/KYC/Clerk auth required. projected_impact_micro_usd is illustrative_rate_bps applied to monthly_spend_micro_usd; both are stored per-row so past evidence stays honestly reconstructible if the rate changes.';
comment on column workshop_simulations.allocations is 'Array of {cause, pct} the participant chose, e.g. [{"cause":"missions","pct":40},...]. Free-form JSON, not an enum -- causes are a UI convention today (see member-portal.html), not a schema constraint.';
comment on column workshop_simulations.illustrative_rate_bps is 'Basis points applied to monthly_spend_micro_usd to produce projected_impact_micro_usd for THIS row. Stored per-row (not read from config at query time) so historical evidence never silently changes if the illustrative rate is retuned.';

create index workshop_simulations_church_id_idx on workshop_simulations (church_id, created_at desc);

alter table workshop_simulations enable row level security;

-- Written only by the public workshop API route using the service role key
-- (same trust boundary as api/_connect-card.ts) -- no anon-key insert policy.

create policy workshop_simulations_staff_select on workshop_simulations
  for select
  using (
    church_id = get_church_id()
    and user_has_permission(get_app_user_id(), get_church_id(), 'analytics.view')
  );

-- ═══ ROLLBACK ═══
-- Migration 080's workshop_wallet_activations.simulation_id references this
-- table ON DELETE CASCADE, so 080 must be rolled back FIRST — otherwise the
-- drop below either fails or silently takes 080's rows with it.
--
-- drop policy if exists workshop_simulations_staff_select on workshop_simulations;
-- drop index if exists workshop_simulations_church_id_idx;
-- drop table if exists workshop_simulations;
