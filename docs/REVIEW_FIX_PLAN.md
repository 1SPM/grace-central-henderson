# Post-Build Review Fix Plan

Fixes for the blind spots found in the 2026-07-18 adversarial review of
the six-stage Mission Control build. Written by the reviewing model with
**verified evidence** (Vercel runtime logs, live SQL, a live spoof test)
— the Critical findings are not hypotheses, they are confirmed broken in
production right now.

Executor note: where this plan says **INSPECT**, read the referenced
file and adapt — the reviewer did not read that exact file. Where it
gives code or SQL verbatim, it was written against verified current
state; still diff-check before pasting. Execute stages **in order**;
Stage A is the one that matters most.

---

## Ground rules (same as the build plan)

**Verification gates** — all three must pass before each stage's commit:
```
npx tsc --noEmit
npm run lint
npx vitest run --pool=threads
```
The threads pool can transiently fail with `Failed to start threads
worker` — a file that then passes in isolation is a flake; a real
assertion failure is never a flake.

**Migrations**: apply via the Supabase MCP `apply_migration` (project
`asphekfvpiancyltzdxp`), then `get_advisors` (security) and confirm no
new findings. Commit any new SQL file too. Next free file number is
`052`.

**Deploys**: commit + push to `origin/main` only — never Vercel
"Redeploy" (it reuses frozen env snapshots). Verify READY via the
Vercel MCP (project `prj_h2Aag8O2gXxu4Yr1e4O8ZQrYrI6Q`, team
`team_1Rfco24h7wqbpETmjoAWIWUM`). One commit+push per stage.

**Data safety**: Central Henderson
(`11111111-1111-1111-1111-111111111111`) is a real production tenant.
This plan includes one sanctioned write against it (the Stage B
crisis-pref seeding migration — a config default, not member data).
Nothing else in this plan may write to it. Faithful
(`22222222-2222-2222-2222-222222222222`) is the demo tenant.

---

## Stage A — Revive the crons, close the spoof hole (CRITICAL)

### What the review proved (do not re-litigate, but do re-verify at the end)

- Vercel runtime logs, last 24h: `/api/cron/agents` 07:00 → **401**,
  `/api/cron/ai-anomaly` 05:00 → **401**, `/api/cron/reconcile-stripe`
  06:00 → **401**, `/api/cron/notify` every 15 min → **401**. Only
  `/api/cron/send-pending-emails` (08:00) returns 200.
- Root cause: `CRON_SECRET` is **not set** in the Vercel project env,
  and Vercel does **not** send an `x-vercel-cron` header. The four
  broken routes fail closed without the secret; `send-pending-emails`
  fails **open** (runs unauthenticated when no secret is set).
- Spoof confirmed live: `curl -H "x-vercel-cron: 1"
  https://grace-crm-two.vercel.app/api/cron/notify` → **200** from the
  public internet. The header-trust branch is an unauthenticated
  trigger for every cron that has it.
- `cron_runs` (migration 030) was never applied to this database — the
  migration ledger starts at 038; `information_schema` confirms the
  table is absent. Every `recordCronRun()` has silently no-opped, which
  is why none of this was visible.
- Consequence already measured: `health_snapshots` has exactly 2 rows,
  both written manually during Stage 3's acceptance check. The nightly
  job has never contributed one.

### A1. Set CRON_SECRET (operator/env step — do this FIRST)

Generate a secret (`openssl rand -base64 32`) and add it as
`CRON_SECRET` to the Vercel project for the **Production** environment
(`vercel env add CRON_SECRET production` if the CLI is authenticated,
otherwise the dashboard). When this env var exists, Vercel's cron
scheduler automatically sends `Authorization: Bearer <CRON_SECRET>`
with every cron invocation — that is the entire mechanism; no vercel.json
change is needed.

It must be set **before** the Stage A code push, because functions read
env from their deployment snapshot — one deploy then picks up both the
var and the code.

### A2. Apply migration 030 (existing file, never applied)

`supabase/migrations/030_cron_runs.sql` already exists in the repo and
is idempotent. Apply its exact content via the MCP
(`apply_migration`, name `cron_runs`). Do **not** create a new file or
renumber. Then run `get_advisors` — if `cron_runs` shows an
RLS-enabled-no-policy INFO or a missing-RLS finding, **INSPECT** the
file: if it doesn't enable RLS, add a follow-up migration `052` enabling
RLS with no policy (service-role-only posture, same as
`notification_cursors`) rather than editing 030.

