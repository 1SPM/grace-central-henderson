# ARCHITECTURE.md

> Living document. Source of truth for what exists today in `grace-crm`.
> Updated: Sprint 0, Day 1. Audit pass against commit `9767a9c`.

This describes the system **as it is**, not as we want it to be.
For the gap between this and the production target, see `TECH_DEBT.md`.

---

## 1. Stack at a glance

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite 5 | PWA enabled via `vite-plugin-pwa` |
| Styling | Tailwind 3.3 + Lucide icons | Dark mode supported |
| API | Express 5 (`api/_server.ts`) | Deployed as Vercel serverless / Node |
| Auth | Clerk (`@clerk/clerk-react` + `@clerk/backend`) | Fail-closed in prod when key missing |
| Database | Supabase (Postgres) | `@supabase/supabase-js` 2.89 |
| Payments | Stripe (`stripe` 20.1, `@stripe/stripe-js` 8.6) | Publishable on client, secret on server |
| AI | Google Gemini (`@google/genai` 1.36) + Hermes adapter scaffold | Gemini `thinkingBudget=0` to fix Ask Grace truncation |
| Email | Resend + AgentMail | Server-only |
| SMS | Twilio | Server-only |
| News | NewsAPI (`NEWS_API_KEY`) | For Sunday Prep |
| Build / CI | GitHub Actions, Vercel | lint, typecheck, vitest, security-smoke, build |

---

## 2. Repository layout

```
grace-crm/
├── api/                          # Express backend
│   ├── _server.ts               # Entry, mounts middleware + routes
│   ├── _lib/                    # Shared backend libs
│   │   ├── aiProviders.ts       # Gemini + Hermes adapter
│   │   ├── agentmail-send.ts
│   │   └── grace-context.ts
│   ├── _middleware/
│   │   ├── auth.ts              # Clerk JWT verification
│   │   ├── csrf.ts              # Double-submit cookie pattern
│   │   └── rateLimit.ts
│   ├── _routes/
│   │   ├── agents.ts            # Agent execution endpoints
│   │   ├── ai.ts                # /api/ai/* (generate, draft, etc.)
│   │   ├── email.ts             # Resend wrapper
│   │   ├── payments.ts          # Stripe wrapper
│   │   ├── sms.ts               # Twilio wrapper
│   │   ├── validation.ts        # Server-side input validation
│   │   └── webhooks.ts          # Stripe + Clerk webhooks
│   ├── ai/generate.ts
│   ├── grace/draft-reply.ts
│   ├── giving/text-to-give.ts
│   ├── connect-card.ts
│   └── leader-apply.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   ├── constants.ts             # Seed/sample data (dev)
│   ├── components/              # 90+ React components
│   │   ├── Dashboard.tsx, AskGrace.tsx, VisitorPipeline.tsx, …
│   │   ├── action-feed/, calendar/, dashboard/, member/, pastoral/,
│   │   ├── redesign/, settings/, tutorial/, ui/  (subfolders)
│   │   └── printing.ts          # Sanitized HTML for print
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── authMode.ts          # Resolves prod/demo/blocked auth modes
│   │   ├── GraceChatContext.tsx
│   │   ├── IntegrationsContext.tsx
│   │   ├── TutorialContext.tsx
│   │   └── AccessibilityContext.tsx
│   ├── hooks/                   # useSupabaseData, useAgents, useAISettings, …
│   ├── lib/
│   │   ├── agents/              # BaseAgent + NewMember/Donation/LifeEvent
│   │   ├── services/            # auth, ai, email, sms, payments, news
│   │   ├── grace-chat/          # Ask Grace persistence + handlers
│   │   ├── grace-actions.ts     # Action-tag dispatcher
│   │   ├── grace-brain.ts       # Prompt + memory
│   │   └── supabase.ts          # Client init
│   ├── security/                # smoke.test.ts (CI gate)
│   ├── utils/                   # security.ts, validation.ts
│   └── test/
├── supabase/
│   ├── migrations/              # 001 → 008 applied in order
│   ├── seed.sql
│   └── reset_and_seed.sql
├── docs/                        # Product-facing (CLIENT_GUIDE, FEATURE_PLAN, …)
├── .github/workflows/ci.yml
├── vercel.json                  # Headers + SPA rewrites
├── vite.config.ts               # PWA + dev-time CSP
└── *.md                         # Vision and plan docs (PRODUCT_VISION, NEXT_LEVEL_PLAN, …)
```

