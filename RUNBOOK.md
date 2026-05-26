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
- **Symptom:** Sentry alert `alert_kind=ai_burn_anomaly` (fired by the hourly `/api/cron/ai-anomaly` job) — burn rate ≥5× the 7-day trailing average AND last-hour spend ≥ $0.10. May also surface as a Gemini billing alert.
- **First check:**
  1. ```sql
     SELECT church_id, feature, SUM(cost_micro_usd) / 1e6 AS spend_usd, COUNT(*) AS calls
     FROM token_usage
     WHERE created_at > now() - interval '24 hours'
     GROUP BY 1, 2
     ORDER BY spend_usd DESC
     LIMIT 20;
     ```
  2. Identify the top spender and the responsible feature.
- **Mitigation:**
  1. Lower the offender's cap so the gateway returns 402 on the next call:
     ```sql
     UPDATE church_ai_budgets SET monthly_cap_micro_usd = 0 WHERE church_id = '<uuid>';
     ```
  2. If it's a runaway internal job, disable the cron via Vercel dashboard → Cron Jobs.
  3. The gateway will hard-cut at `cap × multiplier` regardless (default 1.10×). Set the multiplier to 1.00 to make the cap a hard wall.
- **Root-cause fix:** Find the loop or prompt blow-up. Filter `token_usage` by `feature` column to attribute. Add a `feature`-level cap if a single feature is overspending.

### RB-003 — Stripe webhook failures

- **Severity:** SEV-2
- **Symptom:** Stripe dashboard shows red webhook delivery; OR `webhook_dlq` row count rising; OR Sentry events from `/api/webhooks/stripe`.
- **First check:**
  1. Read the DLQ:
     ```sql
     SELECT id, webhook_event_id, event_type, attempt_count, last_attempt_at, error_message
     FROM webhook_dlq
     WHERE resolved = FALSE
     ORDER BY last_attempt_at DESC
     LIMIT 20;
     ```
  2. Stripe Dashboard → Developers → Webhooks → click the failing endpoint → "Recent deliveries". Read the response body.
  3. Check our error in Sentry: filter `route:/api/webhooks/stripe`.
- **Mitigation:**
  1. If signature failure (400 in our response): confirm `STRIPE_WEBHOOK_SECRET` matches the endpoint in Stripe. Rotate if compromised.
  2. If application error: fix the root cause, then replay from the DLQ admin endpoint:
     ```bash
     curl -X POST $APP_URL/api/admin/webhooks/dlq \
       -H "Authorization: Bearer $CLERK_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"action": "replay", "webhook_event_id": "<uuid from webhook_dlq.webhook_event_id>"}'
     ```
     The dispatcher's idempotency means double-replay is safe — `ledger_entries.UNIQUE(source, source_event_id)` blocks duplicates.
- **Root-cause fix:** Add a regression test in `api/_lib/webhooks/stripe-dispatch.test.ts` that feeds the failing event payload through the dispatcher.

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

### RB-011 — Sprint 1 RLS rollout (planned procedure, not an incident)

- **Severity:** N/A — scheduled work
- **Purpose:** Switch from permissive RLS (migration 005) to church-scoped RLS (migration 011) without breaking client reads.
- **Prerequisite check** (no go without all green):
  1. `tools/lint-rls.ts` clean against all migrations (CI gate `rls-lint`).
  2. Clerk Dashboard → JWT Templates: a template named `supabase` exists and its claims include `app_metadata.church_id`.
  3. Supabase Dashboard → Authentication → Third-Party Auth: Clerk provider configured with the matching Frontend API URL.
  4. Staging Supabase project exists with two test tenants (A, B) and two real Clerk-issued tokens.
  5. `.env.local` (staging) has `SUPABASE_TEST_URL / _ANON_KEY / _TENANT_A_TOKEN / _TENANT_B_TOKEN / _TENANT_A_ID / _TENANT_B_ID` populated.
- **Procedure:**
  1. Apply migration `011_rls_church_scoped.sql` to **staging only**.
  2. Run `npx vitest run tools/cross-tenant-smoke.test.ts` against staging — every assertion must pass.
  3. Spot-check the staging app as a real signed-in user. Pages MUST load with rows visible (not empty); pulling another tenant's data via a known UUID MUST return zero rows.
  4. Verify `audit_logs` is recording mutations from the staging session.
  5. Roll forward to production: apply migration 011 to prod. Watch Sentry for a spike in `403`s or empty-result errors over the next 30 minutes.
  6. If empty results spike (signs of broken JWT delivery): toggle PostHog flag `read-only-mode` to true, post in-app banner, investigate `auth.jwt()` payload via a server-side debug endpoint.
