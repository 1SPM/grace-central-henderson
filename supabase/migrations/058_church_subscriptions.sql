-- 058_church_subscriptions.sql
--
-- Creates the church_subscriptions table that the SaaS webhook handler
-- (api/_lib/webhooks/stripe-handlers.ts:handleSaasSubscriptionLifecycle)
-- upserts into. The table was referenced in code (a stale comment cited a
-- "migration 016") but never actually existed in the database — so a real
-- customer.subscription.* event would throw on the upsert, land in the DLQ,
-- and the churches entitlement mirror (which runs AFTER the upsert) would
-- never execute. Found in the 2026-07-23 payment/entitlement audit.
--
-- Written by the webhook (service-role) only. The rest of the app reads
-- entitlement from the churches.subscription_* mirror, so RLS here is
-- deny-by-default: a church-scoped SELECT (parity with card_accounts /
-- ledger_entries) and NO write policy — browser writes are denied; the
-- service-role webhook bypasses RLS.

create table if not exists public.church_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  church_id                uuid not null references public.churches(id) on delete cascade,
  stripe_subscription_id   text not null unique,
  stripe_customer_id       text,
  stripe_price_id          text,
  plan_slug                text,
  status                   text,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean default false,
  canceled_at              timestamptz,
  trial_start              timestamptz,
  trial_end                timestamptz,
  metadata                 jsonb default '{}'::jsonb,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create index if not exists idx_church_subscriptions_church_id
  on public.church_subscriptions(church_id);

alter table public.church_subscriptions enable row level security;

-- Read own church only. No INSERT/UPDATE/DELETE policy → browser writes
-- are denied; the Stripe webhook writes via the service-role key (bypasses RLS).
drop policy if exists "church_subscriptions read own church" on public.church_subscriptions;
create policy "church_subscriptions read own church"
  on public.church_subscriptions for select
  using (church_id = get_church_id());

-- ══════════════════════════════ ROLLBACK ══════════════════════════════
-- The table is webhook-populated; dropping it loses only the mirror (the
-- churches.subscription_* columns remain the entitlement source the gate reads).
-- begin;
--   drop table if exists public.church_subscriptions;
-- commit;