---

## 3. Data model (current)

All tables created in `supabase/migrations/001_initial_schema.sql` through `008_*`.
**Every tenant-scoped table has a `church_id UUID REFERENCES churches(id)`.**

### Tenancy & identity
- `churches` — tenant root (slug, timezone, settings JSONB)
- `users` — staff/volunteers, linked via `clerk_id`, role ∈ {admin, staff, volunteer}

### CRM core
- `people` — members/visitors, status ∈ {visitor, regular, member, leader, inactive}
- `small_groups`, `group_memberships`
- `interactions` — call/email/visit/prayer log per person
- `tasks` — follow-ups
- `prayer_requests`
- `calendar_events`
- `attendance`

### Giving
- `giving` — base donation table
- `pledges`, `campaigns`, `recurring_giving`
- `donation_batches`, `batch_items` — physical-collection workflow
- `giving_statements`

### Messaging / AI
- `scheduled_messages`, `message_archive`, `inbound_messages`
- `daily_digests`
- `drip_campaigns`, `drip_campaign_steps`, `drip_campaign_enrollments`
- `agent_executions`, `agent_logs`, `agent_stats` (migration 004)

### Pastoral / leadership
- `leader_applications`, `pastoral_sessions`, `leader_availability`

### Anchor marketplace (migrations 006–008)
- `anchor_leaders`, `anchor_leader_visibility`, `anchor_leader_applications`
- `anchor_ai_personas`, `anchor_conversations`, `anchor_messages`
- `anchor_intake_responses`

**Tables that DO NOT exist yet but Sprint 1+ require:**
- `tenants` / `tenant_members` — currently `churches` / `users` serve this role
- `audit_logs`
- `token_usage`
- `ledger_entries`
- `kyc_verifications`
- `webhook_dlq`

---

## 4. Row-Level Security (current state — IMPORTANT)

Migration `005_row_level_security.sql` enables RLS on all 38 tables **but applies permissive policies**:

```sql
CREATE POLICY "Service role full access" ON people
  FOR ALL USING (true) WITH CHECK (true);
```

This means RLS is **structurally enabled but not actually enforcing tenant isolation**.
Tenant scoping today is enforced **in application code** (every query filters by `church_id`).

Helper function `public.get_church_id()` is defined to read `auth.jwt() -> 'app_metadata' ->> 'church_id'`, but no policy currently uses it.

**Sprint 1 will replace these with church-scoped policies.** This is the top-priority risk and the single largest gap between the current app and a production-acceptable posture for VWS / banking data.

---

## 5. Auth flow

1. Frontend uses `@clerk/clerk-react`. `ClerkProvider` wraps `App`.
2. `src/contexts/authMode.ts` resolves the mode:
   - **prod** — Clerk key present → Clerk handles sessions
   - **demo** — only if `VITE_ENABLE_DEMO_MODE=true` AND non-production
   - **blocked** — production with no Clerk key → `AuthProviderSecurityBlock` (signed-out, no permissions)
3. Backend (`api/_middleware/auth.ts`) verifies Clerk session tokens via `@clerk/backend`.
4. `church_id` is expected on `app_metadata` of the Clerk session for tenant scoping.

Sprint 1 will make `church_id` a hard requirement and back it with RLS, not just middleware checks.

---

## 6. Security posture today

From `SECURITY_AUDIT_REPORT.md` and `SECURITY_FINDINGS_STATUS.md`:

| Finding | Severity | Status |
|---|---|---|
| Client-side secret API keys | Critical | Resolved (server-only) |
| XSS in PrintableReports | Critical | Resolved (`sanitizeHtml`) |
| Demo mode auth bypass | Critical | Resolved (fail-closed) |
| CSRF protection | High | Partially resolved (double-submit cookie middleware in `api/_middleware/csrf.ts`; auth routes not yet wired) |
| Input validation | High | Partially resolved (server validators on some write paths) |
| Sensitive data in localStorage | High | Partially resolved (settings no longer cached client-side in prod) |
| IDOR on user mutations | High | Partially resolved (UUID format checked client-side; server org-scoping pending) |
| Session timeout | Medium | Not implemented |
| Rate limiting | Medium | Middleware exists (`rateLimit.ts`); coverage incomplete |
| Verbose error messages | Medium | Sanitization helpers added |
| Security headers | Low | Resolved (`vercel.json` + dev CSP in `vite.config.ts`) |
| Verbose logging | Low | `maskSensitiveData()` introduced |

