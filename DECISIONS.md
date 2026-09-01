# DECISIONS.md

> Architecture Decision Record (ADR) log.
> Append-only. If a decision is reversed, write a new entry that references and supersedes the old one — do not edit history.

Format:
- **ADR-NNN** — title
- **Date** — YYYY-MM-DD
- **Status** — Proposed | Accepted | Superseded by ADR-XXX | Deprecated
- **Context** — what problem we are solving
- **Decision** — what we chose
- **Consequences** — what we accept by choosing it
- **Alternatives considered** — what we rejected and why

---

## ADR-001 — Build on grace-crm rather than greenfield monorepo

- **Date:** 2026-05-25
- **Status:** Accepted

**Context.** The 18-week plan originally contemplated a fresh monorepo (Turborepo + pnpm + boundary linting). grace-crm already contains 90+ React components, a full Supabase schema across 38 tables, Clerk auth with fail-closed mode, Stripe wiring, an AI provider abstraction, an agent scaffold, and CI. A security audit has already resolved all Critical findings.

**Decision.** Treat grace-crm as the production codebase. Keep it as a single Vite + Express app. Defer the monorepo until a second deployable (mobile, admin-portal) actually needs to share code.

**Consequences.**
- We carry forward technical posture we did not design: schema uses `church_id` (not `tenant_id`), some hooks read directly from Supabase instead of going through a service layer, dev-mode RLS policies are permissive.
- We get 12+ weeks of head start on UI surface area.
- We MUST harden what already exists rather than reach for cleaner abstractions.

**Alternatives considered.**
- *Greenfield monorepo with packages/auth, packages/db, etc.* — rejected: rebuild cost wipes out the runway. Logged in `TECH_DEBT.md` with a re-entry trigger: "second deployable client."
- *Fork grace-crm into a new repo, strip non-essential UI* — rejected: same migration cost, loses git history.

---

## ADR-002 — Keep the existing `church_id` column name; do not rename to `tenant_id`

- **Date:** 2026-05-25
- **Status:** Accepted

**Context.** The plan uses `tenant_id`. The schema uses `church_id` across 38 tables, hundreds of queries, and JWT `app_metadata.church_id`.

**Decision.** `church_id` is the canonical tenant identifier. New tables use `church_id`. Documentation and prompts use "tenant" as the conceptual term and `church_id` as the column.

**Consequences.**
- No cross-cutting rename, no migration risk.
- Reads slightly awkward when we later sell to non-church verticals — at that point we add a generic `tenants` table that owns `id` and `churches` becomes a typed view. New decision required at that point.

**Alternatives considered.**
- *Rename everywhere now* — high blast radius, breaks Clerk metadata, breaks JWT contract with the helper function `public.get_church_id()`. Not worth it for naming purity.

---

## ADR-003 — RLS is the primary tenant-isolation control, not middleware

- **Date:** 2026-05-25
- **Status:** Accepted

**Context.** Today, tenant scoping is enforced in application code (every query manually filters by `church_id`). RLS policies exist but are permissive (`USING (true)`). A bug in any query risks cross-tenant data leak. Banking data is incoming.

**Decision.** Sprint 1 replaces permissive RLS with policies that read `auth.jwt() -> 'app_metadata' ->> 'church_id'` (helper already defined as `public.get_church_id()`). **Every new table must enable RLS in the migration that creates it** — that is the structural invariant. Whether a table also needs a `CREATE POLICY` is a per-table design decision:

- **User-facing tables** (queried by anon/authenticated via the client) MUST have a tenant-scoped policy (`USING (church_id = public.get_church_id())` or similar) — otherwise reads return empty.
- **Service-role-only tables** (sensitive intake, AI personas, private chats, payment ledger) SHOULD have no policy. Postgres defaults to deny when RLS is enabled with no policies — that is the most restrictive state. Migrations 007 and 008 use this pattern intentionally and document each table's reasoning inline.

A CI lint (`tools/lint-rls.ts`, deployed Sprint 0 Day 3) fails the build if a `CREATE TABLE` lands without a corresponding `ALTER TABLE … ENABLE ROW LEVEL SECURITY`. The "must have a policy" requirement is not lintable — it is a design call. The lint catches the one fatal bug (RLS off) without false-positiving the legitimate service-role-only pattern.

**Consequences.**
- Service-role queries (cron, server-to-server) must explicitly bypass RLS via the service role key; we cannot rely on it accidentally.
- Misconfigured Clerk metadata = empty result sets, not data leaks. Fail-closed.
- We need a cross-tenant smoke test that runs in CI on every PR (Sprint 1).
- Reviewers must check policy presence on a per-PR basis for user-facing tables.

**Alternatives considered.**
- *Trust middleware* — single point of failure; one missed `church_id` filter and the whole thing leaks.
- *Postgres roles per tenant* — operationally heavy at small N; revisit if we hit 10k+ tenants.

