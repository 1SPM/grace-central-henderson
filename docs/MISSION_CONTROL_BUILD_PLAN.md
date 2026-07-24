# Mission Control Build Plan

Staged build turning GRACE from a set of modules into a living mission
control: a unified decision queue, an accountable agent-findings
lifecycle, an outcomes scorecard, provisioning automation, and realtime
operations. Designed 2026-07-17; execute stages **in order** — later
stages depend on earlier schemas and surfaces.

Executor note: this plan was written by a larger model front-loading the
design decisions. Where it says **INSPECT**, the current code was not
fully verified at planning time — read the referenced file and adapt
rather than trusting the plan's guess. Where it gives a schema or rule
verbatim, follow it verbatim.

---

## Ground rules (apply to every stage)

**Verification gates** — all three must pass before a stage's commit:
```
npx tsc --noEmit
npm run lint
npx vitest run --pool=threads
```
The forks pool is flaky in this environment; always use `--pool=threads`.
A `Failed to start threads worker` / worker-timeout error on a file that
then **passes in isolation** is a known transient flake — re-run the
single file to disambiguate. A real assertion failure is never a flake.

**Migrations**: numbered SQL files in `supabase/migrations/` (next free
number is `046`), idempotent throughout (`IF NOT EXISTS`,
`ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS` before CREATE). Apply
via the Supabase MCP `apply_migration` (project `asphekfvpiancyltzdxp`),
then run `get_advisors` (security) and confirm no new findings on the
new tables. Commit the SQL file too.

**Deploys**: commit + push to `origin/main` only — never Vercel
"Redeploy" (it reuses frozen env snapshots; established session rule).
Verify the deployment reaches READY via the Vercel MCP
(project `prj_h2Aag8O2gXxu4Yr1e4O8ZQrYrI6Q`,
team `team_1Rfco24h7wqbpETmjoAWIWUM`). One commit+push per stage.

**Conventions**:
- New API routes: `api/<module>/_<name>.ts`, registered in
  `api/[...path].ts` with `.js` import extensions.
- Staff auth: `requirePermission(req, res, supabase, '<key>')` from
  `api/_lib/authz.ts`. Member auth: `resolveMemberActor`. Never gate on
  the coarse JWT role when a granular permission key exists.
- Every mutation emits the two-call pattern: `emitPlatformEvent` +
  `recordAudit` (see `api/work-orders/_request-approval.ts` for the
  verbatim shape). Event names use dots: `agent_finding.triaged`.
- Pure logic lives in `api/_lib/<name>.ts` as IO-free functions with
  unit tests (pattern: `financeMetrics.ts`, `givingTiers.ts`).
- Metrics that lack backing data return
  `{ value: null, source: 'not_yet_computed' }` — never a fabricated
  number (pattern: `impactCardFunnelMetrics.ts`).
- Frontend staff hooks mirror `useWorkOsSummary` / `useWorkOsPermissions`
  (`workosFetch` + `useAuthContext().getAuthToken`); panels live in
  `src/components/workos/`.
- Test doubles: `tests/fixtures/mockSupabase.ts`; authz test patterns in
  `api/_lib/authz.test.ts`.

**Data safety**: Central Henderson
(`11111111-1111-1111-1111-111111111111`) is a **real production
tenant**. Never seed demo data there outside the typed-confirmation path
defined in Stage 4. The Faithful demo tenant is
`22222222-2222-2222-2222-222222222222`. Test fixtures never contain real
PII. Maya Thompson (`people.id c67fa64b-9b16-4c64-b594-9fe93b22c738`,
tagged `portal-demo`) is a sanctioned demo persona inside the real
tenant.

**Do not touch**: `previews/*.html` mockups, `api/neobank/_index.ts`
beyond the explicit Stage 0 scope, the Clerk JWT template, or
`vercel.json` CSP except where Stage 5 says so.

---

## Stage 0 — Quick fix: Members Portal wallet auth

**Goal**: close the known gap flagged in commit `f29a52d` — the Portal's
Impact Card page authenticates via the *global* Clerk token provider
(`getClerkTokenProvider` in `src/lib/supabase.ts`), which only the staff
`AuthContext` registers. Real portal-only members and preview sessions
get a dead wallet page.

