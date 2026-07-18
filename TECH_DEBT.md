# TECH_DEBT.md

> Every shortcut we knowingly take. Every shortcut has an owner and a re-entry trigger.
> If you take a shortcut and do not log it here, the next person treats your shortcut as design.

**Severity scale**
- **P0** — must be resolved before any production tenant is onboarded
- **P1** — must be resolved before any production *banking* tenant is onboarded
- **P2** — must be resolved before SOC 2 audit (~Week 22)
- **P3** — nice to have; resolve opportunistically

---

## P0 — Block production launch

### TD-001 — RLS policies are permissive (`USING (true)`)
- **Owner:** Sprint 1
- **Location:** `supabase/migrations/005_row_level_security.sql:147-173`
- **Risk:** A bug in any application query that omits `church_id` filtering leaks data across tenants.
- **Re-entry trigger:** before *any* production tenant is invited beyond the operator's own organization.
- **Status:** Largely in place; two pieces remaining are operator-side, not code.
  - **CI lint deployed** Sprint 0 Day 3 (`tools/lint-rls.ts` + `npm run lint:rls`) — catches new tables created without RLS.
  - **Scoped-policy migration written** Sprint 1 (`supabase/migrations/011_rls_church_scoped.sql`) — replaces every `USING (true)` with `USING (church_id = public.get_church_id())` across 24 direct-FK tables and 4 FK-derived tables. Anchor and audit_logs tables are deliberately not touched (already locked down).
  - **Clerk-aware Supabase client** deployed Sprint 1 (`src/lib/supabase.ts` clerk-aware fetch + `AuthContext` token-provider wiring). Every Supabase request now rides on the Clerk session JWT when signed in.
  - **Cross-tenant smoke test written** (`tools/cross-tenant-smoke.test.ts`) — skips when env vars absent; runs against staging once configured.
  - **REMAINING (operator):** (1) Configure Clerk JWT template `supabase` with `app_metadata.church_id` claim. (2) Configure Supabase third-party auth to trust Clerk. (3) Apply migration 011 to staging → run smoke test → apply to prod. Full procedure in `RUNBOOK.md` RB-011.

### TD-002 — Cross-tenant CI smoke test does not exist
- **Owner:** Sprint 1
- **Risk:** RLS regressions ship undetected.
- **Re-entry trigger:** same as TD-001.
- **Resolution path:** seed two tenants in test DB, sign JWTs for both, assert each can read only its own rows across `people`, `giving`, `prayer_requests`, `audit_logs`.

### TD-003 — `audit_logs` table and middleware
- **Owner:** Sprint 1
- **Status:** **Resolved.** Migration `010_audit_logs.sql` ships the table with append-only enforcement (RLS + trigger). `api/_middleware/audit.ts` writes one row on every successful 2xx mutation, fire-and-forget on `res.finish` so user latency is unaffected. The explicit `audit(req, res, supabase, details)` helper exists for handlers that want before/after diffs (e.g., webhooks writing to the ledger). 13 unit tests pin the row-construction + status-code gating.
- **Remaining:** Per-route `audit()` calls for high-value mutations (Stripe webhooks → ledger writes, user role changes, leader publication) — landing as part of Sprint 3 (ledger) and Sprint 1 part 3 (auth IDOR fixes).

### TD-004 — No webhook idempotency or DLQ
- **Owner:** Sprint 3
- **Location:** `api/_routes/webhooks.ts`
- **Risk:** Stripe retries can double-charge or double-credit the ledger.
- **Re-entry trigger:** before any real payment volume.
- **Resolution path:** `webhook_events` table with `source_event_id UNIQUE`. On signature failure or 5xx during processing, write to `webhook_dlq` with full payload + error. Admin replay UI.

### TD-005 — Secrets in Vercel env, not centralized
- **Owner:** Sprint 0, Day 3
- **Risk:** No rotation, no audit, no per-env separation. SOC 2 finding waiting to happen.
- **Re-entry trigger:** Sprint 0 close.
- **Resolution path:** AWS Secrets Manager (ADR-008). Vercel pulls at deploy time.

### TD-006 — No error monitoring
- **Status:** **Resolved.** `@sentry/react` + `@sentry/node` + `@sentry/profiling-node` installed. Frontend: `src/lib/observability/sentry.ts` — `initSentry()` called first in `src/main.tsx`, `SentryErrorBoundary` wraps the root, PII scrubbed in `beforeSend` (headers, cookies, query strings, email/IP stripped from user context). Backend: `api/_lib/sentry.ts` loaded as the first import in `api/_server.ts`. No-op if `VITE_SENTRY_DSN` / `SENTRY_DSN` env vars are not set. `setSentryUser` called from `AuthContext` on every auth state change (opaque IDs only).

---

## P1 — Block banking-data tenants

### TD-007 — No `token_usage` ledger or per-tenant AI budget cap
- **Owner:** Sprint 2
- **Status:** **Largely resolved.** Migration `012_token_usage.sql` ships the append-only usage ledger + `church_ai_budgets` cap table (default $50/mo, 1.10× hard-cut multiplier). `api/_lib/ai/gateway.ts` enforces the cap before every inference. `api/_lib/ai/pricing.ts` has per-provider rates as of 2026-05-25. 67 unit tests including the **synthetic burn test** that satisfies the Sprint 2 exit gate ("triggers cutoff at $0.01 over budget").
- **Routes wired (Sprint 2 Part 2):** `api/grace/draft-reply.ts` now calls every Gemini inference through the gateway with `feature='draft-reply'`, plus opt-in input + output moderation.
- **Moderation pipeline (Sprint 2 Part 3):** `api/_lib/ai/moderation.ts` wraps OpenAI's free `omni-moderation-latest`. Gateway runs INPUT moderation pre-call (flagged → refuse before tokens), OUTPUT moderation post-call (flagged → redact + flip success to false). No-op without `OPENAI_API_KEY`, fails OPEN on moderation outage.
- **Multi-provider adapters (Sprint 2 Part 3):** `api/_lib/ai/adapters/{gemini,claude,openai}.ts` each return `ProviderCallResult` and never throw. Claude + OpenAI require their respective API keys; they return a clean failure (`claude_no_key` / `openai_no_key`) when missing.
- **Anomaly cron (Sprint 2 Part 3):** `api/cron/ai-anomaly.ts` runs hourly per `vercel.json` `crons` config. Compares last-hour spend per tenant to trailing 7-day hourly average; fires a Sentry warning when ratio ≥ 5× AND last-hour spend ≥ $0.10. Auth via `requireCronAuth` (shared helper, `api/_lib/cronAuth.ts` — see the cron-auth incident under Resolved). `detectAnomaly` math extracted as a pure function with 9 unit tests.
- **Remaining:** `api/ai/generate.ts` (Ask Grace entry) still calls Gemini directly because it has no auth and therefore no church_id resolution. Tracked as TD-033 below.

