# PORTING.md

> What we carry forward from current `grace-crm` into the production architecture.
> What we keep, what we rewrite, what we retire.

This document is the bridge between the codebase as audited in `ARCHITECTURE.md` and the 18-week production target. Read alongside `TECH_DEBT.md`.

---

## Decision matrix

For each subsystem:

- **Keep** — production-ready as-is, only minor wiring needed
- **Harden** — works, but needs hardening before banking data
- **Rewrite** — concept is right, implementation must be redone
- **Retire** — not in V1 (logged in `TECH_DEBT.md`)

| Subsystem | Verdict | Sprint | Notes |
|---|---|---|---|
| React + Vite shell | Keep | — | PWA + manifest already live |
| Tailwind theme + Lucide icons | Keep | — | Gold accent change already merged |
| Clerk auth | Keep | 1 | Fail-closed resolver in `authMode.ts` |
| Supabase Postgres | Keep | 0 | Confirm region = Canada Central |
| Schema (38 tables, `church_id` everywhere) | Keep | — | New tables append; no rename |
| RLS policies | **Rewrite** | 1 | Currently permissive; ship church-scoped policies |
| CSRF middleware | Harden | 1 | Apply globally, kill opt-out |
| Auth middleware | Keep | — | `api/_middleware/auth.ts` |
| Rate limiting | Harden | 2 | Add Upstash Redis, cover all public routes |
| Express API | Keep | — | Stays on Vercel for V1 |
| Stripe integration | Harden | 3 | Add idempotent webhook handler + ledger writes |
| Ask Grace chat | Keep | — | Action tags + rolling-summary memory already work |
| Gemini provider | Keep | 2 | `thinkingBudget: 0` fix is in |
| Hermes adapter | Keep | 2 | Will become one of N providers in the gateway |
| AI gateway (unified) | **Rewrite** | 2 | New: token-usage ledger + budget caps + moderation |
| Agent scaffold (BaseAgent) | Harden | 5 | Already writes to `agent_executions` |
| NewMemberAgent | Harden → becomes "Member Care" | 5 | |
| DonationProcessingAgent | Harden → becomes "Financial Projection" | 5 | |
| LifeEventAgent | Keep | 5 | |
| Prayer triage agent | **New** | 5 | Build on BaseAgent |
| AgentMail integration | Keep | — | `api/_lib/agentmail-send.ts` |
| Resend / Twilio wrappers | Keep | — | Server-only |
| PrintableReports (sanitized) | Keep | — | `sanitizeHtml` shipped |
| `useChurchSettings` hook | Harden | 1 | Settings should round-trip through API, not Supabase direct |
| `constants.ts` sample data | Move to test | 0 | Logged as TD-023 |
| Demo mode | Keep, fenced | — | `VITE_ENABLE_DEMO_MODE` opt-in only |
| Dual `002_*` migrations | Cleanup | 1 | Logged as TD-025 |
| `useSupabaseData.ts` direct reads | Refactor opportunistically | — | TD-024 |

---

## Subsystem-by-subsystem detail

### Authentication
- **Keep**: Clerk SDK, `AuthContext`, fail-closed `authMode.ts`, the `AuthProviderSecurityBlock` path.
- **Add (Sprint 1)**: enforce that every JWT carries `app_metadata.church_id`; RLS depends on it. Add a Clerk webhook handler that prevents user creation if a `church_id` is not assigned via the invite flow.
- **Do not abstract** Clerk behind `packages/auth` yet (TD-016).

### Database schema
- **Keep**: every existing table. Schema is sensibly modeled.
- **Add (Sprint 1, single migration `010_production_hardening.sql`)**:
  - `audit_logs` (TD-003)
  - replace permissive RLS with `church_id = public.get_church_id()` policies on every table
  - add `webhook_events` (idempotency)
  - add `webhook_dlq` (TD-004)
- **Add (Sprint 2, migration `011_ai_governance.sql`)**:
  - `token_usage` (TD-007)
  - `church_settings.ai_monthly_budget_usd` column with default
- **Add (Sprint 3, migration `012_ledger.sql`)**:
  - `ledger_entries` (ADR-005)
  - RLS denies UPDATE/DELETE
- **Add (Sprint 6, migration `013_neobank.sql`)**:
  - `kyc_verifications`
  - `cards`
  - `interchange_events`
  - all behind `INTERCHANGE_SOURCE = 'i2c'`

### Row-Level Security
- **Rewrite**: migration `010_production_hardening.sql` replaces all `USING (true)` with church-scoped policies. The helper `public.get_church_id()` already exists.
- **CI**: add `tools/lint-rls.ts` — scans the diff for `CREATE TABLE` and refuses any without `ENABLE ROW LEVEL SECURITY` + at least one policy in the same migration.
- **Smoke test**: Tenant A JWT + `SELECT * FROM people` must return 0 of Tenant B's rows. Runs in CI on every PR.

### CSRF
- **Harden**: `api/_middleware/csrf.ts` already implements the double-submit pattern. Make `csrfRequire` mandatory on POST/PATCH/PUT/DELETE in `_server.ts`. Remove any per-route opt-out.

### AI gateway
- **Rewrite** as `src/lib/ai/` (single import surface):
  ```
  src/lib/ai/
  ├── gateway.ts          # entry — budget check, moderation, route, log
  ├── router.ts           # picks provider per (feature, tenant, model preference)
  ├── adapters/
  │   ├── gemini.ts       # ported from api/_lib/aiProviders.ts
  │   ├── claude.ts       # new (Anthropic SDK)
  │   ├── gpt4o.ts        # new (OpenAI SDK)
  │   └── hermes.ts       # ported
  ├── prompts/            # prompt registry — versioned
  ├── moderation.ts       # OpenAI Moderation calls
  └── budget.ts           # tenant cap enforcement, anomaly cron
  ```