**Changes**:
1. In `src/portal/PortalAuthContext.tsx`'s `PortalAuthProviderInner`,
   register the token provider exactly as the staff `AuthContext` does
   (synchronous effect, `setClerkTokenProvider` with the
   `supabase`-template-then-plain fallback), and clear it on sign-out.
   `setClerkTokenProvider` is already exported from `src/lib/supabase`.
2. Preview mode (`isPreview` in `PortalAuthContext`): the wallet page
   cannot work with a `pvt_` token (`api/neobank` uses `requireClerkAuth`
   directly). Do **not** refactor neobank. Instead make
   `src/portal/hooks/usePortalImpactCard.ts` /
   `src/portal/pages/PortalGiving.tsx` render an explicit
   "Wallet is not available in staff preview" state when
   `usePortalAuth().isPreview` is true — reuse the existing
   `signed_out`/unavailable rendering path.

**Tests**: extend or add a portal test asserting the preview state
message renders when `isPreview` is true.

**Acceptance**: sign in as `maya.thompson+demo@gracecrm-centralhenderson.org`
on the live site → the Give/Impact Card page loads her real card
(`•••• 4821`, $18.42 balance) instead of the signed-out state. In a
staff preview session, the wallet section shows the explicit
not-available-in-preview message, not an error.

---

## Stage 1 — Decision Queue ("The Bridge")

**Goal**: one server-computed queue of everything awaiting human
judgment, severity-ordered with aging and deep links, surfaced as the
first thing staff see in WorkOS plus a nav badge.

### Migration 046 (`046_impact_card_permissions.sql`)

`api/neobank` currently gates staff resources on coarse
`STAFF_ROLES = ['admin','pastor','staff']`. The queue needs a granular
key for card-ops items. Follow the verbatim pattern of
`039_agent_permissions.sql`:

```sql
INSERT INTO permissions (key, module, action, sensitivity, description) VALUES
  ('impact_card.operate', 'impact_card', 'operate', 'confidential',
   'Review KYC, manage cards, and handle Impact Card transfers')
ON CONFLICT (key) DO NOTHING;
-- grants: senior_pastor, finance, impact_card_operations
-- (system_administrator gets it automatically via the 032 cross-join)
```

Do **not** change neobank's own gating in this stage — the key exists
for queue filtering; migrating neobank to it is future work.

### Pure function: `api/_lib/decisionQueue.ts`

`computeDecisionQueue(inputs, now)` — IO-free. Takes pre-fetched raw
rows per category, returns sorted `DecisionQueueItem[]` plus counts.

```ts
interface DecisionQueueItem {
  id: string;                 // source row id
  kind: 'approval' | 'related_party_review' | 'crisis' | 'care_triage'
      | 'kyc_review' | 'failed_transfer' | 'invitation_stalled'
      | 'agent_task';         // 'agent_task' is replaced by 'agent_finding' in Stage 2
  title: string;              // confidentiality-safe one-liner
  detail?: string;
  severity: 'critical' | 'high' | 'normal';
  created_at: string;
  age_hours: number;
  href: string;               // in-app deep link
  required_permission: string;
  subject_type: string;
  subject_id: string;
}
```

Sort: severity (critical > high > normal), then `age_hours` desc.

### Category sources and gating

| kind | source rows | severity | permission gate |
|---|---|---|---|
| `crisis` | `care_requests` open statuses + `crisis_flagged` | critical | `care.view` (**INSPECT** exact key in the 032/043 catalog) |
| `related_party_review` | `approvals` where `related_party_flagged` and `related_party_reviewed_at IS NULL` | high | `approvals.view` (**INSPECT** key) |
| `approval` | `approvals` awaiting decision (**INSPECT** the status/decision model in `api/approvals/_index.ts` — a decisions table exists) | high; critical if `risk_level` is the highest tier | `approvals.view` |
| `failed_transfer` | `card_transfers` where `status='failed'` | high | `impact_card.operate` |
| `kyc_review` | `kyc_verifications` where status in `pending`,`in_review` | normal | `impact_card.operate` |
| `care_triage` | `care_requests` status `submitted`, not crisis | high if `priority` is highest tier else normal | `care.view` |
| `invitation_stalled` | `member_invitations` status `sent`, older than 7 days | normal | any resolved staff actor (invites are coarse-gated today; leave a code comment marking the granular-key TODO) |
| `agent_task` | open `tasks` created by the agent runner — **INSPECT** `api/_lib/agents/runner.ts`'s task insert to find the linking column (likely via `agent_logs`); join the last 7 days of `agent_logs` sink='task' to incomplete tasks | normal | `agents.view` |

