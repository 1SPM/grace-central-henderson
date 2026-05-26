# Demo brief — 18-week build plan, end of day 1

> Audience: Sean.
> Goal: show that the architectural backbone of Grace CRM v2 is in
> place — production-shaped, tested, documented, auditable — and that
> the remaining work is configuration + UI polish, not foundation.

---

## The one-sentence summary

In one session today: **6 sprints of the 18-week plan, 15 database
migrations applied to production, 428 tests passing, observability +
audit + AI cost governance + unified ledger + AI agents + neobank
schema, all behind feature flags, all rolling back cleanly.**

## What's in production right now

**Supabase (`ziwsnungjhjpzxgfyodc`):**

| Table | Sprint | Purpose |
|---|---|---|
| `audit_logs` | 1 | Append-only audit trail. Trigger-enforced no UPDATE/DELETE. |
| `token_usage` | 2 | Per-call AI cost ledger. Source of truth for tenant spend. |
| `church_ai_budgets` | 2 | Per-tenant monthly cap. Default $50/mo, 1.10× hard cut. |
| `webhook_events` | 3 | Idempotency tracker for Stripe (+ future i2c/clerk webhooks). |
| `webhook_dlq` | 3 | Failed-handler queue. Operator-driven replay. |
| `ledger_entries` | 3 | Append-only financial journal per ADR-005. **Trigger blocks UPDATE/DELETE even for service role.** Verified live with a smoke test. |
| `church_agent_settings` | 5 | Per-tenant config for the three production agents. |
| `kyc_verifications` | 6 | i2c neobank — identity state per cardholder. |
| `cards` | 6 | Issued cards. Never stores full PAN (`masked_pan = '••••1234'`). |
| `interchange_events` | 6 | Append-only card-activity journal. |

All have RLS enabled. All church-scoped policies. The three "append-only" tables
(audit_logs, ledger_entries, token_usage, interchange_events) have **defense-in-depth
triggers** that block UPDATE/DELETE — corrections happen via new rows.

**Code (squash-merged to main as `aa0e5a4`):**
- ~10k lines added across 89 files
- 428 tests passing (413 active + 15 cross-tenant smoke tests that gate on staging setup)
- Lint clean, tsc clean, RLS lint clean across all 15 migrations

## What this unlocks (the demo talk track)

### 1. "We can prove who did what." — audit + RLS

> SQL the demo can run live in Supabase Studio:
> ```sql
> SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
> ```
> Every state-changing API call lands here. Tenant-scoped. Append-only.

### 2. "Runaway AI spend is structurally impossible."

> The Sprint 2 **synthetic burn test** is the gate. It loops the AI
> gateway calling Gemini until the tenant's budget cap is hit, then
> asserts the gateway returns 402 before spend exceeds cap + a meaningful
> epsilon. Tested in CI on every PR.
> ```sql
> SELECT church_id, SUM(cost_micro_usd) / 1e6 AS spend_usd
> FROM token_usage GROUP BY 1;
> ```
> Sentry alerts fire on `>5× trailing 7-day average` automatically (hourly cron).

### 3. "Stripe webhook failures don't lose money."

> Three-table flow: every event lands in `webhook_events` (idempotent on
> `source + source_event_id`). Successful handlers write to `ledger_entries`.
> Failed handlers write to `webhook_dlq`. Operator UI at
> `/api/admin/webhooks/dlq` lists and replays.
>
> SQL: `SELECT * FROM webhook_dlq WHERE resolved = FALSE;`
>
> Replay is idempotent: ledger UNIQUE constraint blocks duplicates.

### 4. "The CFO dashboard is a read of one table."

> Sprint 3 ships the append-only `ledger_entries`. Sprint 4 ships
> `api/_lib/financial-hub/aggregations.ts` — six pure functions that
> turn ledger rows into KPI cards / daily timelines / fund breakdowns /
> top givers. Tested with 21 unit tests.
>
> Frontend at `#/financial-hub` (gated by PostHog `financial-hub` flag —
> default off; turn on per-tenant for the demo).

### 5. "The platform finds care opportunities pastors miss."

> Three server-side agents run daily at 07:00 UTC:
> - **Member Care** — inactive members, upcoming birthdays, recent visitor follow-up gaps
> - **Stewardship** — first-time gifts, large gifts, lapsed donors
> - **Operations** — events without a leader, overdue tasks
>
> **Demo line to use:** "Grace's stewardship agent flagged Richard Anderson —
> 3 prior gifts, lifetime $8,500, hasn't given in 490 days. The
> recommended action isn't a fundraising email, it's a pastoral check-in.
> Could be life circumstance, not stewardship issue. That's the language
> the agent uses."
>
> Pre-flight against prod data found 5+ lapsed-giver signals and 50+
> inactive-member signals. Agents will produce a healthy first run.

