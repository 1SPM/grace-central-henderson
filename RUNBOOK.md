# RUNBOOK.md

> What to do when something is on fire.
> Every incident response we run lands here as a new entry.
> Skeleton today. Filled in incrementally.

**Conventions**
- **Symptom** — what the operator sees (alert text, user report, dashboard signal).
- **First check** — the cheap diagnostic, ≤2 minutes.
- **Mitigation** — what stops the bleeding immediately.
- **Root-cause fix** — what we do once the user impact is contained.
- **Postmortem** — link to a postmortem doc if severity warranted one.

---

## On-call

- **Primary on-call:** the operator
- **Escalation:** none yet — solo build
- **Working hours:** 24/7 for P0/P1, business hours otherwise
- **Pager:** Sentry → email (PagerDuty deferred until second engineer onboards)

## Severity definitions

| Sev | Definition | Response |
|---|---|---|
| **SEV-1** | Active data leak; financial integrity compromised; service down for all tenants | Drop everything. Acknowledge in <15min. |
| **SEV-2** | Service degraded for most tenants; one tenant fully broken; suspected security issue | Acknowledge in <1h, mitigation in <4h. |
| **SEV-3** | One feature broken across tenants; or one tenant degraded | Same day. |
| **SEV-4** | Cosmetic; affects fewer than 5 users | Next sprint. |

---

## Incidents

### RB-001 — Tenant sees another tenant's data

- **Severity:** SEV-1
- **Symptom:** User reports seeing records they didn't create; cross-tenant smoke test fails in CI.
- **First check:**
  1. Confirm the leak: log into the affected tenant, repro the query.
  2. `SELECT COUNT(*) FROM <table> WHERE church_id != public.get_church_id();` from the affected user's session — should be 0.
- **Mitigation:**
  1. Toggle PostHog flag `read-only-mode` to true for *all* tenants. (Flag to be created in Sprint 0.)
  2. If RLS is the cause: re-apply migration `010_rls_church_scoped.sql` or revert the offending migration via `supabase db push`.
- **Root-cause fix:** Audit the migration or query that introduced the leak. Add a regression test to `src/security/smoke.test.ts`.
- **Disclosure:** Affected tenants notified in writing within 24 hours.

### RB-002 — AI spend spike

- **Severity:** SEV-2
- **Symptom:** Sentry alert: "burn rate >5× 7-day trailing average" or Gemini billing alert fires.
- **First check:**
  1. `SELECT church_id, SUM(cost_micro_usd)/1e6 AS spend_usd FROM token_usage WHERE created_at > now() - interval '24 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 10;` (table arrives in Sprint 2).
  2. Identify the top spender and the feature (`token_usage.feature` column).
- **Mitigation:**
  1. Lower the offender's `church_settings.ai_monthly_budget_usd` to a value below their current spend — gateway returns 402.
  2. If it's our own scheduled job, disable the cron via Vercel dashboard.
- **Root-cause fix:** Find the loop or prompt blow-up. Add a `feature`-level cap if a single feature is overspending.

### RB-003 — Stripe webhook failures

- **Severity:** SEV-2
- **Symptom:** Stripe dashboard shows red webhook delivery; `webhook_dlq` row count rising (table arrives in Sprint 3).
- **First check:**
  1. Stripe Dashboard → Developers → Webhooks → click the failing endpoint → "Recent deliveries". Read the response body.
  2. Check our error: Sentry filter `route:/api/webhooks/stripe`.
- **Mitigation:**
  1. If signature failure: confirm `STRIPE_WEBHOOK_SECRET` matches the endpoint in Stripe.
  2. If application error: replay from `webhook_dlq` once fixed.
- **Root-cause fix:** Add a regression test that posts the failing event payload to the handler.

### RB-004 — Supabase connection limit hit

- **Severity:** SEV-2
- **Symptom:** `remaining connection slots are reserved` in Sentry; users see 500s.
- **First check:**
  1. Supabase dashboard → Database → Pooling → connection count.
  2. Identify long-running queries: `SELECT pid, query, state, query_start FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;`
- **Mitigation:**
  1. Terminate long-running queries with `SELECT pg_terminate_backend(<pid>);`
  2. Switch the app to the Supavisor transaction-pooled connection string if not already.
