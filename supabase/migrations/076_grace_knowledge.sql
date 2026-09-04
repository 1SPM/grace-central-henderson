-- 076_grace_knowledge.sql
--
-- Central Henderson church knowledge (ADR-015) — "Grace Knows the Church,"
-- phase one. ADR-014 (migration 075) deferred church-shared knowledge as a
-- future milestone, distinct from per-user memory; this is that milestone's
-- first, narrowly-scoped slice: one church, one pre-reviewed static source
-- (the audited FY2024 metadata fixture), no ingestion pipeline, no admin UI.
--
-- grace_knowledge is church-scoped (no user_id) — shared across every staff
-- member at a church, unlike grace_memories. It also has NO runtime write
-- path at all: every row arrives via migration, never via the app. This is
-- reference data, not conversation-derived data.
--
-- category='scope_boundary' rows are the enforcement mechanism, not a
-- bolt-on: they store the source's own guardrail language (what must never
-- be treated as Henderson-specific), so it is retrievable, source-attributed,
-- and always injected by api/_lib/grace-knowledge.ts regardless of query.
--
-- No dollar figures, attendance counts, or debt numbers are ever written
-- into this migration — the source metadata never contained them either,
-- so there is nothing to leak by omission.
--
-- RLS: SELECT-only, scoped to the caller's own church. No write policy —
-- same posture as grace_memories/security_events (062).
--
-- Idempotent.

create table if not exists public.grace_knowledge (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  slug          text not null,
  category      text not null check (category in ('identity', 'mission', 'strategy', 'ownership_path', 'scope_boundary')),
  title         text not null,
  content       text not null check (char_length(content) between 2 and 4000),
  source_label  text not null,
  content_tsv   tsvector generated always as (to_tsvector('english', title || ' ' || content)) stored,
  status        text not null default 'active' check (status in ('active', 'retired')),
  created_at    timestamptz not null default now(),
  unique (church_id, slug)
);

create index if not exists idx_grace_knowledge_church_active
  on public.grace_knowledge(church_id, status, category);
create index if not exists idx_grace_knowledge_content_tsv
  on public.grace_knowledge using gin (content_tsv);

alter table public.grace_knowledge enable row level security;

drop policy if exists "grace_knowledge read own church" on public.grace_knowledge;
create policy "grace_knowledge read own church"
  on public.grace_knowledge for select
  using (church_id = public.get_church_id());

comment on table public.grace_knowledge is
  'Church-scoped reference knowledge Ask GRACE draws on in conversation (ADR-015). Read-only at the application layer — every row arrives via migration, never a runtime write. No client write policy.';
comment on column public.grace_knowledge.category is
  'scope_boundary rows carry the source''s own guardrail language and are always injected by the retrieval code regardless of query relevance — see api/_lib/grace-knowledge.ts.';

-- ============================================
-- Seed: Central Henderson (the one church this fixture is for)
-- ============================================
--
-- Source: Central Christian Church and Affiliates - Consolidated Financial
-- Statements with Independent Auditors' Report, FY2024 (period end
-- 2024-06-30, audit report date 2024-10-07). Reviewed source extract —
-- identity/mission facts only. Every row below traces to the same source
-- document's entity-and-mission-context pages (PDF pp. 7-10) unless noted.

insert into public.grace_knowledge (church_id, slug, category, title, content, source_label) values
  ('11111111-1111-1111-1111-111111111111', 'catalyst-church', 'identity',
   'Central Henderson is the catalyst church',
   'Central Henderson, Nevada is Central Christian Church''s catalyst church. Central describes itself as "one church in many locations." Central Henderson is an independent, non-denominational church.',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, entity & mission context (PDF pp. 7-10). Reviewed source extract; identity/mission content only, no financial figures.'),

  ('11111111-1111-1111-1111-111111111111', 'mission-statement', 'mission',
   'Central''s mission',
   '"We exist to introduce people to Jesus and help them follow Him."',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10). Reviewed source extract.'),

  ('11111111-1111-1111-1111-111111111111', 'vision-summary', 'mission',
   'Vision',
   'A movement of God''s grace through reproducible environments where the good news of Jesus is shared, life change is experienced, and God''s light shines across the Las Vegas valley and beyond.',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10). Reviewed source extract.'),

  ('11111111-1111-1111-1111-111111111111', 'four-part-strategy', 'strategy',
   'Central''s four-part strategy — navigation language only',
   'Attend the weekend to experience God. Invite a friend to share hope. Take a next step to follow Jesus. Give generously to rescue others. Use this as next-step / navigation language only — never as a behavioral score, ranking, or eligibility rule for any person.',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10). Reviewed source extract.'),

  ('11111111-1111-1111-1111-111111111111', 'ownership-path', 'ownership_path',
   'Ownership path',
   'Receive salvation. Be baptized by immersion. Complete First Step.',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10). Reviewed source extract.'),

  ('11111111-1111-1111-1111-111111111111', 'consolidated-financials-out-of-scope', 'scope_boundary',
   'Consolidated financials are not Henderson-specific',
   'All financial statements, ratios, revenue, expenses, assets, liabilities, liquidity, debt, donor restrictions, gift-in-kind activity, and ministry outcomes in the FY2024 audited report describe Central Christian Church and Affiliates on a CONSOLIDATED basis, not Central Henderson specifically. If referenced at all, label it "Central Christian Church and Affiliates - consolidated FY2024." No authorized Henderson-specific financial source exists in this knowledge base — do not answer a Henderson-specific revenue, expense, debt, or budget question using this data.',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, scope guardrail (source metadata, not the underlying figures).'),

  ('11111111-1111-1111-1111-111111111111', 'affiliate-activity-out-of-scope', 'scope_boundary',
   'Affiliate and other-campus activity is not Henderson-specific',
   'Affiliate, other-campus, online, prison-ministry, Central Global, Hope For The City, and Central Australasia activity described in the FY2024 audited report is not specific to Central Henderson.',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, scope guardrail.'),

  ('11111111-1111-1111-1111-111111111111', 'campus-metrics-require-authorization', 'scope_boundary',
   'Campus-specific metrics require an authorized Henderson source',
   'Do not infer Henderson attendance, giving, household need, ministry impact, budget, debt, or staff capacity from the consolidated FY2024 report. Any Henderson campus-specific metric, financial workflow, or public claim requires an authorized Central Henderson-specific source before it can be stated.',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, scope guardrail.'),

  ('11111111-1111-1111-1111-111111111111', 'giving-care-conversation-permissioned', 'scope_boundary',
   'Giving, care, and spiritual-conversation data stays permissioned',
   'This knowledge entry is public mission/identity context only. It is never a source for any individual member''s giving history, care history, or spiritual-conversation content — that data, where it exists, is permissioned elsewhere and must never be inferred or fabricated from this entry.',
   'Grace product constraint, derived from the source-scoped fixture''s access rules.'),

  ('11111111-1111-1111-1111-111111111111', 'legal-tax-status-unverified', 'scope_boundary',
   'Legal/tax status needs workflow-specific verification',
   'Central Christian Church and Hope For The City are described as US 501(c)(3) public charities in the FY2024 audited report. Use this only after legal/operations verification for the specific workflow it would support — do not state it as a general fact without that verification.',
   'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, legal/tax context (PDF pp. 7-10).')
on conflict (church_id, slug) do nothing;

-- ═══ ROLLBACK ═══
-- begin;
--   drop table if exists public.grace_knowledge;
-- commit;