---

## ADR-004 — Supabase region: Canada (Central)

- **Date:** 2026-05-25
- **Status:** Proposed (pending Supabase project provisioning)

**Context.** VWS is the lead pilot. Banking data, KYC artifacts, and Canadian PII may flow through. Choosing the wrong region forces an expensive migration before launch.

**Decision.** New Supabase project must be created in `ca-central-1` (Canada Central). Existing dev project, if not in this region, will be re-created and migrated before any production data lands.

**Consequences.**
- Latency from US users is acceptable (single-digit ms over the AWS backbone).
- Compliance posture for Canadian customers is materially better.
- US-specific features (some Vercel edge regions, certain third-party integrations) may show marginal latency increases.

**Alternatives considered.**
- *US East (Virginia)* — closer to most third parties, but worse for Canadian residency.
- *Multi-region* — premature; revisit when MRR justifies the operational cost.

---

## ADR-005 — Single ledger table; Stripe and i2c are sources

- **Date:** 2026-05-25
- **Status:** Proposed (Sprint 3)

**Context.** We will run two financial event streams (Stripe for giving + SaaS; i2c for interchange). Reconciliation is the hard problem. If each stream has its own table, totals will silently disagree.

**Decision.** One `ledger_entries` table. Append-only. `source ∈ {'stripe', 'i2c', 'manual'}`, `source_event_id` UNIQUE, RLS denies UPDATE and DELETE. Every webhook handler writes exactly one row per accepted event. A reconciliation cron compares ledger totals to the source-of-truth dashboard nightly.

**Consequences.**
- Every financial query goes through one table — easier to audit, easier to total, easier to back up.
- Mistakes are reversed by writing a correcting entry, not by editing. Auditor-friendly.
- Webhook handlers must be idempotent. We must accept duplicate webhook delivery as a real case.

**Alternatives considered.**
- *Separate tables per source* — easier to model individually, but reconciliation becomes a manual ritual.
- *Event sourcing with projections* — overkill for the current scale. Revisit at 100k+ entries/day.

---

## ADR-006 — Fail-closed defaults across auth, RLS, and budgets

- **Date:** 2026-05-25
- **Status:** Accepted

**Context.** The original audit caught a demo-mode admin bypass. The fix landed (`src/contexts/authMode.ts` blocks production with no Clerk key). We will extend the same principle.

**Decision.** Whenever a control's input is missing or malformed, deny rather than grant.
- Missing Clerk key in prod → blocked (already shipped).
- Missing `church_id` on JWT → RLS returns zero rows (Sprint 1).
- Tenant over its monthly AI budget → API returns 402, no model call (Sprint 2).
- Webhook signature missing or invalid → 401, do not log body (existing for Stripe; extend to i2c).

**Consequences.**
- Outages possible when config drifts (e.g., Clerk metadata not populated).
- Cheaper than the alternative (silent data exposure or runaway spend).

---

## ADR-007 — Vercel for V1; AWS Lambda + Fargate deferred

- **Date:** 2026-05-25
- **Status:** Accepted

**Context.** Plan calls for AWS Lambda for webhook ingestion and ECS Fargate for long-running workers. Today, everything runs on Vercel (`vercel.json`).

**Decision.** Stay on Vercel for V1. Use Vercel route handlers for webhooks and Vercel Cron (or Inngest as a free tier) for scheduled work.

**Consequences.**
- Cold-start risk on webhook endpoints (i2c may retry on slow ack).
- One vendor for hosting; lower operational complexity.
- We accept that long-running agents (>10s) need a different home eventually. Logged in `TECH_DEBT.md` with a re-entry trigger: "any agent run exceeding Vercel timeout."

**Alternatives considered.**
- *AWS Lambda + API Gateway now* — adds a deployment target, an IAM model, and a CI lane. Not worth it for the current load.

---

## ADR-008 — AWS Secrets Manager for production secrets

- **Date:** 2026-05-25
- **Status:** Proposed (Sprint 0, Day 3)

**Context.** Secrets currently live in Vercel Environment Variables. This works but does not give us rotation, audit, or cross-env consistency. SOC 2 expects centralized secret management.

**Decision.** Production secrets live in AWS Secrets Manager. Vercel pulls them at build/deploy via a sync step (or runtime via signed request from the API). `.env.example` documents every key. Development uses `.env.local`, never committed.

**Consequences.**
- One more dependency (AWS account already required for billing alerts).
- We get rotation, versioning, and audit logs.
- Local dev still uses `.env.local`; we never gate developer productivity on a network round-trip to AWS.

---

## ADR-009 — Token-usage tracking is mandatory for every inference call

- **Date:** 2026-05-25
- **Status:** Proposed (Sprint 2)

**Context.** Three previous AI projects in this codebase's lineage have had runaway-cost incidents. The fix is structural, not a memo.

