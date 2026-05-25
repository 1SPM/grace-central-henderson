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
- **Resolution path:** Sprint 1 ships migration `010_rls_church_scoped.sql` that replaces every `USING (true)` policy with `USING (church_id = public.get_church_id())`. CI gains `tools/lint-rls.ts` and a cross-tenant smoke test (Tenant A JWT → SELECT people → 0 rows).

### TD-002 — Cross-tenant CI smoke test does not exist
- **Owner:** Sprint 1
- **Risk:** RLS regressions ship undetected.
- **Re-entry trigger:** same as TD-001.
- **Resolution path:** seed two tenants in test DB, sign JWTs for both, assert each can read only its own rows across `people`, `giving`, `prayer_requests`, `audit_logs`.

### TD-003 — No `audit_logs` table
- **Owner:** Sprint 1
- **Risk:** Cannot answer "who changed this record" — SOC 2, regulatory, and customer-trust blocker.
- **Re-entry trigger:** before SOC 2 evidence collection starts (Sprint 0 ideally).
- **Resolution path:** new table `audit_logs (id, church_id, actor_user_id, action, entity_type, entity_id, before_jsonb, after_jsonb, created_at)`. Express middleware on every state-changing route writes one row. RLS denies UPDATE and DELETE.

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
- **Risk:** A misconfigured loop bills $10k to our credit card overnight. Has happened to predecessors of this codebase.
- **Re-entry trigger:** Sprint 2.
- **Resolution path:** see ADR-009.

### TD-008 — No moderation pipeline on AI inputs/outputs
- **Owner:** Sprint 2
- **Risk:** Hostile prompt or model output reaches a pastoral-care recipient. Reputational catastrophe.
- **Re-entry trigger:** before any AI message is sent to a real congregant without staff review.
- **Resolution path:** OpenAI Moderation API on both input and output in the gateway. Block on `flagged`, log to `audit_logs`.

### TD-009 — Unified `ledger_entries` table does not exist
- **Owner:** Sprint 3
- **Risk:** Stripe + i2c reconciliation becomes manual; CFO dashboard cannot be trusted.
- **Re-entry trigger:** before Stripe goes live in production.
- **Resolution path:** see ADR-005.

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

### TD-020 — No `gitleaks` pre-commit hook
- **Owner:** Sprint 0, Day 3
- **Risk:** Accidental secret commit. We've already had one client-side-key audit finding.
- **Resolution path:** Husky + gitleaks; same scan as a CI job.

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

### TD-032 — npm audit reports 31 vulnerabilities (1 low, 10 mod, 17 high, 3 critical)
- **Severity:** P2
- **Discovered:** Sprint 0, Day 2 — output of `npm install`.
- **Cause:** transitive deps; needs detail-level audit. Likely mostly false-positive level CVEs in dev tooling.
- **Re-entry trigger:** Sprint 0, Day 3 (TD-019 — CI dependency scanning).
- **Resolution path:** triage with `npm audit --json`; resolve high/critical, document the rest as accepted risk.

---

## Process

- **When you take a shortcut**, append an entry. Be honest about the risk.
- **When you resolve one**, move it to a "Resolved" section at the bottom with the resolving commit hash; do not delete.
- **Every sprint review**, scan this file. If a P0/P1 is older than its target sprint, escalate to a replan.