### Headers shipped (vercel.json)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- CORS configured for `Content-Type, Authorization, X-CSRF-Token`

### Dev CSP (vite.config.ts)
- `frame-ancestors 'none'`
- Allowlists Supabase, Clerk, Stripe, Resend, Twilio explicitly

---

## 7. AI subsystem

**Entry points**
- `src/lib/grace-brain.ts` — system prompt assembly + rolling-summary memory for Ask Grace
- `src/lib/grace-actions.ts` — action-tag dispatcher (`<add_person>`, `<create_task>`, …)
- `api/_lib/aiProviders.ts` — server-side provider router
- `api/ai/generate.ts`, `api/grace/draft-reply.ts` — HTTP entry points

**Providers configured**
- **Gemini** (`GEMINI_API_KEY`) — primary. `thinkingBudget: 0` enforced (commit `c28992f`) to prevent reply truncation.
- **Hermes** (`HERMES_API_URL`, `HERMES_API_KEY`) — generic OpenAI-compatible adapter for self-hosted models. Off unless URL is set.

**Patterns already proven in this codebase**
- Action-tag pattern (Claude/Gemini emits XML-like tags, dispatcher executes)
- Rolling-summary chat memory (summary replaces full transcript past a token threshold)
- Persistence of Ask Grace history across page reloads (`grace-chat/persistence.ts`)

**Not yet in place** (Sprint 2 work)
- Unified gateway with per-tenant cost ledger
- Token usage table + monthly budget caps
- Anomaly-detection cron
- Input/output moderation pipeline

---

## 8. Agent infrastructure

`src/lib/agents/`:
- `BaseAgent.ts` — abstract; defines `run()`, status writeback to `agent_executions`
- `NewMemberAgent.ts`, `DonationProcessingAgent.ts`, `LifeEventAgent.ts`
- `agent_executions` / `agent_logs` / `agent_stats` tables (migration 004)
- `AgentDashboard.tsx` — staff review UI

Three of the six planned production agents (Member Care, Prayer Triage, Financial Projection) will be **derived from this scaffolding** rather than rebuilt — see `PORTING.md`.

---

## 9. Webhooks

Single entry point: `api/_routes/webhooks.ts`.
- Stripe webhook signature is verified (`STRIPE_WEBHOOK_SECRET`).
- Clerk webhook receiver present.

**Not yet in place**
- Idempotency table (`source_event_id UNIQUE`)
- Dead-letter queue
- Replay UI

---

## 10. CI / CD

`.github/workflows/ci.yml` runs on `push` and `pull_request` to `main`:

1. **lint-and-typecheck** — `npm run lint` + `tsc --noEmit`
2. **test** — `vitest run`
3. **security-smoke** — `vitest run src/security/smoke.test.ts` (auth fail-closed, CSRF headers, sanitization)
4. **build** — depends on all three above, `npm run build`

Deploys via Vercel on merge to `main`.

**Not yet in place** (Sprint 0 work)
- gitleaks pre-commit hook
- Dependabot config
- Snyk (or `npm audit --audit-level=high` gate)
- `tools/lint-rls.ts` — CI fail if a new table is created without an enabled RLS policy
- Cross-tenant smoke test (separate JWTs, verify zero-row leakage)

---

## 11. Hosting & secrets (today)

- **Frontend + API**: Vercel
- **Database**: Supabase (region TBD — must confirm Canada Central before any banking data; see `DECISIONS.md`)
- **Secrets**: Vercel Environment Variables (not yet migrated to AWS Secrets Manager)
- **Logging**: `console.*` (no Sentry yet)
- **Analytics / feature flags**: none (PostHog not yet wired)

---

## 12. Known operational unknowns

- No SLA documented
- No runbook (this commit starts `RUNBOOK.md`)
- No load-test baseline
- No incident drill performed
- Backup / restore procedure for Supabase relies on Supabase defaults; not exercised