**Decision.** Every call through the AI gateway writes one row to `token_usage`:
`(church_id, model, prompt_tokens, completion_tokens, cost_micro_usd, feature, created_at)`.
Per-tenant monthly budget cap defaults to $50. At 100% the gateway returns 402; at 110% all calls are hard-cut. An hourly cron flags burn >5× the trailing 7-day average to Sentry.

**Consequences.**
- One extra DB write per inference. Negligible.
- We can answer "what does this tenant cost us?" in one query.
- Budgets can be raised per tenant via an admin UI; the default is a safety net, not a sales constraint.

---

## ADR-010 — Logging via Sentry; analytics + flags via PostHog

- **Date:** 2026-05-25
- **Status:** Proposed (Sprint 0, Day 2)

**Context.** Currently `console.*` only.

**Decision.** Server and client errors → Sentry. Feature flags and product analytics → PostHog. Both are wired in Sprint 0 Day 2 with kill-switch env vars (`VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`).

**Consequences.**
- Two paid services; estimated combined cost <$50/month at current scale.
- Adds two SDKs to the client bundle; offset by lazy-loading PostHog.

---

## ADR-011 — Shared backend foundation: RBAC table model over role-string checks

- **Date:** 2026-07-13
- **Status:** Accepted

**Context.** The existing `users.role` column (`admin`/`pastor`/`staff`/`volunteer`/`member`) is a coarse, five-value model. The WorkOS shared-platform requirement calls for 13 distinct roles with module/action/sensitivity-scoped permissions, enforceable server-side, never via hidden UI — a role string alone can't express "Finance sees giving but not care" and "Pastoral Care sees care but not giving."

**Decision.** Add a full RBAC table set (`roles`, `permissions`, `role_permissions`, `user_roles`) alongside — not replacing — the existing `users.role` column. `users.role` remains the coarse legacy signal (still read by pre-existing routes via `requireRole`); the new `permissions` model is what every new WorkOS route (`requirePermission()`) actually checks. Migration path for legacy routes to adopt the finer model is opt-in per route, not a forced cutover.

**Consequences.**
- Two authorization signals exist simultaneously for a transition period: `users.role` (legacy) and `user_roles`/`permissions` (new). Documented in `SHARED_BACKEND.md` "Known gaps."
- No migration risk to existing routes — nothing about `users.role` changed.
- New routes get real module/action/sensitivity granularity from day one.

**Alternatives considered.**
- *Widen `users.role` to 13 values* — rejected: a single-role-per-user column can't express "Ministry Leader for Youth AND Volunteer Coordinator," which the spec requires (`user_roles` supports multiple simultaneous role grants, optionally ministry-scoped).
- *Rewrite existing routes to the new model immediately* — rejected as out of scope for a foundation-only phase; logged as a `TECH_DEBT.md` follow-up instead.

---

## ADR-012 — RLS as defense-in-depth on Work Orders/approvals only, not every new table

- **Date:** 2026-07-13
- **Status:** Accepted

**Context.** ADR-003 established RLS as a second layer behind application-level tenant scoping, not the sole control — because the Clerk↔Supabase JWT wiring described in `TECH_DEBT.md` TD-001 is not confirmed complete in production. The new shared-platform tables inherit the same constraint: a `church_id`-only RLS policy is real (tenant isolation works whenever the JWT claim is present), but a *permission*-aware policy needs the JWT to carry enough to resolve a `users.id`, which is one hop further than `get_church_id()` alone.

**Decision.** Give every new table tenant-only RLS (migrations 031–037), matching the existing pattern. Additionally give `work_orders` and `approvals` — the two tables where a leak has the highest consequence (internal-only by explicit product requirement) — permission-aware RLS via `public.user_has_permission()` (migration 038) as defense-in-depth, on top of the API-layer `requirePermission()` check that is the actual primary control. Do not extend permission-aware RLS to every table in this phase.

**Consequences.**
- `work_orders`/`approvals` are protected twice; a bug in either layer alone doesn't leak them.
- `care_requests`, financial tables, and communications tables rely on the API layer alone for role-based restriction (tenant isolation via RLS still applies) — acceptable because the API layer is already the primary control everywhere per ADR-003, but logged as a `TECH_DEBT.md` follow-up to extend the pattern.

**Alternatives considered.**
- *Permission-aware RLS on every new table now* — rejected: meaningfully more migration surface for a foundation phase, and the marginal safety gain over the API-layer check is smaller for lower-consequence tables. Revisit if/when the Members Portal starts issuing its own Supabase-scoped requests instead of going through the API exclusively.
- PII redaction must be configured in Sentry (`beforeSend`) before any production traffic.

---

## ADR-013 — Voice/document intake: draft-only, into the existing quick-capture review gate

- **Date:** 2026-08-29
- **Status:** Accepted (phase one only — browser-native voice into `QuickNote`. Bulletin/document OCR and any server-side transcription provider remain Proposed and need this ADR revisited before either ships.)