- **Carry forward** the action-tag pattern (`src/lib/grace-actions.ts`) and the rolling-summary memory (`src/lib/grace-brain.ts`) — they are not rewritten, they are wrapped by the gateway.

### Stripe & ledger
- **Harden** the existing Stripe integration:
  - Move webhook handler to `api/webhooks/stripe.ts` (one file, one handler).
  - Verify signature before any work.
  - Write `webhook_events (source, source_event_id UNIQUE, payload, status)` — return 200 fast if already processed.
  - On success, write to `ledger_entries`.
  - On failure, write to `webhook_dlq` with the error.

### Agents
- **Harden** `BaseAgent` to:
  - Read `church_id` from a tenant context object, not a constructor arg (avoid cross-tenant bugs).
  - Write every step to `audit_logs`.
  - Hard-fail if the tenant is over budget (calls go through the AI gateway).
- **Three production agents** (Sprint 5):
  - **Member Care** ← derived from `NewMemberAgent.ts`
  - **Financial Projection** ← derived from `DonationProcessingAgent.ts`
  - **Prayer Triage** ← new, but reuses `BaseAgent`, crisis-language classifier, and `AgentDashboard.tsx` for staff review
- The other three planned agents (per `PRODUCT_VISION.md`) are deferred — TD-026.

### Webhooks
- **Single ingestion module**: `api/webhooks/{stripe,clerk,i2c}.ts`. Each verifies its own signature and writes to `webhook_events`.
- The existing combined `api/_routes/webhooks.ts` gets split during Sprint 3.

### Frontend components
- **Keep all 90+ components.** No mass refactor.
- **New routes** added (not rewriting existing):
  - `/financial-hub` (Sprint 4) — the demo dashboard
  - `/admin/webhooks` (Sprint 3) — DLQ replay UI
  - `/admin/ai-usage` (Sprint 2) — per-tenant spend
- **Settings.tsx** gains an "AI budget" panel reading from `church_settings.ai_monthly_budget_usd`.

### Observability
- **New (Sprint 0)**:
  - Sentry SDK on client + server. PII redaction via `beforeSend`.
  - PostHog SDK on client. Lazy-loaded. Feature flags `read-only-mode`, `financial-hub`, `i2c-live`.
- **Existing logging** (`console.*` peppered through services) gets a wrapper `src/utils/logger.ts` that goes to Sentry in prod and console in dev. Mass replacement happens opportunistically — do not block Sprint 1 on it.

### CI / CD
- **Keep**: existing `ci.yml` (lint, typecheck, vitest, security-smoke, build).
- **Add (Sprint 0 Day 3)**:
  - `gitleaks` job (and a Husky pre-commit version of the same).
  - `npm audit --audit-level=high` gate.
  - Dependabot config.
  - `tools/lint-rls.ts` as a job — fails the build if a new table lacks RLS.
- **Add (Sprint 1)**:
  - Cross-tenant smoke test job that boots a test Supabase project and asserts isolation.

### Secrets
- **Migrate (Sprint 0 Day 3)** every `VITE_*` and backend env var from Vercel-env-only to **AWS Secrets Manager**, with Vercel pulling at deploy time. `.env.example` is the authoritative list of keys (already comprehensive).

### Hosting
- **Stay on Vercel** for V1 (ADR-007). Inngest for any cron that needs more than Vercel's limits.
- **No AWS Lambda + API Gateway** in V1 (TD-017).
- **No ECS Fargate** in V1 (TD-018).

---

## Things we retire (V1)

The following appear in the codebase or in product docs but will not be carried into V1:

- **Mac Mini Local Node tier** — never (post-funding decision; TD-028).
- **Blockchain Tier 3** — schema fields stay; no integration code (TD-027).
- **Full WebXR Virtual Worship** — static Three.js sanctuary only, and only if Sprint 7 has hours (TD-029).
- **Divinity mobile app** — post-funding (TD-030).
- **Three of six planned agents** — only Member Care, Prayer Triage, Financial Projection ship in V1 (TD-026).

Every "retire" item must have a re-entry trigger in `TECH_DEBT.md`. If the trigger fires, the item moves into a sprint plan.

---

## Naming alignment

| Plan term | Code term | Resolution |
|---|---|---|
| `tenant_id` | `church_id` | Code wins (ADR-002). Plan documents use both; column is `church_id`. |
| `tenants` | `churches` | Same. |
| `tenant_members` | `users` (with `church_id` FK) | Same. |
| `users` (the plan's tenant_members.user_id reference) | `users` | Stays. |
| `participants` (plan term) | `people` | `people` is the V1 noun. Banking docs may use "cardholder" — that is a *role* of a person, not a separate table. |

---

## What "ported" actually means in this repo

When this doc says "port X" the workflow is:

1. Open an issue describing the V1 surface for X.
2. Write the new module in `src/lib/<domain>/` or `api/<domain>/`.
3. Keep the original until the new one has feature parity + tests.
4. Switch callers behind a feature flag (`x-v2` in PostHog).
5. Once stable, delete the original, remove the flag. Note the commit in `DECISIONS.md` as a status update on the relevant ADR.

No big-bang refactors. Every port is a sequence of small PRs.
