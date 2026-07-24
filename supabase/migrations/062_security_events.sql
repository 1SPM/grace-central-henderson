-- 062_security_events.sql
--
-- Durable capture for the highest-value security-monitoring events from the
-- logging/monitoring audit: authentication failures, permission denials
-- (member-hits-admin-endpoint / privilege-escalation attempts), suspended-
-- account activity, and missing-church-record (token-manipulation / cross-
-- tenant) signals. Written server-side by the authz layer via
-- api/_lib/securityLog.ts.
--
-- church_id is a PLAIN column (no FK) on purpose: a security event must be
-- retained for forensics even after its church is deleted, and this lets the
-- append-only trigger block ALL mutations unconditionally (no SET-NULL cascade
-- to special-case — cf. migration 054). Reads are gated to audit.view holders;
-- writes are service-role only (no write policy → browser can't forge events).

create table if not exists public.security_events (
  id             uuid primary key default gen_random_uuid(),
  church_id      uuid,
  actor_clerk_id text,
  event_type     text not null,
  severity       text not null default 'info' check (severity in ('info', 'elevated', 'critical')),
  ip             text,
  route          text,
  detail         jsonb not null default '{}'::jsonb,   -- MUST be PII-free
  created_at     timestamptz not null default now()
);

create index if not exists idx_security_events_type_time   on public.security_events(event_type, created_at desc);
create index if not exists idx_security_events_church_time on public.security_events(church_id, created_at desc);
create index if not exists idx_security_events_severity    on public.security_events(severity, created_at desc)
  where severity in ('elevated', 'critical');

alter table public.security_events enable row level security;

-- Read: auditors / admins within their own church. Write: service-role only
-- (the authz layer) — no INSERT/UPDATE/DELETE policy, so a browser client
-- can neither read another church's events nor forge/erase its own.
drop policy if exists "security_events read own church" on public.security_events;
create policy "security_events read own church"
  on public.security_events for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'audit.view'));

-- Append-only: the security log must be tamper-evident.
create or replace function public.security_events_block_mutation()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  raise exception 'security_events is append-only; UPDATE/DELETE are not permitted (op=%)', TG_OP;
end $$;

drop trigger if exists security_events_no_mutate on public.security_events;
create trigger security_events_no_mutate
  before update or delete on public.security_events
  for each row execute function public.security_events_block_mutation();

comment on table public.security_events is
  'Append-only security-monitoring log (auth failures, permission denials, suspended-account activity, no-church-record). Written by api/_lib/securityLog.ts (service-role); read gated to audit.view. detail is PII-free.';