**Context.** A staff member's hands are often not free to type — during a hallway conversation, driving between visits, or right after a phone call. The product ask is optional voice dictation and document/OCR extraction feeding GRACE, with non-negotiable safeguards: review before save, explicit disclosure, tenant-scoped handling, defined retention, no automatic creation of authoritative pastoral records, no training on sensitive care content without explicit policy, and a clear distinction between raw source, AI draft, and human-approved record. This ADR is discovery, not a green light to wire a transcription or OCR provider — no model integration ships from this decision.

**Decision.**

*First use case, and only this one for phase one:* "turn a staff voice note into a draft follow-up." Specifically `add_note` from the existing action catalog (`api/_lib/actionCatalog.ts`) — already `consequence: 'low'`, editable, non-authoritative, and already reachable from the command palette (`paletteActions.ts`, this session's Do Launcher slice) via `QuickNote.tsx`, an empty modal the staff member fills in and submits themselves.

That existing modal *is* the review gate this feature needs, not a new one to build. And — this is what makes phase one buildable as more than a stub — **GRACE already has a working, shipped voice-capture mechanism**: `useVoiceInput` in `src/components/AskGrace.tsx` wraps the browser's own `SpeechRecognition` API (Web Speech API). No audio is ever sent to a GRACE-controlled server or any AI provider — the browser (Chrome/Safari/Edge's own built-in recognizer) does the speech-to-text, and only the resulting text string reaches the app. This is a genuinely different, lower-risk data flow than a server-side transcription integration, and it's why the safeguards below are achievable without a new provider relationship: extract that hook into `src/hooks/useVoiceInput.ts` (it's currently private to `AskGrace.tsx`) so `QuickNote.tsx` can reuse it, add a mic control that appends recognized speech into the existing `content` textarea, and change nothing else — the transcript lands in the same field the staff member would have typed into, and nothing reaches `notes` until they press the modal's own Save.

Bulletin/document OCR and meeting-note service-planning drafts are explicitly deferred past phase one — see Alternatives. So is any *server-side* transcription provider (Whisper, a Gemini audio input, etc.) — phase one's data-flow story only holds because there isn't one yet.

*Consent:* a persistent, always-visible disclosure line under the field while the mic control is present — not a one-time dismissible toast, since "explicit" should mean seen every time, not seen once and forgotten. Says plainly that the browser's own speech recognition is doing the listening, that nothing is sent to GRACE until Save is pressed, and that leaving means nothing was recorded. The mic control is hidden entirely (not shown disabled) in a browser without Web Speech API support — never a false promise.

Formal, trackable consent (a real `ConsentType` row, the same shape member-facing consent already uses in `src/types/shared-platform.ts` / `/api/consents` / `usePortalConsents.ts`, extended to a staff actor) is deferred to whenever phase two adds a data flow actually worth formally consenting to — a server-side provider, or persisted raw audio. Phase one's data flow is "browser API a user already implicitly consents to by clicking a mic icon and speaking into it," the same posture `AskGrace.tsx`'s existing voice input already has today with no separate consent record.

*Data flow:* voice → browser's own recognizer → text → the modal's `content` state → (only on Save) the `notes`/`interactions` table, unchanged from typing. No audio is captured, buffered, or transmitted by GRACE code at any point — `MinimalRecognition` in `AskGrace.tsx` only ever receives a `transcript` string from the browser, never audio data.

*Retention:* nothing new to retain — there is no raw-source row, because there is no raw source GRACE ever holds. The transcript lives only in the textarea's in-memory state until Save or Cancel.

*Training:* not applicable to phase one for the same reason — GRACE never receives the audio, so there is nothing for GRACE (or any provider we integrate) to train on. This ADR's "no training without explicit policy and consent" commitment becomes load-bearing the moment phase two introduces a real audio upload.

**Consequences.**
- Phase one ships zero new database tables, zero new API routes, and zero new third-party integrations — the only new code is one extracted hook and one mic control on one existing modal.
- Because there's no server-side speech step, phase one cannot do anything a `SpeechRecognition`-capable browser doesn't already do — no higher accuracy, no background/offline capture, no non-English-if-the-browser-doesn't-support-it. Real server-side transcription (better accuracy, works where Web Speech API doesn't, e.g. some desktop Safari/Firefox builds) is a phase-two decision with a real third-party data flow and needs this ADR revisited, not silently extended.
- The distinction between raw source / AI draft / human-approved record is enforced by what does *not* exist yet: no raw-source row, no draft row, only the modal's in-memory state until a human's Save makes it a record.
- Bulletin OCR is not available in phase one even though the product ask lists it — a real gap if a pastor's first request is "read me this flyer," not "take dictation."