- **Rollback:** Run an inverse migration that re-creates the `USING (true)` policies. The rollback migration is part of the same PR and committed alongside 011 for atomic deploys.

### RB-012 — AI moderation flagged a request

- **Severity:** SEV-3 (single-user impact); SEV-2 if pattern across many users (could indicate prompt-injection campaign)
- **Symptom:** User sees 422 with `error: input_moderation_block` or `output_moderation_block` in `/api/grace/draft-reply` response; OR `token_usage.error_code` rows with `moderation_input` / `moderation_output`.
- **First check:**
  1. Rate of moderation blocks across tenants:
     ```sql
     SELECT church_id, feature, error_code, COUNT(*)
     FROM token_usage
     WHERE error_code IN ('moderation_input', 'moderation_output')
       AND created_at > now() - interval '24 hours'
     GROUP BY 1, 2, 3 ORDER BY COUNT DESC;
     ```
  2. If a single tenant accounts for >10 blocks/hr: investigate possible prompt-injection or compromised account.
  3. If output blocks (`moderation_output`) are non-zero: review the failing prompt + the moderation category in Sentry (`alert_kind=ai_moderation_output_block`, redacted) — could indicate model jailbreak.
- **Mitigation:**
  1. Single-user false positive: ask the user what they entered. The moderation result is in the gateway response (`flaggedCategories`).
  2. Compromise / abuse: rotate the user's session via Clerk; lower the tenant's AI cap; lock the account.
  3. Moderation outage (OpenAI down): the gateway fails OPEN by design (`request_failed` skip). The skip is logged in `token_usage.error_code` — verify volume; if sustained, switch to a backup moderation provider via env var.
- **Root-cause fix:** If false-positive rate is high on a known category (e.g., pastoral counseling content tripping `self-harm`), document the carve-out and consider a custom moderation policy.

### RB-013 — Webhook DLQ growing unbounded

- **Severity:** SEV-2 if ledger writes failing; SEV-3 if non-financial events
- **Symptom:** `webhook_dlq` unresolved count > 20 OR last_attempt_at is stale (>1h) for ≥5 rows.
- **First check:**
  1. ```sql
     SELECT event_type, error_class, COUNT(*) AS n, MAX(attempt_count) AS max_attempts
     FROM webhook_dlq
     WHERE resolved = FALSE
     GROUP BY 1, 2
     ORDER BY n DESC;
     ```
  2. Is the error_class clustered? A common error pattern means one root cause; investigate that.
- **Mitigation:**
  1. Group-replay safe DLQ rows once the root cause is fixed. Replays are idempotent at the ledger level.
  2. If errors are due to data integrity (e.g., FK to a non-existent `giving` row), open a SEV-2 ticket and pause replays until the data is reconciled.
  3. For Stripe specifically: Stripe will also retry independently of our DLQ. Set the Stripe webhook to "Auto-retry: off" during a remediation window to avoid double-processing.
- **Root-cause fix:** Resolve the underlying error. Add a regression test. Mark the DLQ rows resolved:
  ```sql
  UPDATE webhook_dlq
  SET resolved = TRUE, resolved_at = now(), resolved_by_clerk_id = '<your-clerk-id>', resolution_note = 'fixed in commit <sha>'
  WHERE id IN (...);
  ```

### RB-014 — Ledger reconciliation anomaly fired

- **Severity:** SEV-3 by default; SEV-2 if it's a `fee_without_credit` anomaly (could indicate stuck capture flow).
- **Symptom:** Sentry alert `alert_kind=ledger_reconciliation_anomaly` from the daily 06:00 UTC `/api/cron/reconcile-stripe` job. Tags: `reconcile_kind` ∈ {volume_spike, volume_drop, fee_without_credit, no_history_spike}, `church_id`, `source`.
- **First check:**
  1. ```sql
     SELECT kind, direction, SUM(amount_micro_usd) / 1e6 AS usd, COUNT(*) AS n
     FROM ledger_entries
     WHERE church_id = '<uuid>'
       AND occurred_at >= (CURRENT_DATE - INTERVAL '1 day')
       AND occurred_at <  CURRENT_DATE
     GROUP BY 1, 2;
     ```
  2. For `volume_spike` / `volume_drop`: compare to the trailing 7-day average per source.
  3. For `fee_without_credit`: the church received fees but no credits — likely indicates Stripe captured but our handler missed the payment_intent.succeeded event. Cross-check Stripe Dashboard → Payments for that day.