### A3. One shared cron-auth helper, fail-closed, no header trust

New file `api/_lib/cronAuth.ts`:

```ts
/**
 * Cron authorization — shared by every api/cron/* route.
 *
 * Vercel's cron scheduler sends `Authorization: Bearer <CRON_SECRET>`
 * when the CRON_SECRET env var is set on the project. That bearer match
 * is the ONLY accepted credential:
 *   - `x-vercel-cron` is NOT trusted. Vercel does not send it (verified
 *     via runtime logs 2026-07-18: real scheduler invocations carried
 *     no such header), and inbound requests CAN carry it (verified via
 *     live spoof test: an external curl with the header reached a 200).
 *     Trusting it is an unauthenticated trigger, not an auth check.
 *   - Missing CRON_SECRET is a visible misconfiguration (503), never a
 *     silent fail-open. The pre-review send-pending-emails behavior
 *     (run unauthenticated when no secret is set) is exactly how a
 *     misconfiguration stays invisible for months.
 *
 * Returns null when authorized; otherwise sends the response and
 * returns the status it sent (caller just `return`s).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export function requireCronAuth(req: VercelRequest, res: VercelResponse): number | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'cron_secret_not_configured' });
    return 503;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return 401;
  }
  return null;
}
```

Wire it into **all five** cron routes, deleting their local checks:

- `api/cron/_agents.ts` — delete `isAuthorized()` + the `CRON_SECRET`
  const; replace the guard with
  `if (requireCronAuth(req, res) !== null) return;`
- `api/cron/_notify.ts` — same.
- `api/cron/_ai-anomaly.ts` — **INSPECT** (not read by the reviewer;
  expected to be a copy of the agents pattern). Same replacement.
- `api/cron/_reconcile-stripe.ts` — **INSPECT**. Same replacement.
- `api/cron/_send-pending-emails.ts` — this one currently fails OPEN
  (no secret ⇒ runs) and ALSO accepts a spoofed `x-vercel-cron: '1'`
  even when the secret is set. Replace its inline check (lines ~37-42)
  with the helper. This is a deliberate behavior change: after A1 the
  secret exists, so nothing breaks; without A1 it would 503 loudly,
  which is the point.

### A4. Tests

New `api/_lib/cronAuth.test.ts`:
- no `CRON_SECRET` env → 503 `cron_secret_not_configured`.
- secret set, no Authorization header → 401.
- secret set, `x-vercel-cron: '1'` header and no bearer → **401**
  (spoof regression test — this is the one that matters).
- secret set, wrong bearer → 401.
- secret set, correct bearer → returns null, no response written.

Follow the env-var save/restore pattern in `api/_lib/sms/send.test.ts`.

### A5. Stage A acceptance

1. Gates pass; commit + push; deployment READY (env var already set
   from A1).
2. `/api/cron/notify` fires every 15 minutes — check Vercel runtime
   logs after the next quarter-hour tick: it must now log **200** (was
   401).
3. Spoof re-test: `curl -H "x-vercel-cron: 1"
   https://grace-crm-two.vercel.app/api/cron/notify` must now return
   **401** (was 200).
4. `SELECT * FROM cron_runs ORDER BY created_at DESC LIMIT 5;` shows a
   `notify` row after that tick (proves both the auth fix and migration
   030 landed).
5. Manually trigger the nightly job once rather than waiting for 07:00
   UTC: `curl -H "Authorization: Bearer <CRON_SECRET>"
   https://gracecrm-centralhenderson.org/api/cron/agents` — this runs
   the real production pipeline, which is sanctioned (it's exactly what
   the schedule should have been doing all along). Verify
   `health_snapshots` gains a row per church for today and `cron_runs`
   records `agents` + `health`.

---

## Stage B — Crisis-alert coverage + realtime fallback (HIGH)

### B1. Seed crisis-email defaults for existing staff (migration 052)

Today Central Henderson has **zero** `staff_notification_prefs` rows —
a crisis-flagged care request would email nobody, because defaults are
only lazily seeded when a staff member first opens the Settings →
Notifications card. New file
`supabase/migrations/052_seed_crisis_notification_prefs.sql`
(idempotent), applied via MCP:

```sql
-- One-time default: every active staff member whose role grants
-- care.view gets crisis/email/enabled=true, matching the build plan's
-- intent ("crisis email defaults ON for roles holding the care key").
-- ON CONFLICT DO NOTHING preserves any explicit opt-out that already
-- exists. This intentionally writes to ALL tenants including Central
-- Henderson — it is a notification-config default, not member data.
INSERT INTO staff_notification_prefs (church_id, user_id, category, channel, enabled)
SELECT u.church_id, u.id, 'crisis', 'email', true
FROM users u
WHERE u.account_status = 'active'
  AND u.church_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = u.id
      AND ur.revoked_at IS NULL
      AND p.key = 'care.view'
  )
ON CONFLICT (user_id, category, channel) DO NOTHING;
```

**INSPECT** `user_roles` column names against migration 032 before
applying (the `revoked_at IS NULL` filter is used elsewhere in the
codebase and is expected to be right).

### B2. Fallback in `notifyCrisisStaff` for never-configured churches

Seeding covers today's staff; a church whose staff have no prefs rows
at all (future tenants, staff added later who never open Settings) is
still uncovered. In `api/_lib/crisisNotify.ts`, change the query to
fetch crisis-category rows **without** the `enabled` filter, then:

- recipients = rows with `enabled=true` (current behavior);
- **only if the church has zero crisis rows of any kind** (never
  configured — distinct from "everyone explicitly opted out"), fall
  back to emailing every active `care.view` holder in the church.

For the fallback lookup, reuse the permission-resolution approach in
`api/_lib/authz.ts` (`loadPermissionKeys` / its underlying joins) or
the `user_has_permission(p_user_id, p_church_id, 'care.view')` RPC —
**INSPECT** which is cleaner to call with the service client; staff
counts are small, a per-user RPC loop is acceptable. Fallback sends
email only (no SMS — no opt-in exists). Update the file's header
comment and extend `crisisNotify.test.ts`:
- zero rows for church → falls back, emails care.view holders;
- rows exist but all `enabled=false` → **no** sends, no fallback
  (explicit opt-out is respected);
- mixed → only enabled recipients, no fallback.

### B3. Decision Queue: always-on background poll

`src/hooks/useDecisionQueue.ts` currently starts its 60s fallback poll
only on `CHANNEL_ERROR`/`TIMED_OUT`. An RLS-filtered subscription
reports a healthy `SUBSCRIBED` while delivering nothing — which is the
guaranteed state on the demo tenant (no Clerk session ⇒
`realtime.setAuth()` never called ⇒ anonymous websocket ⇒
`platform_events` RLS blocks every message), and the possible state on
the real tenant if the Clerk template/realtime handshake ever drifts.

Change: run the 60s poll **unconditionally** whenever the hook is
active (`isLoaded && churchId`), alongside the realtime subscription.
Keep the 3s-debounced realtime refresh (it provides the ~5s liveness);
the poll is the floor, not the mechanism. Delete the
CHANNEL_ERROR-conditional poll logic. Keep the
`!isSupabaseConfigured()` poll-only branch.

### B4. Crisis deep-link env override