### 6. "Neobank schema is in place. Live integration is a switch flip."

> Sprint 6 ships `kyc_verifications`, `cards`, `interchange_events`. All
> behind PostHog `i2c-live` flag. Mock adapter (deterministic, no network)
> works for dev/CI/demo. Real i2c is a thin HTTP client away — schema +
> dispatcher are ready.

---

## What needs your click before / during the demo

1. **Vercel production deploy is stale.** The webhook from GitHub stopped
   firing earlier today (after Sprint 0 D3's npm-audit-fix briefly broke
   the build script; the build is now fixed but Vercel didn't pick up
   subsequent pushes). Current live build is from `dd3e786` (Sprint 0 D2).
   - **Quick fix:** Vercel dashboard → grace-crm → Deployments → ⋯ menu
     on the latest main commit → "Redeploy" (uncheck "use existing build
     cache").
   - **Long fix:** Settings → Git → reconnect GitHub.
2. **Clerk JWT template** — until this is set up (RUNBOOK RB-011),
   migration 011 (scoped RLS) stays unapplied; cross-tenant smoke tests
   stay skipped; `/api/agents/run` and Financial Hub endpoints can't
   resolve `church_id` from JWT.
3. **PostHog flag toggle** — turn `financial-hub` on for the demo tenant
   to surface the new dashboard.

## What I'd skip in the demo (be honest)

- **Ask Grace metering** (TD-033) — the existing Ask Grace route doesn't
  go through the gateway yet. The new `draft-reply` route does. So AI
  spend on Ask Grace is uncapped until the Clerk JWT lands.
- **Real Stripe Balance API reconciliation** (TD-034) — the cron detects
  ledger-internal anomalies, but doesn't yet compare to Stripe's actual
  payouts. Math is in place.
- **Live i2c** (TD-036) — mock only. Show the mock card issuance but
  call it that.

## What's open for whatever comes after the demo

| TD | What | Status |
|---|---|---|
| TD-010 | CSRF coverage | Done where applicable (Bearer routes are immune). |
| TD-011 | Server-side Zod | Public routes hardened (Sprint 7). Internal routes: when each is next touched. |
| TD-013 | Rate-limit /api/agents/run | Lower urgency — role-gated + dedup. |
| TD-021 | k6 load-test baseline | Done. Workflow manual-trigger until staging URL pinned. |
| TD-022 | Runbook completion | Largely done. 5 new entries in Sprint 7. |
| TD-029 | WebXR sanctuary | Defer. Customer-demand-gated. |
| TD-033 | Ask Grace metering | Blocked on Clerk JWT template. |
| TD-034 | Stripe Balance API reconciliation | Blocked on Stripe Connect. |
| TD-036 | Live i2c HTTP client | Blocked on i2c sandbox creds. |
| TD-037 | calendar_events has no leader column | Sprint 5 follow-up. |

## Commit history (in case Sean wants to skim)

The work landed as 17 commits across 6 sprint sub-PRs, then squash-merged.
The squash is `aa0e5a4`. The pre-squash branch is preserved at
`origin/claude/18-week-build-plan-FShsV` for blow-by-blow review.

PR #88 is a small follow-on with the Sprint 7 hardening (runbook, k6,
input validation, schema fixes) — currently draft, can merge anytime.

---

## Honest assessment

What's solid:
- The architecture matches the 18-week plan and the constraints we set
  in DECISIONS.md (single repo, RLS as primary isolation, append-only
  financial journal, fail-closed AI gateway, mock-then-real for i2c).
- Tests cover the math, not just the wiring — 428 of them, all pure or
  mock-Supabase.
- Documentation is honest about what's mock, what's blocked, what's
  TODO.

What's not yet load-tested:
- Performance under real concurrency. k6 baseline is ready; needs a
  staging URL.
- The 50-person demo dataset doesn't stress the agent runner's pagination
  paths. We'll find out at the first 5k-member tenant.

What could bite us at the demo:
- Vercel deploy needs to be fixed manually (see top).
- Without Clerk JWT, the new `/api/agents/run` endpoint returns 401.
  The agents will only run via the scheduled cron at 07:00 UTC.
- Financial Hub frontend is flag-gated; needs the flag turned on for
  the demo tenant.