- **Mitigation:**
  1. `volume_spike`: usually benign (campaign, Sunday surge). Confirm with the church's staff if you can; mark the anomaly acknowledged.
  2. `volume_drop`: check if the church paused giving intentionally (vacation, staff transition). If unexpected, investigate Stripe webhook delivery.
  3. `fee_without_credit`: this is a real reconciliation failure. Find the missing `payment_intent.succeeded` events in Stripe Dashboard → replay each via DLQ admin OR via Stripe Dashboard → Resend.
- **Root-cause fix:** TD-034 — wire actual Stripe Balance API comparison so we surface drift in dollars, not just heuristics. Until then, periodic spot-checks against Stripe Dashboard.

### RB-015 — Agent run failed or stuck

- **Severity:** SEV-3 (operations agent), SEV-2 if member-care misses critical pastoral signal
- **Symptom:** Tenant's `agent_stats.last_run_at` is older than 48h OR `agent_logs` shows error rows OR `/api/cron/agents` response has non-empty `churches_failed`.
- **First check:**
  1. ```sql
     SELECT church_id, agent_id, last_run_at, total_actions, failed_actions
     FROM agent_stats
     WHERE last_run_at < now() - interval '48 hours'
     ORDER BY last_run_at;
     ```
  2. ```sql
     SELECT church_id, agent_id, level, message, metadata, created_at
     FROM agent_logs
     WHERE level = 'error' AND created_at > now() - interval '24 hours'
     ORDER BY created_at DESC LIMIT 50;
     ```
  3. Vercel dashboard → Cron Jobs → `/api/cron/agents` execution history.
- **Mitigation:**
  1. Manual re-run for one tenant (use the operator endpoint):
     ```bash
     curl -X POST $APP_URL/api/agents/run -H "Authorization: Bearer $CLERK_TOKEN"
     ```
     Dedup means this is safe to run multiple times; no double-observations within a 24h window.
  2. If a church's settings are corrupt: set explicit defaults:
     ```sql
     INSERT INTO church_agent_settings (church_id) VALUES ('<uuid>') ON CONFLICT (church_id) DO NOTHING;
     ```
  3. If the cron isn't firing at all: see RB-009.
- **Root-cause fix:** Look at the agent_logs error metadata for the exception class. Common causes: missing person rows referenced by interactions, malformed birthday strings (validated by the agent but the row insert may still fail), Supabase rate limits during a large tenant's run.

### RB-016 — KYC verification stuck or rejected unexpectedly

- **Severity:** SEV-3 — single-cardholder impact, but cards are revenue-blocking
- **Symptom:** `kyc_verifications.status` stuck in `pending` or `in_review` for >24h; OR cardholder reports rejection on a known-good application.
- **First check:**
  1. ```sql
     SELECT id, full_name, status, i2c_kyc_id, submitted_at, reviewed_at, rejection_reason
     FROM kyc_verifications
     WHERE church_id = '<uuid>'
     ORDER BY submitted_at DESC LIMIT 20;
     ```
  2. Are we in mock mode (i2c API key absent) or live mode (`I2C_LIVE` flag on)?
     - Mock mode: all submissions approve instantly unless name contains "DECLINE"/"FAIL". Stuck = bug. Check `api/_lib/i2c/mock-adapter.ts`.
     - Live mode: hit i2c sandbox/production console for the matching `i2c_kyc_id`.
- **Mitigation:**
  1. Mock-mode stuck submission: re-trigger by reapplying (deterministic IDs mean idempotent).
  2. Live rejection (false positive): contact i2c support. Update `rejection_reason` with the operator note:
     ```sql
     UPDATE kyc_verifications SET rejection_reason = '<operator note>' WHERE id = '<uuid>';
     ```
     (NOTE: kyc_verifications is NOT append-only — operator updates allowed.)
- **Root-cause fix:** When TD-036 lands (live i2c HTTP client), add error logs from the i2c response to `kyc_verifications.metadata` so we have richer diagnostics without round-tripping the i2c console.

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