`api/portal/_care.ts` builds `APP_URL` from
`FRONTEND_URL || https://VERCEL_URL || localhost`, and
`api/_lib/crisisNotify.ts` appends a hardcoded `/app#/pastoral-care` —
right for `gracecrm-centralhenderson.org` (SPA at `/app`), wrong for
root-mounted hosts, and the `VERCEL_URL` fallback is a raw deployment
URL. Minimal fix: introduce optional env `STAFF_APP_URL` (full URL to
the staff SPA including any path prefix, e.g.
`https://gracecrm-centralhenderson.org/app`). In `crisisNotify.ts`,
build the deep link as
`${process.env.STAFF_APP_URL ?? appUrl + '/app'}#/pastoral-care`.
Document `STAFF_APP_URL` in `.env.example`. Ask the operator to set it
in Vercel (not blocking — the fallback is today's behavior).

### B5. Stage B acceptance

- After migration 052: `SELECT count(*) FROM staff_notification_prefs
  WHERE church_id = '11111111-1111-1111-1111-111111111111';` is > 0,
  and every row's user holds care.view.
- Unit tests from B2 pass; full gates pass; commit + push; READY.
- On the deployed Faithful demo (`?enter=demo`), leave the WorkOS
  Overview open ~90s and confirm via the network log that
  `/api/workos/decision-queue` refetches on the poll interval without
  any user action (proves B3 in the environment where realtime is
  silently dead).

---

## Stage C — Hardening + small fixes + debt ledger (MEDIUM/LOW)

### C1. Custom-domain uniqueness (host squatting)

`api/tenant/_hosts.ts` PUT: before the update, check whether any
**other** church already claims one of the submitted hosts:

```ts
const { data: conflicts } = await supabase
  .from('churches')
  .select('id, hosts')
  .neq('id', actor.churchId)
  .overlaps('hosts', hosts);
if (conflicts && conflicts.length > 0) {
  return res.status(409).json({ error: 'host_already_claimed' });
}
```

**INSPECT**: `.overlaps` is the PostgREST array-overlap filter (`ov`);
if the installed supabase-js version lacks it, use
`.filter('hosts', 'ov', `{${hosts.join(',')}}`)`. Note the check is
advisory (two concurrent PUTs could still race — acceptable; note it in
the code comment). Never echo the conflicting church's identity in the
response. Add a route test: church B PUTting a host present in church
A's `hosts` fixture → 409, no update call. Also add a light hostname
shape validation (lowercase, no scheme/slash/space:
`/^[a-z0-9.-]+$/`) → 400 otherwise. Also extend
`tests/fixtures/mockSupabase.ts` with a no-op `overlaps` (and
`filter`) passthrough — same one-line pattern as the `.contains`
addition from Stage 4.

### C2. Notification-prefs robustness

`api/workos/_notification-prefs.ts` PUT:
- de-dup the payload by `category:channel` before the upsert (last
  entry wins) — duplicate pairs in one upsert are a Postgres error
  ("cannot affect row a second time") surfacing as a 500;
- `phone: null` explicitly **clears** the stored phone
  (`update({ phone: null })`) instead of being skipped — currently a
  phone can never be removed. Keep `phone: undefined`/absent as
  "unchanged". Update the two behaviors' tests.

### C3. TECH_DEBT.md

- Add a **Resolved** entry: cron auth incident — 4 of 5 crons never ran
  (missing CRON_SECRET + fail-closed check) while the check was
  simultaneously spoofable from the internet (`x-vercel-cron` header
  trust); fixed by Stage A (shared `requireCronAuth`, fail-closed 503
  on missing secret, no header trust) with the resolving commit hash.
- Add a small P3 entry: digest cron cursor uses `.gt(created_at)` —
  events sharing the exact timestamp of a batch's last row across the
  2000-row page boundary could be skipped; revisit if event volume ever
  approaches the page size.
- Update TD-058 if C2's phone-clearing changes its wording.

### C4. Explicitly NOT in scope (leave alone)

- The digest's whole-batch retry semantics (TD-057) — intentional.
- `api/_routes/sms.ts` legacy Twilio duplication (TD-056) — its own
  change.
- Realtime sign-out token reset — benign (~60s token expiry).
- Migrating neobank to `impact_card.operate` (noted under TD-053).
- The two-browser realtime test on the **real** tenant still requires
  two real Clerk staff sessions — out of reach for an agent session.
  After Stage B the poll bounds staleness at 60s regardless; note it in
  the completion report as verified-by-construction, not live.

### C5. Stage C acceptance

Gates pass; commit + push; READY. On deployed Faithful demo: PUT a host
that Central Henderson doesn't own → 200; attempt a host seeded into a
scratch second church's `hosts` (use Faithful + a temporary SQL-seeded
value on the OTHER demo-safe church if one exists, else assert via the
route test only — do **not** touch Central Henderson's hosts array);
prefs PUT with `phone: null` clears the phone (verify via follow-up
GET).

---

## Completion report

Per stage: what shipped, commit hash, evidence for each Stage A
acceptance item (the runtime-log 200s, the 401 spoof re-test, the
cron_runs rows, the new health_snapshots rows). Call out anything
deferred and any INSPECT that diverged from this plan's assumption.