**Confidentiality rule**: care/crisis titles are category + priority +
age only — never the summary text (same convention Shepherd already
follows). Prayer moderation: **INSPECT** `api/portal/_prayer.ts` and
migration 043 for whether a pending-moderation state actually exists; if
yes add a `prayer_moderation` kind gated on the care/prayer key, if no
**omit the category entirely** — do not invent a state.

**Deep links**: reuse the existing hash-nav helpers
(`src/lib/congregationNav.ts`, `actionCenterNav.ts` are the pattern —
**INSPECT** how WorkOS tabs and the Pastoral Care / Impact Card Accounts
views are addressed). Every `href` must land on the screen where the
item is actionable.

### Route: `api/workos/_decision-queue.ts` → key `workos/decision-queue`

GET only. `resolveStaffActor` (any active staff may ask); fetch each
category **only if** the actor holds its gate permission (skip queries
for locked categories); pass rows to `computeDecisionQueue`; return
`{ items, counts: { total, critical, by_kind } }`. No mutations, so no
platform event.

### Frontend

- `src/hooks/useDecisionQueue.ts` — `workosFetch` pattern, `refresh()`,
  no polling yet (Stage 5 adds realtime).
- `src/components/workos/DecisionQueuePanel.tsx` — severity-grouped
  list: color chip, title, age ("4h", "3d"), each row a deep link. Empty
  state must be affirmative ("Queue clear — nothing awaiting a
  decision"). Place it **first** in the WorkOS Overview
  (**INSPECT** the overview composition where `GiftInKindPanel` etc.
  were added).
- Nav badge: the WorkOS sidebar item in `Layout.tsx` shows
  `counts.total` (red if any critical). Mount the hook where Layout can
  reach it, gated on a staff-role user; fetch once on load.

### Tests

- Unit: `decisionQueue.test.ts` — severity ordering, aging math, a
  crisis item never contains summary text, counts.
- Route: mockSupabase test proving an actor **without** `care.view`
  produces zero care/crisis items and no care query (assert via
  `supabase.__calls`).

### Acceptance

Seed (Faithful tenant): one related-party-flagged approval, one
crisis-flagged care request, one failed transfer. The queue shows all
three ordered crisis → related-party/failed-transfer, each deep link
lands on its actionable screen, the nav badge shows 3 (red), and a
caller holding only `approvals.view` sees exactly one item.

---## Stage 2 — Agent findings lifecycle

**Goal**: agent output becomes accountable. Observations from both agent
systems (cron runner and WorkOS workflows) persist as findings with a
lifecycle, convert to work orders in one click, auto-resolve when the
work order completes, and report per-agent precision.

### Migration 047 (`047_agent_findings.sql`)

```sql
CREATE TABLE IF NOT EXISTS agent_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  agent_id TEXT NOT NULL,          -- 'member-care'…'crisis-escalation', workflow keys, 'event'
  source TEXT NOT NULL CHECK (source IN ('cron','workflow','event')),
  dedup_key TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  severity TEXT NOT NULL DEFAULT 'normal'
    CHECK (severity IN ('critical','high','normal','info')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','triaged','actioned','resolved','dismissed')),
  subject_type TEXT,
  subject_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  work_order_id UUID REFERENCES work_orders(id),
  task_id UUID REFERENCES tasks(id),
  triaged_by_user_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  suppress_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_findings_dedup
  ON agent_findings(church_id, dedup_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_findings_status
  ON agent_findings(church_id, status);
-- RLS: standard tenant_isolation policy (church_id = public.get_church_id())
```

Reuse `agents.view` (read) and `agents.manage` (triage/dismiss/convert)
— no new permission keys.

### Runner integration (`api/_lib/agents/runner.ts`)

Additive — **keep the existing task/interaction sinks working unchanged**
as a mirror during transition:

1. For each observation, also insert an `agent_findings` row
   (`source='cron'`, `task_id` linked when sink='task'). Severity
   mapping: `crisis-escalation` agent → `critical`; otherwise map from
   the observation's own priority field if one exists (**INSPECT**
   `AgentObservation` in `types.ts`), default `normal`.
