-- 075_grace_memory.sql
--
-- Memory V1 ("Grace Remembers Me") — ADR-014. Staff Ask GRACE gains
-- server-side conversation persistence and per-user, per-church memory.
--
-- Three tables:
--   grace_conversations — one row per chat thread
--   grace_messages      — the turns in a conversation (user/assistant)
--   grace_memories       — durable facts extracted from a conversation,
--                          scoped to the staff member who stated them
--
-- Scoping: every table carries BOTH church_id and user_id. Memory is
-- never shared across users or across churches in V1 — "Grace Knows the
-- Church" (shared memory) is a later milestone, deliberately not this one.
--
-- Provenance: grace_memories.source is 'user_stated' (explicit "remember
-- that…", deterministic) or 'ai_extracted' (a small post-turn extraction
-- pass). A named CHECK constraint — mirroring
-- agent_actions_origin_run_consistent from migration 071 — makes an
-- ai_extracted row without a source message impossible.
--
-- RLS: SELECT-only, scoped to the owning user within their own church.
-- No write policy on any of the three tables — all writes happen through
-- api/grace/_chat.ts using the service-role client, the same posture as
-- security_events (062). A browser client can read its own rows and
-- forge none of them.
--
-- Idempotent.

-- ============================================
-- 1. grace_conversations
-- ============================================

create table if not exists public.grace_conversations (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  title           text,
  started_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists idx_grace_conversations_user
  on public.grace_conversations(church_id, user_id, last_message_at desc);

alter table public.grace_conversations enable row level security;

drop policy if exists "grace_conversations read own" on public.grace_conversations;
create policy "grace_conversations read own"
  on public.grace_conversations for select
  using (church_id = public.get_church_id() and user_id = public.get_app_user_id());

comment on table public.grace_conversations is
  'One row per Ask GRACE chat thread. Written by api/grace/_chat.ts (service-role) — no client write policy.';

-- ============================================
-- 2. grace_messages
-- ============================================
--
-- user_id is denormalized from the parent conversation so the read
-- policy is a flat column check rather than a join through
-- grace_conversations — matches the simplest RLS shape in the codebase
-- (061) rather than introducing an EXISTS-subquery policy for this table.

create table if not exists public.grace_messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.grace_conversations(id) on delete cascade,
  church_id          uuid not null references public.churches(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  role               text not null check (role in ('user', 'assistant')),
  content            text not null check (char_length(content) between 1 and 16000),
  model              text,
  prompt_tokens      integer,
  completion_tokens  integer,
  created_at         timestamptz not null default now()
);

create index if not exists idx_grace_messages_conversation
  on public.grace_messages(conversation_id, created_at);

alter table public.grace_messages enable row level security;

drop policy if exists "grace_messages read own" on public.grace_messages;
create policy "grace_messages read own"
  on public.grace_messages for select
  using (church_id = public.get_church_id() and user_id = public.get_app_user_id());

comment on table public.grace_messages is
  'Turns within a grace_conversations thread. Written by api/grace/_chat.ts (service-role) — no client write policy.';

-- ============================================
-- 3. grace_memories
-- ============================================

create table if not exists public.grace_memories (
  id                     uuid primary key default gen_random_uuid(),
  church_id              uuid not null references public.churches(id) on delete cascade,
  user_id                uuid not null references public.users(id) on delete cascade,
  content                text not null check (char_length(content) between 2 and 2000),
  source                 text not null check (source in ('user_stated', 'ai_extracted')),
  source_message_id      uuid references public.grace_messages(id) on delete set null,
  source_conversation_id uuid references public.grace_conversations(id) on delete set null,
  person_ids             uuid[] not null default '{}',
  content_tsv            tsvector generated always as (to_tsvector('english', content)) stored,
  status                 text not null default 'active' check (status in ('active', 'superseded', 'expired')),
  superseded_by          uuid references public.grace_memories(id) on delete set null,
  expires_at             timestamptz,
  created_at             timestamptz not null default now()
);

-- Provenance cannot be misreported: an ai_extracted memory must point at
-- the message it was extracted from; a user_stated memory need not (the
-- explicit "remember that…" path may or may not carry one).
alter table public.grace_memories drop constraint if exists grace_memories_provenance_consistent;
alter table public.grace_memories add constraint grace_memories_provenance_consistent check (
  source = 'user_stated' or (source = 'ai_extracted' and source_message_id is not null)
);

create index if not exists idx_grace_memories_user_active
  on public.grace_memories(church_id, user_id, status, created_at desc);
create index if not exists idx_grace_memories_content_tsv
  on public.grace_memories using gin (content_tsv);
create index if not exists idx_grace_memories_person_ids
  on public.grace_memories using gin (person_ids);

alter table public.grace_memories enable row level security;

drop policy if exists "grace_memories read own" on public.grace_memories;
create policy "grace_memories read own"
  on public.grace_memories for select
  using (church_id = public.get_church_id() and user_id = public.get_app_user_id());

comment on table public.grace_memories is
  'Durable per-user facts Ask GRACE remembers across sessions (ADR-014). Supplementary context only — never a source of truth over live church data. No client write policy; written by api/grace/_chat.ts (service-role).';
comment on column public.grace_memories.source is
  'user_stated: explicit "remember that…" directive. ai_extracted: post-turn extraction of a fact the staff user stated about their own plans/context — never an AI judgment about a church member (docs/AI_BOUNDARIES.md).';

-- ═══ ROLLBACK ═══
-- begin;
--   drop table if exists public.grace_memories;
--   drop table if exists public.grace_messages;
--   drop table if exists public.grace_conversations;
-- commit;