**Alternatives considered.**
- *Auto-create the note directly from the transcript, skip the modal* — rejected outright: this is exactly the "automatic creation of an authoritative record" the guardrails forbid, and it is also the one place a misheard word becomes a wrong fact on file with no human having looked at it.
- *Bulletin/document OCR first instead of voice* — rejected for phase one. A photographed bulletin or sign-in sheet is more likely to contain other people's names, faces, and — for a children's ministry check-in sheet — minors, than a staff member's own dictated sentence; the sensitivity profile is worse, and there's no equivalent "browser already does this locally" option for OCR the way there is for speech, so it would be phase one's first real new provider relationship. Revisit once the consent/data-flow pattern for a genuine provider integration exists.
- *Wire a real server-side transcription provider now* — rejected: the prompt that generated this ADR explicitly asks for discovery before build, and this is the one place that line is easy to blur, since "just call Whisper" is a small diff. The browser-native path was chosen specifically because it lets phase one ship something real without crossing that line.
- *A dedicated intake review queue (raw capture → pending → approved), separate from the quick-capture modals* — rejected for phase one as more surface than the safeguards require. Revisit if a future use case needs to survive across a browser session (e.g. a long meeting note drafted over several minutes) rather than fitting in one capture-then-review pass.

---

## ADR-014 — Grace staff memory (Memory V1: "Grace Remembers Me")