### TD-036 — Sign-up flow dead-ends when Stripe is not configured
- **Status:** **Resolved** (2026-06-18). Added `POST /api/billing/activate-trial` — sets `subscription_status = 'trial'` and `trial_ends_at = now + 14d` directly in Supabase. Safety gate: returns 501 when `STRIPE_SECRET_KEY` IS set (cannot be used in production to bypass payment). `SignUpFlow.tsx` now catches `create-checkout-session` 503 with `error: 'stripe_not_configured'` and calls `activate-trial` instead, then redirects to `/welcome`. In Stripe-enabled environments the path is unchanged. Route registered in `api/[...path].ts`.

### TD-035 — `AuthContext` fell back to `DEFAULT_CHURCH_ID` on missing `users` row
- **Status:** **Resolved** (2026-06-18). `AuthProviderInner`'s "create new user" branch previously inserted a row with `church_id: DEFAULT_CHURCH_ID`. With migration 011 RLS active this insert is rejected (JWT has no `church_id` claim before `create-church` runs), leaving the user in a loading state. Fixed: read `church_id` from `clerkUser.publicMetadata.church_id` (set by `POST /api/billing/create-church`). If missing, redirect to `/signup`. `role` also sourced from `publicMetadata.role` instead of hardcoded `'staff'`.

### TD-033 — `api/ai/generate.ts` has no auth / no per-tenant metering
- **Status:** **Resolved** (2026-06-18). `api/ai/_generate.ts` now calls `requireClerkAuth(req)` unconditionally before any AI call. Requests without a valid Clerk JWT receive 401. Budget check and `recordUsage` wired through `auth.churchId` / `auth.clerkUserId`. `src/lib/services/ai.ts` comment updated to reflect mandatory auth.

### TD-008 — No moderation pipeline on AI inputs/outputs
- **Owner:** Sprint 2
- **Risk:** Hostile prompt or model output reaches a pastoral-care recipient. Reputational catastrophe.
- **Re-entry trigger:** before any AI message is sent to a real congregant without staff review.
- **Resolution path:** OpenAI Moderation API on both input and output in the gateway. Block on `flagged`, log to `audit_logs`.

### TD-009 — Unified `ledger_entries` table does not exist
- **Owner:** Sprint 3
- **Status:** **Resolved.** Migration `013_ledger_and_webhooks.sql` ships `ledger_entries` per ADR-005 (append-only via RLS + trigger; UNIQUE(source, source_event_id) at the journal level). `api/_lib/ledger.ts` is the single write surface; corrections enforced (kind='correction' requires metadata.corrects_entry_id). Same migration adds `webhook_events` (idempotency) + `webhook_dlq` (failure replay). Stripe handler refactored into `api/_lib/webhooks/{stripe-handlers,stripe-dispatch}.ts` with a new Vercel route at `api/webhooks/stripe.ts` and the legacy Express route delegating to the same dispatcher.
- **Coverage:** payment_intent.succeeded, invoice.paid (recurring), charge.refunded, customer.subscription.{created,updated,deleted}. Each handler writes the operational row (giving / recurring_giving via upsert on the Stripe id) AND the ledger entry. Duplicate webhook delivery is a no-op past the dedup check. 65 unit tests including full dispatch coverage of happy path + duplicate + handler-skip + DLQ failure + replay flow.
- **Reconciliation:** `api/cron/reconcile-stripe.ts` runs daily 06:00 UTC (vercel.json). Detects volume_spike (≥5× trailing 7-day avg + $1 floor), volume_drop (symmetric), fee_without_credit, no_history_spike. Fires Sentry warning per anomaly. **Stripe Balance API comparison is TD-034** — needs per-tenant Stripe account_id (Connect) before it can compare ledger to actual payouts.

