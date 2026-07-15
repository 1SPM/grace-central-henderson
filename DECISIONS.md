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