2. New dedup logic **for findings only** (leave the 24h `agent_logs`
   dedup untouched for the mirrored sinks): skip insert when a row with
   the same `(church_id, dedup_key)` exists with status in
   `open/triaged/actioned`, **or** the most recent `dismissed` row with
   that key has `suppress_until > now()`.

### Workflow integration

**INSPECT** the route that executes Command Centre workflows
(Shepherd/Steward etc., the `(supabase, churchId) => AgentWorkflowResult`
pattern per TD-046) and persist each returned finding as an
`agent_findings` row with `source='workflow'`, same dedup rule.

### Event-triggered v1 (pragmatic, no new infra)

In the portal care-submission path where a request is crisis-flagged
(**INSPECT** `api/portal/_care.ts` for the crisis-detection point),
synchronously insert an `agent_findings` row (`agent_id
'crisis-escalation'`, `source='event'`, severity `critical`) so a crisis
reaches the queue in seconds instead of at the nightly cron. Broader
event-bus subscription is explicitly out of scope.

### Route: `api/agents/_findings.ts` → key `agents/findings`

- `GET` (filters: `status`, `agent_id`; plus `?stats=1` returning the
  precision payload) — `agents.view`.
- `PATCH { id, action: 'triage' | 'dismiss' | 'resolve', dismissed_reason?, suppress_days? }`
  — `agents.manage`. Dismiss sets `suppress_until = now() + suppress_days`
  (default 7). Every transition: `emitPlatformEvent`
  (`agent_finding.<action>`) + `recordAudit`.
- `POST { id, action: 'convert_to_work_order' }` — `agents.manage`.
  Creates a work order carrying the finding's title/detail/subject
  (**INSPECT** `api/work-orders/_index.ts` POST for the required insert
  shape and reuse it), sets finding → `actioned` + `work_order_id`,
  emits `agent_finding.converted`.

### Auto-resolve hook

In the work-order status-transition route (**INSPECT** — transition
rules live in `statusTransitions` logic under `api/work-orders/`), after
a successful transition **to completed**: update any `agent_findings`
with that `work_order_id` and status `actioned` → `resolved`,
`resolved_at = now()`, emit `agent_finding.resolved`.

### Pure function: `api/_lib/agentPrecision.ts`

`computeAgentPrecision(rows)` → per agent: generated, dismissed,
actioned, resolved counts, dismissal rate, median hours open→resolved
(null when no resolved findings — `not_yet_computed` convention).

### Frontend

- `useAgentFindings` hook (list + stats + actions).
- Command Centre (**INSPECT** the existing Agent Command Centre
  component under `src/components/workos/`): findings list with status
  chips, Convert / Dismiss (reason prompt) / Resolve buttons, and a
  per-agent stats bar (precision %, median resolution time).
- Decision Queue: replace Stage 1's `agent_task` category with
  `agent_finding` (open findings, severity passthrough, href → Command
  Centre findings tab).

### Tests

Unit: precision math incl. empty/no-resolved cases; dedup rule matrix
(open blocks, dismissed+active suppression blocks, expired suppression
allows). Route: PATCH gated on `agents.manage` (403 without), dismiss
sets suppression. Auto-resolve: completing a linked work order resolves
the finding (mockSupabase asserting the update call).

### Acceptance

Run an agent from the Command Centre → findings appear with status
`open` and show in the Decision Queue. Convert one to a work order in
one click; complete that work order → the finding flips to `resolved`
without manual action. Dismiss another with a 7-day window → re-running
the agent does not recreate it. Stats bar shows per-agent precision and
median resolution time. Submitting a crisis-flagged care request via the
portal creates a critical finding within seconds, no cron involved.

---

## Stage 3 — Congregational Health scorecard

**Goal**: connect activity to outcomes. Per-person engagement scores and
church-level north stars, snapshotted daily so trends exist, honest
`not_yet_computed` wherever data is missing, drill-down to real people.

### Migration 048 (`048_health_snapshots.sql`)

```sql
CREATE TABLE IF NOT EXISTS health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(church_id, snapshot_date)
);
-- RLS: tenant_isolation
```

Gate all reads on the existing `analytics.view` key (**INSPECT** the
exact key name in the 032 catalog; `api/impact/_ministry-metrics.ts`
already uses it).

### Pure functions: `api/_lib/healthMetrics.ts`

