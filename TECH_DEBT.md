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
- **Owner:** Sprint 0, Day 2
- **Risk:** Production errors are invisible until a user reports them.
- **Re-entry trigger:** Sprint 0 close.
- **Resolution path:** Sentry on frontend and Express server. PII redaction in `beforeSend`. Source maps uploaded.

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

### TD-033 — `api/ai/generate.ts` has no auth / no per-tenant metering
- **Severity:** P1
- **Location:** `api/ai/generate.ts`
- **Risk:** This route is the Ask Grace entry point and currently has only IP-based rate limiting (120 req/min). Without a verified Clerk JWT we can't resolve `church_id`, which means we can't bill the call to a tenant's budget — every call against this route is uncapped. A misconfigured client loop could burn unlimited budget on our card before the IP rate limit slows it (still 120 calls/min ≈ ~$10/hr at Gemini Flash rates).
- **Re-entry trigger:** before this PR's gateway can claim full coverage of AI cost control; before any external customer hits this route.
- **Resolution path:** Add Clerk JWT verification (mirror the pattern in `api/_middleware/auth.ts`) at the top of `api/ai/generate.ts`, extract `church_id` from `app_metadata` (requires the Clerk JWT template — see TD-001 + RB-011), then wire through `generate()` with `feature='ask-grace'`. Estimated 30 min once the JWT template is configured.

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
- **Risk:** Malformed payloads land in DB; potential XSS on render despite frontend sanitization.
- **Re-entry trigger:** every new write endpoint.
- **Resolution path:** Zod schemas per route; reject with 400 + structured error before any DB call.

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
- **Owner:** Auth/API
- **Risk:** A staff user in tenant A can mutate a user record in tenant B via direct ID.
- **Re-entry trigger:** Sprint 1 alongside RLS hardening.
- **Resolution path:** every `/api/auth/users/:id*` handler must assert `user.church_id === req.session.church_id` before any DB write. RLS provides defense in depth.

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
- **Severity:** P3 (does not block; CI on `main` is currently green because these errors do not exist on `main`)
- **Discovered:** Sprint 0, Day 2 — surfaced when adding Sentry/PostHog and running `npm run lint` + `npm run test:run`.
- **Failures:**
  - `src/lib/grace-chat/useGraceInbox.ts:48-51` — `react-hooks/refs` errors (4 instances). Refs are assigned during render; should move into `useEffect`.
  - `src/App.tsx:329,336` — `@typescript-eslint/no-unused-expressions` (2 instances).
  - `src/hooks/useChurchSettings.ts:156,192` — unused `_` variable (2 instances).
  - `src/components/ViewToggle.test.tsx` — 2 tests assert `bg-white` class but the component renders `bg-stone-100`. Either the test or the component drifted.
  - `src/contexts/GraceChatContext.tsx:218,223` — `react-hooks/exhaustive-deps` warnings (2 instances).
- **Risk:** before any PR can merge to `main` with CI green, these need fixing. Sentry/PostHog work was verified not to introduce any of them (stashed-vs-applied diff).
- **Re-entry trigger:** Sprint 0 Day 3, alongside CI hardening.
- **Resolution path:** small dedicated PR. Move ref assignments inside an effect; fix `bg-white` vs `bg-stone-100` mismatch (likely a tailwind theme drift after the gold-accent change in commit `eccb4e3`).

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