- **Root-cause fix:** Identify the leaking query path. Add a statement timeout (`SET statement_timeout = '5s'`) on user-facing service routes.

### RB-005 — Clerk down or misconfigured

- **Severity:** SEV-1 (all tenants locked out)
- **Symptom:** All users at sign-in screen; Sentry shows Clerk 5xx; `authMode.ts` resolves to `blocked`.
- **First check:**
  1. https://status.clerk.com
  2. Confirm `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set in Vercel for the failing environment.
- **Mitigation:**
  1. If Clerk outage: post status page note; wait. No safe local override — demo mode is fail-closed in prod (by design).
  2. If config: re-set the env vars, redeploy.

### RB-006 — Database migration broke production

- **Severity:** SEV-1 if data-impacting, SEV-2 otherwise
- **Symptom:** Latest deploy shows app-wide errors after a migration applied.
- **First check:**
  1. `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;`
  2. Read the failing migration. Did it lock a busy table? Drop a column the code still reads?
- **Mitigation:**
  1. Roll back the Vercel deployment to the prior commit.
  2. If a migration must be reversed, write a *new* migration that does the reversal. Do not edit the failing file.
- **Root-cause fix:** Migrations are forward-only. Defensive: every column drop or rename ships in two migrations — first additive, second destructive after a deploy.

### RB-007 — Suspected secret leak

- **Severity:** SEV-1
- **Symptom:** Secret-scanning alert (GitHub, Snyk) fires, or someone pushes a key.
- **First check:**
  1. Confirm the leak in the commit.
  2. Identify which credential.
- **Mitigation:**
  1. Rotate immediately in the source provider (Stripe → roll key, Clerk → roll key, Supabase → roll service role).
  2. Update the value in AWS Secrets Manager (Sprint 0 D3) → trigger Vercel redeploy.
  3. `git push` rotation: even though rotation makes the old key dead, also expunge from history if it was a long-lived key (`git filter-repo`).
- **Postmortem:** Required for every secret leak. Update `gitleaks` rules if the scanner missed it.

### RB-008 — Vercel deploy failing

- **Severity:** SEV-3
- **Symptom:** Pushes to `main` don't deploy.
- **First check:**
  1. Vercel dashboard → deployments → latest → build logs.
  2. `npm ci && npm run build` locally.
- **Mitigation:**
  1. Revert the offending commit; reland a fixed version.
  2. If Vercel platform issue: status.vercel.com.

### RB-009 — Cron job didn't run

- **Severity:** SEV-3
- **Symptom:** A scheduled task (member-care sweep, anomaly check, ledger reconcile) didn't write its expected row.
- **First check:**
  1. Vercel dashboard → Cron Jobs → execution history.
  2. Sentry for that route name.
- **Mitigation:**
  1. Trigger the route manually with the cron header.
  2. If platform issue: switch the job to Inngest as a temporary fallback.

### RB-010 — Outbound email / SMS bounced or undelivered

- **Severity:** SEV-3
- **Symptom:** Staff reports member didn't receive message; Resend/Twilio dashboard shows failure.
- **First check:**
  1. Resend dashboard → Logs (filter by recipient).
  2. Twilio Console → Monitor → Logs → Messaging.
- **Mitigation:**
  1. Confirm sending domain is verified (Resend) / phone is provisioned (Twilio).
  2. If recipient bounced, mark in `people.communication_status` so we don't keep trying.
- **Root-cause fix:** wire bounce webhooks so we mark bad addresses automatically.

---

## Backups & restore

- **Supabase:** daily automated backups (Pro plan or higher required for PITR — confirm before launch).
- **Restore drill:** scheduled once per quarter; first drill before pilot launch.
- **Procedure:**
  1. Spin up a new Supabase project in the same region.
  2. Restore the most recent snapshot.
  3. Point a staging Vercel preview at the restored project.
  4. Verify the cross-tenant smoke test passes against the restore.
  5. Time the drill end-to-end; record in this runbook.

## Status page

- Not yet provisioned. Sprint 6 candidate (BetterStack or statuspage.io).
- Until then, incidents are communicated by email + in-app banner (banner component already exists: `src/components/UpdatePrompt.tsx`).