- `computeEngagementScore(events, now)` — recency-weighted activity over
  90 days, 0–100. Weight high-intent events (gift, rsvp, checkin,
  group_join, milestone_achieved) above passive ones (login,
  *_view). Cap any single event type's contribution so one behavior
  can't max the score. Document the formula in a comment **and** state:
  this measures platform engagement, never spiritual standing — that
  framing is a hard requirement, in code comment and UI copy both.
- `computeHealthMetrics(inputs)` → north stars, each
  `{ value, source: 'computed' | 'not_yet_computed', detail }`:
  - **visitor_conversion_90d**: of people with `first_visit` in the last
    90 days, share now status `member`/`regular`. Zero denominator →
    `not_yet_computed`.
  - **recurring_coverage**: people with an active `recurring_giving` row
    ÷ people with status member/regular.
  - **care_responsiveness**: **INSPECT** `care_requests` columns for a
    triage timestamp. If none exists, compute the honest substitute —
    median age of currently-open `submitted` requests — and label it
    "open care request age", not "SLA".
  - **group_participation**: distinct persons in active
    `group_memberships` ÷ members+regulars.
  - **portal_adoption**: people with `portal_enabled` and a
    `clerk_user_id` ÷ members+regulars.
  - **engagement**: mean score + `at_risk_count`.
- `computeAtRiskMembers(events, people, now)` — persons with activity in
  the last 180 days but none in 45 (explainable rule beats a clever
  one). Return ids + last-activity dates.

### Snapshot job

**INSPECT** the existing cron route that runs the agent runner (the
`cron_runs` table records `job: 'agents'`) and add a `health` job to the
same nightly invocation: compute metrics per church, upsert
`ON CONFLICT (church_id, snapshot_date)`. Record in `cron_runs`.

### Route: `api/impact/_health.ts` → key `impact/health`

GET — `analytics.view`. Returns
`{ current, snapshots: last 120 days, at_risk: person ids + names }`.
Compute `current` live; read trends from snapshots.

### Frontend

- `useCongregationalHealth` hook.
- `HealthScorecardPanel.tsx` in WorkOS Overview, directly under the
  Decision Queue: one tile per north star with a trend sparkline built
  from weekly points (last snapshot per ISO week). Cold start (<2 weekly
  points): show current values with "Trends appear after two weeks of
  snapshots" — never an empty chart. `not_yet_computed` renders as an
  explicit "needs more data" state, never 0.
- At-risk drill-down: tile click opens the member list (name,
  last-activity) linking to each person profile via the existing person
  navigation.

### Tests

Unit: score weighting/caps, every metric's empty-data path returns
`not_yet_computed`, at-risk rule boundaries, snapshot-upsert
idempotency (two runs same day → one row).

### Acceptance

After the nightly job runs (or a manual invocation), snapshots exist per
church; the panel renders real values for Faithful and honest
`not_yet_computed` markers where data is thin; the at-risk list names
real people whose profiles open on click; Maya Thompson's seeded journey
gives her a visibly non-zero engagement score; no metric anywhere
displays a fabricated number.

---

## Stage 4 — Provisioning Studio

**Goal**: turn this session's manual operations into product. Three
parts, in this order.

### 4a. DB-driven host → branding (design decision — read carefully)

Real-client tenancy is resolved from the **JWT `church_id` claim**, not
the hostname — hostnames only matter for (i) client-side branding of a
white-label domain and (ii) the demo-mode auth bypass. Therefore:

- **The demo-bypass host list stays hardcoded** in
  `api/_lib/authz.ts` (`HOST_CHURCH_IDS`) and
  `src/config/tenant.ts`. Enabling an auth bypass for a host **should**
  require a code change — that is a security posture, not a limitation.
  Do not move it to the database.
- What becomes DB-driven is **branding**: migration 049 adds
  `hosts TEXT[] NOT NULL DEFAULT '{}'` to `churches` (+ a GIN index).
  New **public** route `api/tenant/_config.ts` → key `tenant/config`:
  `GET ?host=` returns `{ church_name, branding }` from the matching
  church's `settings.branding` — public-safe fields only, never
  settings at large, cache-control ~5 minutes.
- `getTenant()` keeps its static map as the fast path; for unknown
  hosts, App boot fetches `tenant/config` and applies name/branding
  (**INSPECT** how tenant branding currently flows into the UI from
  `src/config/tenant.ts` and reuse that shape). Unknown host with no DB
  match → current default behavior, demo mode off.