### TD-034 — Reconciliation cron does not yet compare ledger to Stripe Balance API
- **Severity:** P2
- **Location:** `api/cron/reconcile-stripe.ts` + `api/_lib/webhooks/reconcile.ts`
- **Status:** Substrate is in place. The cron currently detects ledger-internal anomalies (volume spike/drop, fees without credits). True reconciliation — "sum of ledger credits for source=stripe yesterday == Stripe payout amount" — needs per-tenant Stripe account_id mapping (we'll get this when Stripe Connect is wired) and an authenticated Stripe Balance API call.
- **Re-entry trigger:** before Stripe Connect goes live in production / before the CFO dashboard ships.
- **Resolution path:** add a `churches.stripe_account_id` column. Extend the cron to call `stripe.balance.list({ created: { gte: yesterday, lt: today } })` per tenant. Compare sum to ledger total. Fire Sentry on >$1 drift.

### TD-010 — CSRF middleware not applied to all auth routes
- **Owner:** Backend Platform (post-Sprint 1)
- **Location:** `api/_middleware/csrf.ts` + status note in `SECURITY_FINDINGS_STATUS.md` §4
- **Risk:** Hostile site can trigger state changes on logged-in users via `/api/auth/*` if those routes are added without the middleware.
- **Re-entry trigger:** any new mutation route under `/api/auth/`.
- **Resolution path:** wire `csrfRequire` middleware globally on POST/PATCH/DELETE; remove ability to opt out.

### TD-011 — Server-side input validation incomplete
- **Owner:** Sprint 1 (people/tasks/prayer write paths)
- **Status:** **Partial resolution (Sprint 7).** Added `api/_lib/validation.ts` — a tiny hand-rolled validator (no external dep, avoiding the lockfile fragility from Sprint 0 D3's npm-audit-fix). 25 tests cover str/email/uuid/bool/int/arrayOfStr + the aggregator. Wired into the two public-internet routes: `api/connect-card.ts` and `api/leader-apply.ts`. These had only `if (!firstName)` checks; now they enforce UUID format on `churchId`, email format, phone format pattern, per-field size caps (firstName ≤ 100, bio ≤ 5000, prayerRequest ≤ 2000), and arrayOfStr caps on tag arrays.
- **Remaining:** the legacy authenticated Express routes (`/api/payments`, `/api/email`, `/api/sms`, `/api/agents`) still validate by hand inside each route. Lower priority than connect-card/leader-apply because those go through `requireAuth` first (Bearer-token-only callers, not anonymous internet). Apply the same validator pattern when each route is next touched.
- **Risk (residual):** internal API routes still accept malformed payloads. Catches: type errors at the DB layer for blatantly wrong types; XSS via rendered fields not blocked.

### TD-021 — No load-test baseline
- **Status:** **Resolved (Sprint 7).** `tests/load/baseline.k6.js` + `.github/workflows/load-test.yml`. Single scenario: 50 VU over 3.5 min, mix of dashboard reads (65%) / financial-hub summary (15%) / connect-card POSTs (15%) / Ask Grace AI (5%). SLO targets asserted via k6 `thresholds`: p95 < 500ms for read endpoints, p95 < 2500ms for AI endpoint, error rate < 1%. Workflow is manual-trigger (`workflow_dispatch`) until a staging URL is pinned.
- **Re-entry trigger:** when staging is up — wire to a weekly schedule and gate nightly merges on it.

### TD-037 — `calendar_events` has no leader assignment column
- **Severity:** P3
- **Location:** schema mismatch with Sprint 5's operations agent
- **Status:** Discovered during Sprint 7 pre-flight against prod. The operations agent's `event_no_leader` signal needs a leader-id column on the events table; `calendar_events` doesn't have one. The runner currently passes `leader_id: null` for every event, which makes the agent flag EVERY upcoming event as no-leader — too noisy to be useful.
- **Mitigation:** the agent still works; the noise is bounded by the 7-day horizon + the dedup window. The other observation kinds (overdue tasks, member care, stewardship) are unaffected.
- **Resolution path:** either (a) add `leader_id` to calendar_events, OR (b) join calendar_events → volunteer_scheduling (if it exists) and treat assigned > 0 as "has leader", OR (c) suppress this observation kind entirely until volunteer assignments land. Pick after Sprint 5 demo feedback.

### TD-022 — Runbook coverage incomplete
- **Status:** **Largely resolved (Sprint 7).** RB-002 (AI spend spike) and RB-003 (Stripe webhook failures) rewritten with the actual queries against `token_usage` / `webhook_dlq` (no longer "table arrives in Sprint X"). Five new entries: RB-012 (AI moderation flagged), RB-013 (DLQ growing), RB-014 (ledger reconciliation anomaly), RB-015 (agent run failed), RB-016 (KYC stuck). All entries have concrete First check SQL + Mitigation steps + Root-cause fix pointers.
- **Remaining:** as new incidents happen, capture them as new RB entries. The skeleton is no longer skeleton-shaped.

### TD-012 — No session timeout
- **Owner:** Auth Platform
- **Risk:** Stolen device retains access indefinitely.
- **Re-entry trigger:** before SOC 2.
- **Resolution path:** Clerk-configured 12-hour absolute, 1-hour idle. Force step-up auth on financial operations.

### TD-013 — Rate limiting coverage incomplete
- **Owner:** Backend Platform
- **Location:** `api/_middleware/rateLimit.ts`
- **Risk:** SMS/email send routes are abuse vectors today.
- **Re-entry trigger:** any public-facing form (online giving, connect card).
- **Resolution path:** apply per-IP and per-tenant limits to `/api/sms/*`, `/api/email/*`, `/api/giving/*`, `/api/auth/invite`. Back with Upstash Redis once provisioned.

### TD-014 — IDOR server-side checks pending
- **Status:** **Resolved** (2026-06-18). Full 28-route audit completed against `api/[...path].ts` dispatch table.
  - **`api/agentmail/_send.ts`** — had no auth gate. Added `requireClerkAuth(req, { allowedRoles: STAFF_ROLES })`. Scoped `people` lookup to `auth.churchId`. `interactions` insert uses `auth.churchId` (no longer from person row). Blocks cross-tenant email sends.
  - **`api/agentmail/_reply.ts`** — had no auth gate. Added `requireClerkAuth(req, { allowedRoles: STAFF_ROLES })`. Added `.eq('church_id', auth.churchId)` to `grace_inbox_messages` query. Blocks cross-tenant reply injection.
  - **`api/grace/_draft-reply.ts`** — had no auth gate. Added `requireClerkAuth(req, { allowedRoles: STAFF_ROLES })`. Added `.eq('church_id', auth.churchId)` to inbox row fetch. Blocks PII read and AI budget drain across tenants.
  - All 25 other routes were already correctly scoped via `auth.churchId` from `requireClerkAuth`.
- **Defense in depth:** RLS migration 011 now enforces `church_id = public.get_church_id()` at the DB layer for all 28 tables.

---

## P2 — Block SOC 2 audit

### TD-015 — No monorepo / boundary lint
- **Owner:** Deferred per ADR-001
- **Re-entry trigger:** second deployable client (mobile, admin panel, partner portal).
- **Resolution path:** Turborepo + pnpm workspaces + dependency-cruiser boundary rules.

### TD-016 — No `packages/auth` abstraction over Clerk
- **Owner:** Deferred per ADR-001
- **Re-entry trigger:** if Clerk pricing forces a swap, or if we need a second auth provider for white-label.
- **Resolution path:** thin internal SDK that exposes only `getCurrentUser()`, `requireRole()`, `getChurchId()`. Today, Clerk SDK is imported directly.

### TD-017 — Webhook ingestion not on AWS Lambda
- **Owner:** Deferred per ADR-007
- **Re-entry trigger:** any webhook handler that times out under Vercel's serverless limit, or volume >100 req/min sustained.
- **Resolution path:** API Gateway → Lambda → SQS → Vercel route for processing.

### TD-018 — Workers not on ECS Fargate
- **Owner:** Deferred per ADR-007
- **Re-entry trigger:** any agent run >10s wall time, or any cron that can't fit in Vercel Cron limits.
- **Resolution path:** Inngest first (cheaper); Fargate when we need long-running stateful workers.

### TD-019 — No CI dependency scanning
- **Owner:** Sprint 0, Day 3
- **Risk:** Known-vulnerable transitive dep ships to prod silently.
- **Resolution path:** Dependabot (free), Snyk free tier, `npm audit --audit-level=high` gate in CI.

### TD-020 — `gitleaks` pre-commit hook (CI gate landed; local hook deferred)
- **Owner:** Sprint 0, Day 3 (CI) / follow-up (local hook)
- **Risk:** Accidental secret commit. We've already had one client-side-key audit finding.
- **Status:** CI gate landed Sprint 0 D3 — `gitleaks/gitleaks-action@v2` runs on every push and PR with `.gitleaks.toml` for project-specific allowlists. **Local pre-commit hook deferred** to keep dev-environment setup friction low; Husky + a hook that runs `gitleaks protect --staged` is the standard path.
- **Re-entry trigger:** when a second developer joins the project, or after the first close call where a secret almost lands.
- **Resolution path:** `npm i -D husky` + `npx husky init` + `.husky/pre-commit` running `gitleaks protect --staged --redact -v`. Document the gitleaks-binary install step in `CONTRIBUTING.md`.

### TD-021 — No load-test baseline
- **Owner:** Sprint 7
- **Risk:** First pilot demo hits unknown ceiling.
- **Resolution path:** k6 scenario: 1000 concurrent users, target 95p < 500ms. Run in CI nightly against staging.

### TD-022 — No runbook for top-10 incidents
- **Owner:** Sprint 0 (skeleton) → Sprint 7 (complete)
- **Resolution path:** `RUNBOOK.md` — start with skeleton today, add an entry every time we resolve an incident.

---

## P3 — Cleanup

### TD-023 — `src/constants.ts` ships sample data into production
- **Risk:** Low — sample data is well-fenced, but it inflates the bundle.
- **Resolution path:** move to `src/test/fixtures/` or behind a build flag.

### TD-024 — Direct Supabase calls from hooks instead of through service layer
- **Location:** `src/hooks/useSupabaseData.ts` and friends
- **Risk:** Refactoring the data layer touches every hook.
- **Resolution path:** introduce `src/lib/data/` as the single import surface; migrate hooks one feature at a time.

### TD-025 — Multi-folder duplication: two `002_*.sql` migration files
- **Location:** `supabase/migrations/002_collection_donation_system.sql` AND `002_leader_onboarding_sessions.sql`
- **Risk:** Migration order ambiguity. Supabase runs alphabetically, so they apply, but the convention is broken.
- **Resolution path:** renumber to `002a` / `002b` or consolidate. Document in a follow-up PR.

### TD-026 — Three-of-six agents from product vision not yet ported
- **Re-entry trigger:** post-funding (per the 18-week plan).
- **Resolution path:** see `PORTING.md` § Agents.

### TD-027 — Blockchain Tier 3 placeholder
- **Re-entry trigger:** never, unless a customer pays for it.
- **Resolution path:** schema fields stay; no integration code in V1.

### TD-028 — Mac Mini Local Node tier
- **Re-entry trigger:** post-funding decision.
- **Resolution path:** not in V1.

### TD-029 — Full WebXR Virtual Worship
- **Re-entry trigger:** customer demand + funding.
- **Resolution path:** static Three.js sanctuary only, and only if Sprint 7 has spare hours.

### TD-030 — Divinity mobile app
- **Re-entry trigger:** post-funding.

### TD-031 — Lint and test failures pre-existing on this branch
- **Status:** **Resolved.** All five issues verified fixed on current branch (2026-06-18 audit):
  - `useGraceInbox.ts` — refs already moved into `useEffect`.
  - `App.tsx` — `no-unused-expressions` no longer present.
  - `useChurchSettings.ts` — unused `_` variable no longer present.
  - `ViewToggle.test.tsx` — test updated to `bg-stone-100`, matches component.
  - `GraceChatContext.tsx` — `exhaustive-deps` warnings suppressed with `eslint-disable-next-line`.

### TD-032 — npm audit findings (partial — see status)
- **Severity:** P2
- **Discovered:** Sprint 0, Day 2 — output of `npm install` after adding Sentry/PostHog.
- **Original state:** 31 vulnerabilities (1 low, 10 mod, 17 high, 3 critical).
- **Sprint 0 Day 3 action:** `npm audit fix` (no breaking changes) cleared the 3 criticals plus 17 of the lower-severity issues. Production-only dependencies are now **clean** (`npm audit --omit=dev --audit-level=high` → 0 vulns).
- **Current state:** 11 vulns remaining (5 mod + 6 high), **all in dev dependencies** (`@vercel/node` and its transitives — `path-to-regexp`, `minimatch`, `undici`, `esbuild` via Vite, `ajv`, `smol-toml`). Fixes require major-version upgrades (`@vercel/node@4`, `vite@8`) that ship with breaking changes.
- **Mitigation in place:** CI gate `npm audit --omit=dev --audit-level=high` (added Sprint 0 D3) prevents new vulns from landing in production deps. Dependabot configured (`.github/dependabot.yml`) to surface major-version upgrades as individual PRs for controlled evaluation.
- **Re-entry trigger:** when Dependabot opens the `@vercel/node@4` and `vite@8` upgrade PRs — evaluate each on its own merits.
- **Resolution path:** triage each major upgrade individually; do not auto-merge.

---

## Shared backend foundation (2026-07-13) — see SHARED_BACKEND.md

### TD-038 — Legacy routes don't call the new `requirePermission()` model
- **Severity:** P1 (blocks finer-grained role separation from being real for existing features)
- **Location:** `api/_middleware/auth.ts` (`requireAuth`/`requireRole`), used by Giving, Payments, Email, SMS, and other pre-existing routes.
- **Risk:** "Financial data must not be exposed to care or communications users" is only actually enforced on the *new* WorkOS routes today. Existing Giving/Payments routes still gate on the coarse `admin`/`staff`/`volunteer` role, not the new 13-role permission model.
- **Re-entry trigger:** the first time a real UI needs one of the new roles (e.g. Finance vs. Communications) to see materially different data on an *existing* screen.
- **Resolution path:** migrate routes to `resolveStaffActor`/`requirePermission` (`api/_lib/authz.ts`) one at a time, same pattern as the new work-orders/approvals/consents routes.

### TD-039 — Permission-aware RLS covers only `work_orders`/`approvals`
- **Severity:** P2
- **Location:** `supabase/migrations/038_shared_foundation_rls_hardening.sql`
- **Risk:** `care_requests`, financial tables, and communications tables rely on tenant-only RLS + the API-layer check for role-based restriction. See DECISIONS.md ADR-012 for why this is an accepted tradeoff for this phase, not an oversight.
- **Re-entry trigger:** before the Members Portal (or any other surface) queries Supabase directly with a user-scoped key instead of going through the API exclusively.
- **Resolution path:** extend the `public.user_has_permission()` policy pattern from migration 038 to `care_requests` (`care.view`), `giving`/ledger tables (`giving_financial.view`), and communications tables.

### TD-040 — `account_status` enforced only on the new WorkOS auth path
- **Severity:** P2
- **Location:** `api/_lib/authz.ts` (`resolveStaffActor`) enforces it; `api/_middleware/auth.ts` (`requireAuth`) does not.
- **Risk:** A suspended/deactivated user with a valid Clerk session can still reach any pre-existing route.
- **Re-entry trigger:** before SOC 2, or the first real account-suspension incident.
- **Resolution path:** add the same `users.account_status !== 'active'` check to `requireAuth`/`requireRole` in `api/_middleware/auth.ts`.

### TD-041 — No `care_requests`/`volunteer_interests` API routes yet
- **Severity:** P3 (schema-only by design this phase)
- **Location:** `supabase/migrations/037_care_volunteer_artifacts_metrics.sql` has the tables + RLS; no `api/care-requests/*` route exists.
- **Re-entry trigger:** first Members-Portal-real or WorkOS-agent feature that needs to create/triage a `care_requests` row.
- **Resolution path:** build `api/care-requests/*` following the exact pattern in `api/consents/_index.ts` (member self-service via `resolveMemberActor` + staff view via `requirePermission('care.view'/'care.manage')`).

### TD-042 — `data_subject_requests` has no fulfillment automation
- **Severity:** P2 (privacy/compliance-adjacent — relates to Phase 4 of `GRACE_Demo_Completion_and_Beta_Critical_Path.md`)
- **Location:** `supabase/migrations/033_consent_communication_preferences.sql`
- **Risk:** A member can submit a data-export or account-deactivation request; nothing automatically fulfills it. Status sits at `pending` until an operator manually processes and updates it.
- **Re-entry trigger:** before marketing this as a real member-facing capability, or before any privacy-policy commitment references a turnaround time.
- **Resolution path:** build the export pipeline (church-scoped data dump keyed by `person_id`) and the deactivation workflow (portal_enabled=false + Clerk account action) as their own Work Order type, dogfooding the Work Order model just added.

## Admin Dashboard WorkOS (2026-07-13)

### TD-043 — `resolveStaffActor` has a demo-mode bypass that grants System Administrator
- **Severity:** P1 (must be confirmed disabled before any real tenant)
- **Location:** `api/_lib/authz.ts` (`resolveDemoStaffActor`, `isDemoModeActive`)
- **Risk:** Every caller to a WorkOS route on a known demo host (`grace-crm-two.vercel.app`, `grace-crm.dev`, `www.grace-crm.dev`) is silently resolved to a real `users` row with the `system_administrator` role — full access to Work Orders, approvals, and every other module. Same "explicit opt-in only" posture as the pre-existing demo-mode auth bypass in `api/_middleware/auth.ts` (formally waived for non-production use in `SECURITY_FINDINGS_STATUS.md` #3).
- **UPDATE (Stage 4 acceptance check, this session):** originally gated solely on the shared `VITE_ENABLE_DEMO_MODE` env var, which caused a real outage — turning that var off to secure `gracecrm-centralhenderson.org` (the correct call) also silently broke every WorkOS route's demo bypass for Faithful, since one Vercel deployment serves both hostnames and can't have the var "on" for one and "off" for the other. `isDemoModeActive(req)` now also auto-activates for the same known-demo hostnames `HOST_CHURCH_IDS` already carves out (mirroring the client-side fix already shipped in `src/config/tenant.ts`) — the env var remains a valid global override, but is no longer the *only* path in. This cannot reopen the bypass for `gracecrm-centralhenderson.org` or any other unlisted host; that hostname will never match `HOST_CHURCH_IDS`.
- **Re-entry trigger:** before Clerk Production is configured for any *new* real tenant — confirm its hostname is never added to `HOST_CHURCH_IDS`/`HOST_TENANTS`.
- **Resolution path:** no further code change needed. Operational checklist: keep `HOST_CHURCH_IDS` and `HOST_TENANTS` restricted to genuinely-demo hostnames only.

### TD-044 — WorkOS route guard is role-based on the frontend, permission-based on the backend
- **Severity:** P3
- **Location:** `src/hooks/useRouteGuard.ts` gates the `'workos'` view by legacy `role` (admin/pastor/staff); the actual module-by-module visibility (Work Orders vs. Approvals vs. Agents vs. Audit) is enforced per-request by `requirePermission()` on each API call, using the new RBAC model from migration 032.
- **Risk:** none functionally (the server is always the real gate — see `SHARED_BACKEND.md` "Authorization model"), but a staff user who can open the WorkOS hub may see empty/403'd panels rather than the hub being hidden entirely, which is a UX rough edge, not a security gap.
- **Resolution path:** once `GET /api/workos/permissions` is established, teach `useRouteGuard` to read it (with a loading fallback) instead of the coarse role check, so panels the user can't use are hidden rather than shown-then-blocked.

### TD-045 — Task reassignment can't clear an owner, only change it
- **Severity:** P3
- **Location:** `api/work-orders/_tasks.ts` PATCH; `src/hooks/useTaskBoard.ts` `reassignTask`
- **Risk:** none (cosmetic limitation) — `api/_lib/validation.ts`'s `uuid_()` validator treats a JSON `null` the same as "field not provided," so `{ owner_user_id: null }` is silently dropped from the update rather than clearing the column. Reassigning to a different real user works fine.
- **Re-entry trigger:** first real request for an "Unassign" action on the Task Board.
- **Resolution path:** add an explicit `clearOwner: true` flag to the PATCH body handled separately from the validated schema, or extend the validator with a tri-state (absent / null-to-clear / value) mode.

### TD-046 — Only 3 of 11 agents have a real workflow
- **Severity:** P3 (explicitly in-scope to defer — see SHARED_BACKEND.md and this phase's completion notes)
- **Location:** `api/_lib/agentWorkflows.ts` implements `grace`, `verity`, `sentinel`; the other 8 registry entries (`shepherd`, `welcome`, `gather`, `serve`, `impact`, `herald`, `steward`, `compass`) are registered with `implemented: false` and correctly show "Not yet implemented" in the Agent Command Centre rather than fabricated activity.
- **Re-entry trigger:** each ministry module (Care, Volunteer, Communications, Finance) as it's built out — the natural next workflow to implement is the one covering the module just shipped.
- **Resolution path:** follow the pattern in `api/_lib/agentWorkflows.ts` — a pure `(supabase, churchId) => AgentWorkflowResult` function reading real tables, no LLM calls required.

### TD-047 — WorkOS demo-mode bootstrap writes a real row into `users`/`user_roles` on first use
- **Severity:** P3
- **Location:** `api/_lib/authz.ts` `resolveDemoStaffActor`
- **Risk:** low — the demo admin user (`clerk_id = 'demo-workos-admin'`) is a real, identifiable, idempotent row (find-or-create), not a leak of real data. But it does mean a demo-mode church accumulates one persistent staff user that wouldn't exist in a from-scratch production tenant.
- **Re-entry trigger:** before treating any demo-mode-seeded database as a template for real tenant provisioning.
- **Resolution path:** none needed for now; if it ever matters, delete `users` rows where `clerk_id = 'demo-workos-admin'` as part of a tenant-reset script.

## Care, prayer, and community safety (2026-07-14)

### TD-048 — "Specific Care Team" for care_requests reuses care_assignments, not a per-request roster
- **Severity:** P3
- **Location:** migration 043 RLS policy "care_requests staff read"
- **Risk:** none identified — a `specific_care_team` request is visible to whoever is assigned via `care_assignments` (already care.manage-gated to create) plus any `care.manage` holder for triage. This is intentionally the same mechanism as the general Work Order pattern, not a new one.
- **Re-entry trigger:** if a church ever wants a *standing* care team (a fixed roster who sees every specific_care_team request without per-request assignment) rather than per-request assignment.
- **Resolution path:** add a `care_team_members` table (church_id, user_id) and OR it into the RLS policy.

### TD-049 — Community posting composer still disabled in the Members Portal
- **Severity:** P3 (intentional, not an oversight)
- **Location:** `src/portal/pages/PortalCommunity.tsx` — moderation_status, community_post_reports, member_blocks, and the full RLS policy set (migration 043) are real and tested, but no portal UI writes a `community_posts` row yet.
- **Re-entry trigger:** first real request for member-authored community posts (blessings/praise reports) — the backend prerequisite work this phase's brief required is done; only the composer + moderation queue UI remain.
- **Resolution path:** build a `usePortalCommunityPosts` hook + composer, defaulting every post to `moderation_status='pending'`; build a staff moderation queue UI consuming `api/community/_reports.ts` + `api/community/_moderate.ts` (both already built).

### TD-050 — `detectCrisisLanguage` is keyword-based, not model-based, by deliberate choice
- **Severity:** P2 (a real limitation, not a bug — see docs/AI_BOUNDARIES.md)
- **Location:** `api/_lib/careSafety.ts`
- **Risk:** false negatives are possible for crisis language that doesn't match the keyword pattern (e.g. non-English, indirect phrasing). This is the same tradeoff already accepted for the identical pattern in `previews/grace-companion.js`.
- **Re-entry trigger:** a real missed-crisis incident, or a deliberate product decision to add a model-based second pass (with its own review — see AI_BOUNDARIES.md's stance that this tradeoff is a policy decision, not a silent upgrade).
- **Resolution path:** if pursued, keep the keyword match as a fast-path/fallback and add a moderation-API-style second check, never replacing the deterministic path outright.

### TD-051 — No staff-facing UI yet for community_post_reports / member_blocks
- **Severity:** P3
- **Location:** `api/community/_reports.ts` (GET), `api/community/_blocks.ts` — both real and tested at the API layer; no admin dashboard panel consumes the reports queue yet.
- **Re-entry trigger:** same as TD-049 — lands naturally alongside the posting composer.
- **Resolution path:** a small "Reported posts" panel in the Admin Dashboard, gated by `communications.manage`, calling the existing `GET /api/community/reports`.

---

## Giving and Impact Card (2026-07-14)

### TD-052 — i2c live adapter is an unimplemented stub
- **Severity:** P1
- **Location:** `api/_lib/i2c/live-adapter.ts` throws on every call; `api/_lib/i2c/index.ts` only returns it when `I2C_LIVE=true` AND `I2C_API_KEY` is set. In every deployment today those are unset, so all `kyc_verifications`/`cards`/`interchange_events`/`card_accounts`/`impact_allocations` rows come from the deterministic mock adapter.
- **Risk:** high if ever misrepresented — every Impact Card number in the Admin Dashboard and Members Portal (including the new adoption-funnel metrics) is mock-adapter data, not live money movement. This phase's UI copy and this TECH_DEBT entry are the guardrail; do not flip `I2C_LIVE=true` without implementing `live-adapter.ts` against real i2c sandbox/production endpoints first.
- **Re-entry trigger:** a real i2c production contract + sandbox credentials become available.
- **Resolution path:** implement `live-adapter.ts` against i2c's real API, add provider-sandbox tests against their test environment, then flip `I2C_LIVE=true` per-tenant only after a pilot review (see the "GRACE Impact Card Pilot Readiness" Work Order, `api/work-orders/_pilot-readiness.ts`).

### TD-053 — `/api/neobank` does not use the portal's demo-bootstrap actor resolution
- **Severity:** P2
- **Location:** `api/neobank/_index.ts` uses `requireClerkAuth` directly for all member-scoped resources/actions (`resource=me`, `submit_kyc`, `set_impact_route`, etc.), unlike every other Members Portal route (`api/portal/*`), which uses `resolveMemberActor` (Clerk in production, a real demo `people` row when `VITE_ENABLE_DEMO_MODE=true`). Only the staff-facing `resource=admin` GET has a demo-mode bypass.
- **Risk:** in demo mode, the new Members Portal "Give & Impact Card" page's Impact Card section always renders its "not available in demo mode" state (`fetchMyCard()` returns `null` by design — see `src/lib/services/impactCard.ts`) rather than showing real demo data, even though the rest of the portal (giving, care, prayer, community) works in demo mode. This is a demo/UX gap, not a security issue — production Clerk auth is unaffected.
- **Re-entry trigger:** first real request for a fully-working demo-mode walkthrough of the Impact Card portal experience.
- **Resolution path:** refactor `api/neobank/_index.ts`'s auth resolution to fall back to a demo member actor (mirroring `resolveDemoMemberActor` in `api/_lib/authz.ts`) for member-scoped resources/actions when `!auth.ok && DEMO_MODE`, threading a synthetic `{ok:true, clerkUserId, churchId, role:'member'}` through the existing `auth`-typed control flow. Sizeable enough (900+ line file, many call sites branch on `auth`) that it should be its own reviewed change, not folded into an unrelated phase.
- **Also still pending:** migration 046 (Stage 1, Mission Control build plan) added the granular `impact_card.operate` permission specifically so the Decision Queue could gate `kyc_review`/`failed_transfer` items on it, but `api/neobank/_index.ts` itself still gates on the coarse `STAFF_ROLES` role list rather than this key — migrating neobank's own gating to `impact_card.operate` was explicitly deferred at the time (see migration 046's comment) and remains future work, independent of the demo-bootstrap gap above.

### TD-054 — No source table for "church program benefit"; Impact Card "campaign performance" is Work-Order-level only
- **Severity:** P2
- **Location:** `api/_lib/impactCardFunnelMetrics.ts` — `program_benefit` returns `value: null, source: 'not_yet_computed'`; `campaign_performance` measures onboarding-campaign Work Order completion rate, not per-recipient campaign response/enrollment.
- **Risk:** none today (both are honestly labeled, never fabricated — see the metric's `calculation`/`assumptions` fields returned by `GET /api/impact-card/funnel-metrics`), but a stakeholder reading the Admin Dashboard panel without opening the info popover could assume `program_benefit` is "$0 benefit" rather than "not measured yet."
- **Re-entry trigger:** a decision on what "church program benefit" concretely means (e.g. subsidized fees, a matching-funds table) and/or a request for per-recipient campaign attribution.
- **Resolution path:** once a program-benefit definition and source table exist, wire it into `computeImpactCardFunnelMetrics`; for campaign performance, add a `campaign_recipients` (or similar) attribution table if member-level enrollment tracking becomes a requirement.

### TD-055 — Giving statement download is unimplemented (no PDF provider)
- **Severity:** P3 (intentional, not an oversight)
- **Location:** `giving_statements` table (migration 002) exists with a `pdf_url` column, but nothing in the codebase ever generates a PDF or populates it. `api/portal/_giving.ts` reports this explicitly via its `unsupported_functions.download_statement` field rather than exposing a broken button.
- **Re-entry trigger:** first real request for year-end tax statements.
- **Resolution path:** pick a PDF generation approach (server-side render + a storage bucket, or a third-party statement provider), populate `pdf_url` on generation, then add the download function to `api/portal/_giving.ts` and the portal UI.

## Realtime + staff notifications (Stage 5, 2026-07-18)

### TD-056 — Twilio SMS send logic now has 3 call sites, only 2 share the extracted helper
- **Severity:** P3
- **Location:** `api/_lib/sms/send.ts` (new, shared by `api/sms/_send.ts` and the crisis notification path `api/_lib/crisisNotify.ts`) vs. `api/_routes/sms.ts` (legacy Express route, still mounted by `api/_server.ts`), which duplicates the same Twilio REST call independently.
- **Risk:** none today — both implementations are correct and independently tested — but a future Twilio behavior change (auth format, response shape) now needs updating in two places instead of one.
- **Re-entry trigger:** next time `api/_routes/sms.ts` needs a change for any reason, or when the legacy Express server (`api/_server.ts`) is retired.
- **Resolution path:** refactor `api/_routes/sms.ts` to call `sendSms()` from `api/_lib/sms/send.ts`, same pattern already used for `api/sms/_send.ts`.

### TD-057 — Digest cron retries the whole batch on any single send failure
- **Severity:** P3 (intentional tradeoff, not an oversight)
- **Location:** `api/cron/_notify.ts` — `notification_cursors['notify']` only advances when every recipient in the current 15-minute batch sent successfully; a single Resend failure leaves the cursor where it was, so the next run re-sends the entire batch, including to recipients who already got it.
- **Risk:** a recipient can receive a duplicate digest email during a partial-outage window. Deliberately chosen over the alternative (silently dropping the failed recipient's events) — a duplicate digest is a minor annoyance; a permanently-lost notification is not recoverable.
- **Re-entry trigger:** if duplicate-digest complaints become frequent enough to matter.
- **Resolution path:** track a per-recipient (not just per-job) cursor, or record which individual sends succeeded within a batch and only re-attempt the failed subset on retry.

### TD-058 — `users.phone` is a free-text field with no verification step
- **Severity:** P3
- **Location:** `supabase/migrations/051_realtime_notifications.sql` adds `users.phone TEXT`, settable (and, as of the Stage C review-fix, explicitly clearable via `phone: null`) by any staff member for themselves via `PUT /api/workos/notification-prefs`. Format-validated (`isValidPhone`) but never confirmed as reachable (no SMS OTP verification loop).
- **Risk:** low — self-service, self-scoped, staff-only, and only used to route the staff member's own opt-in crisis SMS alerts to a number they typed themselves. A typo just means they don't get texts, not that someone else's messages get misrouted.
- **Re-entry trigger:** if `users.phone` is ever exposed beyond this one self-service use, or reused for anything security-sensitive (2FA, password reset).
- **Resolution path:** add a one-time SMS verification code step before a phone number is considered "confirmed," if the risk profile ever changes.

### TD-059 — Digest cron cursor uses a strict `.gt(created_at)` page boundary
- **Severity:** P3
- **Location:** `api/cron/_notify.ts` — the digest cursor advances past a 2000-row page using `.gt('created_at', lastRow.created_at)`. Events sharing the exact same `created_at` timestamp as the batch's last row, but sorted after it within that page, would be skipped on the next run rather than re-fetched.
- **Risk:** very low today — `created_at` has microsecond precision and a genuine tie at the exact page boundary requires both a coincident timestamp and >2000 events in one digest window, which the platform is nowhere near. Noted here as a review finding, not an active bug.
- **Re-entry trigger:** if event volume ever approaches the 2000-row page size in a single digest window, or if `created_at` precision/uniqueness ever changes.
- **Resolution path:** page on `(created_at, id)` as a compound cursor instead of `created_at` alone.

---

## Resolved

- **Cron-auth incident: fail-open AND spoofable at the same time** (Review-fix Stage A, 2026-07-18, commit `b79ea82`) — a self-review of the first five build-plan stages found `api/cron/*` auth had drifted into the worst of both failure modes simultaneously. `_send-pending-emails.ts`'s check fell back to allowing the request through if `CRON_SECRET` wasn't set on the project (it never had been — 4 of 5 crons had **never actually run** in production, discovered only when this fix made the `agents` cron fire for the first time ever). Meanwhile every cron accepted a bare `x-vercel-cron: 1` header as proof of origin — a header trivially forgeable by anyone (confirmed both that Vercel's real scheduler doesn't send it, via runtime logs, and that it's externally spoofable, via a live unauthenticated curl). Fixed with one shared `requireCronAuth()` (`api/_lib/cronAuth.ts`) wired into all 5 routes: fails **closed** (503) when `CRON_SECRET` is unset, 401s on any missing/wrong bearer, never trusts the Vercel header. `CRON_SECRET` was set in Vercel as part of the same fix. The sanctioned manual trigger used to verify the fix then surfaced a second, unrelated, real bug — see below.
- **Agent observation sinks violated live schema constraints on every write** (Review-fix Stage A follow-on, 2026-07-18, commit `da303e0`) — the cron-auth fix above made the `agents` cron run for the first time ever, and it turned out **100% of observation writes to the legacy `tasks`/`interactions` mirror sinks had always failed**: `tasks.due_date` (NOT NULL, no default) was never populated, `tasks.category` used a non-canonical `agent:<id>` value against a CHECK constraint, and `interactions.type`/`person_id` similarly violated their constraints. The Stage 2 `agent_findings` path was unaffected — only the older mirror sinks in `api/_lib/agents/runner.ts`. Fixed with `taskDueDateForObservation()` (severity-based horizon) and `taskCategoryForAgent()` (maps each agent to a canonical category), verified live: 77/77 observations written post-fix, 0 failures.
- **Central Henderson had zero crisis-alert coverage** (Review-fix Stage B, 2026-07-18, commit `611ea88`) — crisis-email notification defaults were only ever lazily seeded on a staff member's first visit to Settings → Notifications, so a church whose staff had never opened that card had no rows at all: a crisis-flagged care request would create the Decision Queue finding but email nobody. Migration 052 seeded defaults for existing `care.view`-holding staff; `api/_lib/crisisNotify.ts` now also falls back to emailing every active `care.view` holder when a church has zero crisis rows (not just all-disabled, which is respected as an explicit opt-out).
- **Members Portal wallet token-provider gap** (Stage 0, Mission Control build plan, commit `67f593d`) — the Portal's Impact Card page authenticated via the global Clerk token provider, which only the staff `AuthContext` ever registered; real portal-only members and preview sessions got a dead wallet page. `PortalAuthProviderInner` now registers the same provider the staff context does. Preview sessions (no real Clerk session) get an explicit "not available in staff preview" state instead of a silent failure.

---

## Process

- **When you take a shortcut**, append an entry. Be honest about the risk.
- **When you resolve one**, move it to a "Resolved" section at the bottom with the resolving commit hash; do not delete.
- **Every sprint review**, scan this file. If a P0/P1 is older than its target sprint, escalate to a replan.