- **Date:** 2026-08-30
- **Status:** Accepted
- **Amendment (2026-08-30, same day):** the model service now calls Anthropic Claude (`claude-haiku-4-5-20251001` via `api/_lib/ai/adapters/claude.ts`) instead of Gemini, for both the chat turn and the extraction pass — swapped after hitting Gemini's free-tier daily quota mid-testing. This is exactly the swap the gateway/adapter architecture was built to make cheap: two call sites (`api/grace/_chat.ts`, `api/_lib/grace-memory.ts`'s `runExtraction`) changed which adapter they invoke; nothing about the gateway, budget tracking, or memory logic changed. Streaming support was added to the Claude adapter (`callClaudeStream`) to match; pricing added to `api/_lib/ai/pricing.ts` (Haiku 4.5 rate carried over from Haiku 3.5 as a placeholder — verify against Anthropic's current pricing before real volume).

**Context.** Ask GRACE (staff chat) has no server-side conversation state at all today: history is the last 6 messages string-joined client-side per turn, and the only "memory" is `src/lib/grace-brain.ts`, a `localStorage` list of literal "remember that…" strings — per-browser, unscoped by church or user, lost on cache clear, with no provenance. The product goal (`docs/GRACE_INTELLIGENCE_LAYER.md` §7 step 3, "unify understands") is a shared context object; this ADR is the first concrete slice: a staff member states something once ("my meeting with Bill is Thursday"), closes the browser, and Grace still knows it the next day, without that fact being confused for a church database record.

**Decision.** Add three new tables — `grace_conversations`, `grace_messages`, `grace_memories` — scoped by both `church_id` and `user_id` (never shared across users, never shared across churches). `grace_memories.source` is `user_stated` (explicit "remember that…", deterministic, no model call) or `ai_extracted` (a small post-turn extraction pass over what the staff user said about their own plans/commitments). A named CHECK constraint (`grace_memories_provenance_consistent`, mirroring `agent_actions_origin_run_consistent` from migration 071) makes an `ai_extracted` row without a source message impossible — provenance cannot be misreported. Extraction is explicitly restricted to facts the staff user asserted about themselves; it must never record an AI-formed judgment, inference, or score about a church member, per the boundary this ADR extends from ADR-013 into `docs/AI_BOUNDARIES.md`.

Memories are supplementary context, never authoritative data: they are injected into the prompt in a clearly labeled block ("things this staff member told you earlier — may be stale; if it conflicts with the live church data above, the church data wins"), and the memory-writing code path never touches `people`, `interactions`, or any other church-record table. RLS on all three tables is SELECT-only, scoped to `church_id = get_church_id() AND user_id = get_app_user_id()`, with no write policy — writes are service-role only via the new `api/grace/_chat.ts` route (same posture as `security_events`, migration 062).

The transport moves from the client-composed, gateway-bypassing `api/ai/_generate.ts` call to a new turn endpoint that routes through `api/_lib/ai/gateway.ts` (budget + moderation + usage — the "model service" chokepoint), keeping the client's existing church-data composition to avoid the larger rebuild of porting `buildDataContext` server-side (tracked as tech debt below). Streaming is preserved by adding `generateStreamed` to the gateway; because moderation cannot redact already-sent chunks, output moderation on the streaming path is post-hoc and log-only, not blocking — a known, accepted gap versus the non-streaming gateway path, which redacts before the caller ever sees the text.

**Consequences.**
- Cross-session recall works: a staff member's stated facts survive a closed browser and a new day, scoped to that individual and that church.
- The staff chat route finally goes through the gateway (budget, moderation, usage-metered as `ask-grace`), closing the bypass noted in `ARCHITECTURE.md` §7 and `DEMO_BRIEF.md`.
- Member portal assistant is explicitly out of scope — it stays non-persistent per its stated privacy posture (`api/portal/_assistant.ts`, `docs/AI_BOUNDARIES.md`).
- Client-composed church-data context (`GraceChatContext.buildDataContext`) remains a client→server trust boundary for one more phase; logged in `TECH_DEBT.md` as the next thing to retire once server-side composition (`api/_lib/ai/assistant-runtime.ts`'s pattern) is worth the rebuild.
- No embeddings/pgvector in V1 (not installed on the live project) — retrieval V1 is recency + Postgres full-text search + person-name entity matching, deliberately "nothing fancy" per the product brief. The schema is written so an `embedding vector(768)` column can be added additively later without a breaking migration.

**Alternatives considered.**
- *Full server-side prompt composition now* (retiring the client-composed context in the same change) — rejected: meaningfully larger diff than the memory feature itself needs, and the founder was explicit about not rebuilding what already works. Deferred, tracked in `TECH_DEBT.md`.
- *Tool-call retrieval (`callGeminiWithTools`, deciding when to "go look")* — rejected for V1: doubles latency, complicates the streaming path, and always-injecting a small ranked memory set already satisfies the acceptance story deterministically and more cheaply. Revisit once memory volume per user makes always-inject noisy.
- *Church-shared memory ("Grace Knows the Church")* — explicitly the next milestone, not this one. Scoping by `user_id` in V1 keeps the two concerns (what I told Grace vs. what the church's data says) from bleeding into each other before the second milestone defines how shared knowledge should actually work.

## ADR-015 — Central Henderson church knowledge (Grace Knows the Church, phase one)

- **Date:** 2026-08-30
- **Status:** Accepted

**Context.** ADR-014 named "church-shared memory (Grace Knows the Church)" as the next milestone after per-user memory, deliberately deferred. Sean supplied a real, pre-reviewed source — a metadata extract from Central Christian Church's audited FY2024 financial statements, already hand-scoped to the facts safe to attribute to Central Henderson specifically (catalyst-church identity, mission, four-part strategy, ownership path) plus explicit guardrails on what is NOT Henderson-specific (all consolidated financials, other-campus/affiliate activity). This ADR is that milestone's first slice: one church, one pre-vetted static source, not a general ingestion pipeline.

**Decision.** New table `grace_knowledge` (migration 076), church-scoped (`church_id` only, no `user_id` — shared across every staff member at a church, unlike `grace_memories`). Unlike Memory V1, this table has **no runtime write path at all**: every row arrives via migration, never via the app — it is reference data, not conversation-derived data. `category='scope_boundary'` rows store the source's own guardrail language (what must never be treated as Henderson-specific) and are always retrieved and injected regardless of query relevance — the enforcement mechanism, not a bolt-on. No dollar figures, attendance counts, or debt numbers were ever written into the migration; the source metadata itself never contained them, so there is nothing in the database to leak by omission.

Retrieval (`api/_lib/grace-knowledge.ts`) mirrors `grace-memory.ts`'s union-and-inject pattern: recency-free since the set is small and static, always-include for `scope_boundary` rows, plain Postgres full-text search (no embeddings, same posture as ADR-014) for everything else. The prompt block (`buildKnowledgeBlock`) instructs the model to answer conversationally rather than reciting the block verbatim, attaches each fact's `source_label` for attribution, and appends a static guardrail footer — including an explicit "do not use outside/general knowledge you may have about this organization" line, since Central Christian Church is a real, publicly documented organization the model may already have training-data opinions about independent of this table.

RLS is SELECT-only, scoped `church_id = get_church_id()`, no write policy — same posture as `grace_memories`/`security_events`. Wired into `api/grace/_chat.ts`'s existing prompt composition (`dataContext` → `knowledgeBlock` → `memoryBlock` → history → question), unchanged elsewhere: the "remember that…" short-circuit and `runExtraction` never touch this table.

**Consequences.**
- Grace can answer identity/mission/strategy/ownership-path questions about Central Henderson conversationally, source-attributed, without the raw fixture JSON ever reaching the prompt.
- Grace declines rather than invents when asked for a Henderson-specific financial/attendance/debt figure — because no such data exists in the table to retrieve, and the guardrail footer instructs the model not to substitute the consolidated figures or its own general knowledge.
- **Guardrail via omission stops data leakage, not model recall** — an accepted risk, not a closed one. Never seeding FY2024 figures prevents this system from being the source of a fabricated Henderson number, but does not prevent the model answering from general/training knowledge if the prompt instruction doesn't hold; this is a prompting-level control, not a data-level one. If this matters more once real usage starts, the natural next step is the deterministic-scan pattern this codebase already uses elsewhere (`detectCrisisLanguage()`, `api/_lib/careSafety.ts` — keyword-matched, not model-based): a post-hoc regex scan of the streamed reply for dollar/attendance-figure patterns co-occurring with "Henderson," logged or soft-blocked the same way `generateStreamed`'s existing post-hoc output moderation works. Not built now.
- One-church, no admin UI: adding, correcting, or retiring a knowledge row requires a new migration. Tracked in `TECH_DEBT.md` (TD-063).
- No live-DB proof RLS itself restricts `grace_knowledge` reads — same pre-existing gap `grace_memories`' own test suite has (`tests/fixtures/mockSupabase.ts` resolves `.eq(...)` as a no-op keyed only by table name); the guarantee comes from the RLS policy plus `actor.churchId` being server-resolved from the verified Clerk token, never client-supplied, verified at the SQL level rather than the vitest level.

**Alternatives considered.**
- *A general multi-church knowledge-ingestion pipeline* — rejected for this slice: no second church has a reviewed source yet, and building ingestion tooling for a fixture set of ten rows is premature. Revisit if a second church needs this.
- *Embeddings/pgvector retrieval* — rejected, same reasoning as ADR-014: not installed on the live project, and a bounded, human-curated row set doesn't need semantic search to be relevant.

## ADR-016 — GRACE Intelligence Qualification Framework (standing evaluation model)

- **Date:** 2026-08-31
- **Status:** Accepted

**Context.** Fixture #001 (ADR-015) proved a reusable pattern for testing what Ask GRACE knows and how it applies that knowledge, source-scoped and provenance-tracked. This ADR generalizes that pattern into a standing evaluation framework for future GRACE intelligence work, so capability claims about staff Ask GRACE can be qualified against a shared taxonomy instead of asserted ad hoc.

**Decision.** Adopt the framework documented in [`docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md`](docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md) as the standing qualification standard for staff Ask GRACE (`api/grace/_chat.ts`) going forward: 10 knowledge domains × 7 knowledge-sophistication levels (KNOW → REMEMBER → CONNECT → INTERPRET → RECOMMEND → ACT → ANTICIPATE), 9 cross-cutting judgment axes, and a deterministic-vs-live-judgment scoring model. This is a **second, independent axis** from the existing GRACE operational/accountability loop (`docs/GRACE_INTELLIGENCE_LAYER.md`'s sees → understands → proposes → decide → acts) — knowledge sophistication is not the same question as who is allowed to act, and the two are not to be collapsed into one scale.

This ADR explicitly does **not** redefine ADR-014 (Memory V1) or ADR-015 (Central Henderson church knowledge). Those remain the source of truth for what is actually built and how it works; this ADR only establishes how future capability claims about Ask GRACE get qualified and tested. Scope matches ADR-014/015: staff Ask GRACE only, not the member portal assistant, the demo companion, or the marketing visual.

**Consequences.**
- New GRACE intelligence work on staff Ask GRACE should be classified against this framework's grid before being described as "done" — a capability is only as proven as its lowest untested level below the claimed ceiling (the "gaps below ceiling" rollup rule).
- The framework document carries a dated "Capability Baseline" section reflecting only what is actually proven by a passing test, updated incrementally as new fixtures land — not the grid's broader T/P/F design classification.
- Live-model-judgment testing (CONNECT/INTERPRET/RECOMMEND's reasoning half/ANTICIPATE) has no infrastructure yet; results from that tier, once built, are tagged advisory and never conflated with deterministic pass/fail.
- Fixtures under this framework must not expand permissions, add actions, or otherwise change product behavior to make a test pass — the fixture measures the current system, it does not define the intended answer in advance.
- The framework's deterministic tier is implemented as reusable infrastructure in `tools/eval-harness/` (a fixture-agnostic `EvalCase`/runner engine, plus Fixture #001 and #002 represented as cases without weakening their original `.test.ts` assertions) — see the framework doc's "Evaluation harness" section.
- The framework's live-judgment tier (`tools/eval-harness/live-judge/`) makes real, paid Claude calls and is deliberately excluded from CI — every result is `advisory`, never a build gate, run manually via `npx tsx --env-file=.env.local tools/eval-harness/live-judge/run.ts`. It samples each scenario N times (`--samples`, default 3) and reports an aggregate pass rate rather than a single non-deterministic result — real usage has already shown two of three scenarios varying meaningfully run-to-run.

**Alternatives considered.**
- *Score capability on a single ladder combined with the accountability loop* — rejected: conflates "does the model understand this" with "is the system allowed to act on it," which are genuinely different failure modes with different fixes.
- *Skip a written framework and evaluate capability case-by-case* — rejected: Fixture #001 already showed the case-by-case pattern generalizes cleanly; writing it down once avoids re-deriving domain/level definitions for every future fixture.

## ADR-017 — GRACE Capability Self-Awareness & Truthful Boundary Layer

- **Date:** 2026-08-31
- **Status:** Accepted

**Context.** ADR-016's Pilot Capability Manifest (Prompt 8) gave the *system* a machine-readable record of what's actually been qualified. GRACE herself had no equivalent — her answers to "what can you do / know / access / remember / act on" came from persona prose and model intuition, with no server-side grounding. An inspection of `src/lib/grace-chat/adminPersona.ts` found real overclaiming: the persona's opening line named "Sunday prep" and "agents" (WorkOS/Decision Queue) as domains GRACE helps run, though both have near-zero qualified capability (`docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md`'s own grid; `dg-workos-decision-queue-visibility`).

**Decision.** GRACE's claims about her own capability must be grounded in server-resolved qualified capability, runtime availability, and actor authority — never model self-assessment. Three questions stay structurally separate and are never conflated into one yes/no:
- **A. Qualification** — has this passed the GRACE qualification system? (`api/_lib/capability-manifest.ts`'s PROVEN entries — a duplicated, production-owned copy of Prompt 8's eval-harness manifest, cross-checked for drift by `api/_lib/grace-capability.test.ts`, never an import from `tools/eval-harness/` into production code)
- **B. Runtime availability** — is it live in the deployment serving this request? (`CapabilityManifestEntry.runtimeAvailable`, checked independently of qualification)
- **C. Actor authorization** — is this authenticated user allowed to use it? (`actor.permissions`, server-resolved by `resolveStaffActor`, never client-submitted)

A deterministic Capability Claim Resolver (`api/_lib/grace-capability.ts`) computes structured results (`qualified` / `permission_required` / `approval_required` / `partial` / `unavailable` / `prohibited` / `unknown`) from these three inputs. The model expresses the result conversationally; it does not invent the status. A server-composed Capability Context block (`buildCapabilityContext`) is injected into every Ask GRACE prompt — always present, never gated by a meta-question classifier, so adversarial phrasing that evades the classifier still hits real grounding. It is tenant-gated: only an actor whose `churchId` matches the manifest's qualified church (Central Henderson) receives its specific proven-capability claims; every other church gets a generic, honest "no qualified evidence yet" fallback. Absolute policy prohibitions (`PROHIBITED_CAPABILITIES` — e.g. spiritual-state scoring, banned by `docs/AI_BOUNDARIES.md`) are checked before every other table and cannot be overridden by evidence, permission, or conversational pressure.

Prompt composition order: `dataContext → knowledgeBlock → memoryBlock → capabilityBlock → history → question`. This ADR does **not** change source precedence — live authoritative data still outranks static church knowledge, which still outranks supplementary memory. Capability awareness is a separate axis answering a different question ("what am I allowed to do") layered after that chain, never overriding it.

**Consequences.**
- Persona overclaiming was corrected narrowly: the domain-enumeration line in `adminPersona.ts` no longer names "Sunday prep" or "agents," and now points to the capability boundary block as authoritative rather than itself. The giving-vocabulary coaching (`SPEAK THE CHURCH'S FINANCIAL LANGUAGE...pledges...campaigns...funds`) was reviewed and left untouched — it is already a tracked, needed-for-pilot discovery item (`dg-giving-persona-vocabulary-mismatch`) pending a real workshop decision; the new `cap-giving-detail` known-gap entry now corrects it at the self-awareness layer regardless, without bypassing the discovery→decision→implementation lifecycle ADR-016/the requalification engine established.
- A dedicated qualification suite (`tools/eval-harness/central-henderson-exam/self-awareness/`, 17 cases) covers broad/positive/approval/permission-denied/partial/not-yet-proven/prohibited capability questions, safe "why can't you" explanations, capability-vs-data routing, memory-provenance non-interference, cross-tenant isolation, forged-permission and prompt-injection resistance, and capability understatement — deterministic wherever the claim is about prompt composition, `requiresLiveJudgment` with no `run()` where only a live model call could prove reply quality.
- No new GRACE capability was introduced. Every PROVEN manifest entry cites real, existing, passing, non-architectural-finding qualification evidence from the Central Henderson exam.
- This layer does not supersede ADR-014 (memory authority) or ADR-015 (church-knowledge authority) — it is a bounded, additive context layer alongside them, scoped like both to staff Ask GRACE only.

**Alternatives considered.**
- *Put the manifest in the prompt and let the model interpret status freely* — rejected: item 8's explicit requirement is a deterministic resolver: "the model may conversationally express the result, but it must not invent the status."
- *Import the eval-harness (Prompt 8) manifest directly into `api/_lib`* — rejected: production code must never depend on `tools/` (test/eval infrastructure); duplicated with a drift-detecting cross-check instead, the same discipline `_henderson-knowledge-seed.ts` already established.
- *Gate the capability block on the meta-question classifier* — rejected: a classifier that fails open (never includes the block) would let adversarial phrasing route around grounding entirely; the block is unconditional, and the classifier only adds emphasis.