- Settings UI (`canManageSettings`): a "Custom domains" card editing the
  church's `hosts` array, with a static checklist note that the domain
  must also be attached to the Vercel project (manual dashboard step).

### 4b. Provision portal account (productize `scripts/provision-portal-member.ts`)

Migration 049 also adds permission `portal.provision_member`
(module `portal`, action `provision`, sensitivity `confidential`),
granted to `senior_pastor` and `member_services` (system_administrator
automatic).

Route `api/people/_provision-portal.ts` → key `people/provision-portal`,
POST `{ person_id, mode: 'invite' | 'direct' }`, gated on
`portal.provision_member`:
- `invite`: delegate to the existing invitation logic
  (**INSPECT** `api/members/_invite.ts`; extract/reuse its single-person
  core rather than duplicating).
- `direct`: server-side replica of tonight's manual sequence, in order —
  create the Clerk user (`skipPasswordChecks`/`skipPasswordRequirement`,
  `publicMetadata { church_id, role: 'member', person_id }` — exactly
  the `_accept-invitation.ts` metadata shape), upsert the `users` row
  (`role 'member'`), set `people.clerk_user_id` + `portal_enabled`,
  insert an `accepted` `member_invitations` row for the audit trail.
  Idempotent: if a Clerk user already exists for the email, converge
  metadata instead of failing (the script's existing behavior).
  `CLERK_SECRET_KEY` is already in the Vercel env — the entire point is
  that the secret never touches a laptop again.
- Both modes: `emitPlatformEvent('portal.member_provisioned')` +
  `recordAudit`.

UI: on `PersonProfile.tsx`, when `!person.portalEnabled` and the caller
holds the permission, a "Set up portal account" button (mode choice,
result shows the email + "they sign in via forgot-password"). Sits
beside the existing Preview button; after success, refresh so the
Preview button appears.

### 4c. Demo persona generator (productize tonight's seed SQL)

Route `api/people/_seed-demo-persona.ts` → key
`people/seed-demo-persona`, POST, gated on `portal.provision_member`:

- Creates a person + coherent journey, parameterized: name, and a
  seeded profile that includes discipleship milestones (respect the
  UNIQUE constraint), 1–2 journey goals, membership in the church's
  first active small group, a recurring gift sized to qualify for the
  church's configured `givingTiers` (if none configured, seed the gift
  anyway and note "no tiers configured" in the response — **never**
  silently mutate church settings), 2–3 one-time gifts, a public prayer
  post, an RSVP to the next upcoming event (skip if none), an approved
  KYC + active card + funded account + 2–3 interchange events (mock
  adapter ids, following tonight's seeded shapes), and a small
  `member_activity_events` trail.
- **Tenant guard**: if the target church is not a recognized demo tenant
  (reuse the server-side demo-church set), require
  `body.confirm === <exact church name>`; wrong/missing → 409 with the
  expected phrase's requirement (never echo the full name back).
- **Tagging**: person gets tag `demo-persona` and a notes marker; every
  seeded row with a JSONB metadata column gets `{ "demo": true }`.
- Emits `portal.demo_persona_seeded` + audit.

UI: a "Demo Studio" card in Settings (visible with the permission):
persona generator + link to the domains card. On a non-demo tenant the
card shows the typed-confirmation input with an explicit warning.

### Tests

Unit: seed-payload builder is a pure function
(`api/_lib/demoPersona.ts`) — test tier-qualification math, the
no-groups/no-events skip paths, demo tagging on every row type. Route:
provision requires the permission (403 without); non-demo tenant without
confirmation → 409; `tenant/config` never returns non-branding settings
keys (assert against a settings object containing secrets-like keys).
Run the cross-tenant smoke suite if staging-configured; otherwise state
in the completion report that it was skipped and why.

### Acceptance

Adding a hostname to a church's domains card makes `tenant/config`
return its branding with no deploy. "Set up portal account" on a
portal-less member yields a working Clerk login (correct metadata,
`users` row, accepted invitation) with zero terminal involvement, and
the action is in the audit timeline. "Generate demo persona" on
Faithful produces a member whose live portal shows milestones, a
computed giving tier, and a funded wallet. The same action on Central
Henderson refuses without the typed church name, and when confirmed,
every created row carries the demo tag.

---

## Stage 5 — Realtime + staff notifications

**Goal**: the queue updates without refresh; crisis events reach staff
in under a minute; everything else arrives as a preference-respecting
digest.

### Migration 050 (`050_realtime_notifications.sql`)

```sql
-- Realtime publication (idempotent guard):
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='platform_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE platform_events;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff_notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  user_id UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN
    ('crisis','approvals','finance','agents','digest')),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, channel)
);
CREATE TABLE IF NOT EXISTS notification_cursors (
  job TEXT PRIMARY KEY,
  last_event_created_at TIMESTAMPTZ NOT NULL
);
-- RLS on staff_notification_prefs: tenant_isolation;
-- notification_cursors is service-role-only (RLS enabled, no policy needed
-- beyond that — service key bypasses RLS; verify get_advisors accepts it
-- or add a deny-all policy comment).
```

**INSPECT** `platform_events`' existing RLS policy — Realtime
`postgres_changes` respects RLS, so the tenant-isolation policy is what
prevents cross-church leakage. Confirm it exists and uses
`get_church_id()` before enabling the publication.

### Realtime client

- **CSP first**: check `vercel.json` `connect-src` allows
  `wss://asphekfvpiancyltzdxp.supabase.co` (the `https:` origin being
  allowed does not imply `wss:`). This project has been burned by CSP
  twice — verify in the deployed response headers, not just the file.
- After the Clerk token provider registers (staff `AuthContext`), call
  `supabase.realtime.setAuth(<clerk supabase-template token>)` and
  refresh it alongside token refresh.
- `useDecisionQueue` subscribes to `postgres_changes` INSERTs on
  `platform_events` and calls a **debounced (~3s) `refresh()`** — the
  event is a "something changed" signal, never parsed for content. On
  channel error, fall back silently to a 60s poll.

### Crisis path (synchronous, no infra)

At the same crisis-detection point Stage 2 instrumented
(`api/portal/_care.ts`): look up staff with `crisis` prefs enabled and
send immediately via the existing server-side email helper
(**INSPECT** the Resend integration under `api/` for the reusable send
function; SMS via the existing `sms/send` internals if a phone is on
file and the sms channel enabled). Content: "Crisis-flagged care request
awaiting triage" + deep link — **no member details in the
email/SMS body**. Failure to send must never fail the member's care
submission (try/catch, log).

### Digest fan-out (cron)

New cron route `api/cron/_notify.ts` (**INSPECT** how the existing
agents cron route authenticates — CRON_SECRET header or Vercel cron
signature — and match it; add the schedule to `vercel.json` `crons`,
every 15 minutes). Logic: read events since
`notification_cursors['notify']`, group by church → category (map
`eventType` prefixes: `approval.*`→approvals, `agent_finding.*`→agents,
finance events→finance), join enabled prefs, send one summarized email
per user, advance the cursor **only after** successful sends. Record in
`cron_runs`.

Pure function `api/_lib/notificationDigest.ts`:
`groupEventsForDigest(events, prefs)` → per-user send list. Unit-test
the grouping, category mapping, disabled-pref exclusion, and empty
result advancing nothing.

### Prefs API + UI

`api/workos/_notification-prefs.ts` → key `workos/notification-prefs`
(GET own prefs / PUT upsert own prefs — any staff actor, self-scoped:
the route derives `user_id` from the actor, never the body). Settings
UI: a "Notifications" card of category × channel toggles; crisis email
defaults **on** for roles holding the care key (seed default rows
lazily on first GET).

### Tests

Unit: digest grouping suite. Route: prefs are self-scoped (attempting to
write another user_id is ignored/rejected); crisis path unit test
asserts the email helper is called for enabled prefs and that a thrown
send error does not propagate to the care response.

### Acceptance

Two browsers on the same tenant: creating an approval in one raises the
other's queue badge within ~5 seconds, no refresh. A crisis-flagged
portal care submission produces a staff email within one minute
containing a deep link and no member PII. Muting a category verifiably
stops that category's digest items. A second tenant's events never
appear in the first tenant's realtime channel (verify with a
Faithful-tenant session open while acting on Central Henderson).

---

## Completion report (after Stage 5)

Summarize per stage: what shipped, migration numbers, new
permissions/routes/events, test counts, deviations from this plan (with
reasons), and anything deferred. Update `TECH_DEBT.md`: close the wallet
token-provider gap (Stage 0), note neobank's pending migration to
`impact_card.operate`, and any new items discovered.
