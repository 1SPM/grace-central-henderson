-- The "Wallet" sub-stage of the "Me" stage (Maya -> Me -> Us -> Pastor ->
-- Real Pilot). After a workshop attendee sees their illustrative spend
-- allocation impact (workshop_simulations), they can optionally continue
-- to a second screen showing an illustrative "Impact Card" preview keyed
-- to one headline cause. This is a separate table from
-- workshop_simulations (not a `stage` column) for the same reason
-- care_requests and prayer_requests are separate tables rather than one
-- polymorphic table: the two stages have genuinely different shapes (a
-- multi-cause % allocation over an estimated spend vs. a single headline
-- cause with no new spend estimate), and keeping them apart lets each
-- stay honestly reconstructible and lets staff evidence show stage-2
-- conversion as a simple join instead of a self-join with a discriminator
-- filter.
--
-- Not a real card and never wired to api/neobank's real card-issuing
-- backend -- see workshop_simulations' comment for the same posture.

create table workshop_wallet_activations (
  id uuid primary key default uuid_generate_v4(),
  church_id uuid not null references churches(id) on delete cascade,
  simulation_id uuid not null unique references workshop_simulations(id) on delete cascade,
  display_name text,
  headline_cause text not null,
  projected_monthly_impact_micro_usd bigint not null check (projected_monthly_impact_micro_usd >= 0),
  source text not null default 'workshop',
  created_at timestamptz not null default now()
);

comment on table workshop_wallet_activations is 'A workshop attendee continuing from their spend-allocation simulation (workshop_simulations) into the "what could my Impact Card look like" preview. One row per simulation (unique on simulation_id) -- re-submitting the same simulation_id updates rather than duplicates, since a double-tap on flaky venue wifi should not double-count a participant. Not a real card, no PAN/CVV/KYC data of any kind.';
comment on column workshop_wallet_activations.display_name is 'Denormalized copy of workshop_simulations.display_name at activation time -- same reasoning as illustrative_rate_bps on workshop_simulations: this row stays self-contained and honestly reconstructible even if the parent row changes later.';
comment on column workshop_wallet_activations.headline_cause is 'Single cause featured on the illustrative card preview -- one of the same allowlist api/workshop/_shared.ts exports as ALLOWED_CAUSES, enforced at the API layer (no CHECK constraint here so the allowlist has exactly one place to change, matching how workshop_simulations.allocations is also unconstrained JSON rather than an enum).';
comment on column workshop_wallet_activations.projected_monthly_impact_micro_usd is 'Denormalized copy of the parent workshop_simulations row''s projected_impact_micro_usd at activation time, so this row''s own evidence never silently changes and wallet-stage aggregates never need to join back to workshop_simulations.';

create index workshop_wallet_activations_church_id_idx on workshop_wallet_activations (church_id, created_at desc);

alter table workshop_wallet_activations enable row level security;

-- Written only by the public workshop API route using the service role
-- key (same trust boundary as workshop_simulations) -- no anon-key
-- insert policy.

create policy workshop_wallet_activations_staff_select on workshop_wallet_activations
  for select
  using (
    church_id = get_church_id()
    and user_has_permission(get_app_user_id(), get_church_id(), 'analytics.view')
  );

-- ═══ ROLLBACK ═══
-- drop policy if exists workshop_wallet_activations_staff_select on workshop_wallet_activations;
-- drop index if exists workshop_wallet_activations_church_id_idx;
-- drop table if exists workshop_wallet_activations;
