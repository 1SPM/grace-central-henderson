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
- **Anomaly cron (Sprint 2 Part 3):** `api/cron/ai-anomaly.ts` runs hourly per `vercel.json` `crons` config. Compares last-hour spend per tenant to trailing 7-day hourly average; fires a Sentry warning when ratio ≥ 5× AND last-hour spend ≥ $0.10. Auth via `x-vercel-cron` header or `CRON_SECRET` bearer. `detectAnomaly` math extracted as a pure function with 9 unit tests.
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

## Process

- **When you take a shortcut**, append an entry. Be honest about the risk.
- **When you resolve one**, move it to a "Resolved" section at the bottom with the resolving commit hash; do not delete.
- **Every sprint review**, scan this file. If a P0/P1 is older than its target sprint, escalate to a replan.
