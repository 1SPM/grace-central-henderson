# ADMIN_WORKOS.md — Admin Dashboard WorkOS foundation

> Companion to `SHARED_BACKEND.md` (the schema/API/authorization foundation
> this phase builds a UI on top of). Describes what was added inside the
> existing Admin Dashboard (`gracecrm-centralhenderson.org/app#/dashboard`)
> to make it the operational control centre named in this phase's brief.

---

## 1. What this phase is

A new "GRACE WorkOS" section inside the existing Admin Dashboard shell —
same sidebar, same routing convention (hash-based `View` + an internal
tab pattern that mirrors `CareHub`/`SettingsHub`), same design system
(Tailwind utility classes, `StatusBadge`/`ProgressBar`/`EmptyState`/
`HubPageHeader` primitives already in `src/components/ui/`). Nothing in
the existing dashboard was replaced or rewritten.

Six modules, one shell (`src/components/workos/WorkOsHub.tsx`):

| Tab | Component | Backs onto |
|---|---|---|
| Overview | `ExecutiveOverview.tsx` | `GET /api/workos/summary` |
| Work Orders | `WorkOrderList.tsx` / `WorkOrderDetail.tsx` / `WorkOrderCreateModal.tsx` | `api/work-orders/*` |
| Task Board | `TaskBoard.tsx` | `GET/PATCH /api/work-orders/tasks` |
| Approvals | `ApprovalCentre.tsx` | `api/approvals/*` |
| Agents | `AgentCommandCentre.tsx` | `api/agents/workos-*` |
| Audit | `AuditTimeline.tsx` | `GET /api/audit/timeline` |

Reached at `#/workos` (sidebar: "GRACE WorkOS"), sub-routed via
`?tab=` and `?id=` query params on the hash — `src/lib/workosNav.ts`,
same pattern as `src/lib/careNav.ts`.

---

## 2. Executive Overview — metric honesty

Every metric in `api/_lib/workosMetrics.ts` is a live count against a real
table, computed in `api/workos/_summary.ts` at request time. No metric is
estimated, cached-from-demo-data, or invented. All twelve metrics named in
the spec are shown — none were dropped, because all twelve are
computable from tables that already exist (several will legitimately read
`0` on a fresh tenant with no volunteer placements yet, for example — that
is real data, not a placeholder).

Each metric carries `definition`, `period`, `source`, and `last_updated`
(query time) in the API response; the UI shows the value by default and
reveals the rest behind an info affordance, plus a "View details →"
drill-down into the relevant existing dashboard view where one exists.

---

## 3. Work Order Centre

List (filterable by status), create, detail (tasks, dependencies,
evidence, progress bar, status control, approval request, completion
report), all against the `api/work-orders/*` routes built in the shared
foundation phase. One schema gap found while building the Task Board was
fixed here: `work_order_tasks.status` didn't originally include
`under_review`, which this phase's Task Board spec requires as a column
— see migration `041_task_board_under_review.sql`.

Status transitions are enforced both client-side (the dropdown only construction
aside, the server is authoritative) and server-side
(`api/work-orders/_index.ts` `ALLOWED_TRANSITIONS`, unit-tested).

## 4. Task Board

A second lens on the same `work_order_tasks` rows the Work Order detail
view shows — not a parallel task system. Five columns: To Do, In
Progress, Blocked, Under Review, Completed. Status changes go through the
same `PATCH /api/work-orders/tasks` route the detail view uses. Added a
`GET` handler to that route for the board's cross-Work-Order listing
(gated by `work_orders.view`, looser than the `work_orders.manage` gate
on writes).

## 5. Approval Centre

Queue filterable by pending/decided/all. Each card shows proposed action,
requestor (staff or agent), risk level, and — once decided — the decision
and any notes. Decisions post through `PATCH /api/approvals`, gated by
`approvals.decide` (a narrower grant than `approvals.view` — see
`SHARED_BACKEND.md`'s role matrix; e.g. Ministry Leader can see the queue
in a future build-out but was never granted decide rights).

## 6. Agent Command Centre

Registry of the 16 named agents (`api/_lib/agentRegistry.ts`). **5 have a
real, recorded workflow** (`grace`, `verity`, `sentinel`, `shepherd`,
`steward` — `api/_lib/agentWorkflows.ts`): each reads real tables
(overdue tasks, blocked Work Orders, stale approvals, missing contact
info, unowned Work Orders, stale data-subject requests, unassigned care
requests, ledger reconciliation) and writes real `agent_runs` +
`agent_actions` rows. The registry's `implemented` flags and the
workflow map are bound by a test
(`api/_lib/agentRegistryBinding.test.ts`) so they cannot drift — a
mismatch previously shipped a live "Run now" button that 501'd (Steve).
**The other 11 are registered but show "Not yet
implemented — no executions recorded"** rather than fabricated activity —
this was a deliberate scope decision (see TECH_DEBT.md TD-046), not an
oversight; the spec explicitly permits "controlled local or server-side
workflows" over full autonomy, and explicitly requires real recorded
execution over animated mock activity. None of the five implemented
workflows call an LLM, use randomness, or simulate latency — they are
scanners, not autonomous actors, matching the "calm, credible,
operational" tone requirement.

## 7. Audit and activity timeline

Merges `audit_logs` (security/compliance trail) and `platform_events`
(domain events) into one chronological, searchable feed
(`GET /api/audit/timeline`), gated by `audit.view`. Respects role-based
visibility the same way every other module does — a caller without
`audit.view` gets a 403 message, never a filtered-but-empty 200 (an audit
surface should fail loud, not fail silent).

---

## 8. The required demonstration: GRACE Impact Card Pilot Readiness

`POST /api/work-orders/pilot-readiness` (button on the Work Order list:
"Create Impact Card Pilot Readiness Work Order") creates one real
`work_orders` row and ten real `work_order_tasks` rows — document
inventory, product readiness, financial assumptions, member onboarding,
communication planning, privacy review, risk review, KPI definition,
launch checklist, independent validation. From there it's an ordinary
Work Order: status transitions, per-task evidence, an approval request,
and `GET /api/work-orders/completion-report` produce a template-generated
(not LLM-generated) completion report, persisted as an `artifacts` row
(`kind='report'`) — see migration `040_artifact_inline_content.sql`,
which added inline `content` storage to `artifacts` since no external
file-storage integration exists yet.

**Explicit non-claim:** the "financial assumptions" task description and
the Work Order's own description both state outright that this
demonstration does not connect to any live financial provider (Stripe,
i2c). Nothing in this phase wires a real payment or card-issuance call —
verified by a unit test (`pilotReadiness.test.ts`,
`completionReport.test.ts`) that asserts neither "stripe" nor "i2c" nor
"connected to" appears in any generated task description or report
narrative.

---

## 9. Making it actually clickable in the live demo

The live Central Henderson demo (`gracecrm-centralhenderson.org`) runs
with `VITE_ENABLE_DEMO_MODE=true` and no production Clerk instance (per
the current-state assessment). Without any accommodation, every WorkOS
API call would 401/503, making this entire phase undemonstrable on the
one URL named in the brief. `api/_lib/authz.ts`'s `resolveStaffActor` now
recognizes the same `VITE_ENABLE_DEMO_MODE` flag the rest of the app
already uses (`api/_middleware/auth.ts`) and bootstraps a real `users` row
with `system_administrator` permissions — every Work Order, task,
approval, and agent run created through the demo is a real database row
attributed to that real user, not a client-side fake. See
`TECH_DEBT.md` TD-043 for the explicit "confirm disabled before a real
tenant" tracking entry — same posture as the pre-existing demo-mode
waiver in `SECURITY_FINDINGS_STATUS.md`.

---

## 10. Files added/changed — see the completion output in-conversation for the full list; summarized here by area:

- **Schema:** migrations `039`–`041` (agent permissions, inline artifact content, Task Board status column).
- **Backend:** `api/_lib/{workosMetrics,agentRegistry,agentWorkflows,completionReport}.ts`, `api/workos/*`, `api/agents/_workos-{registry,run}.ts`, `api/audit/_timeline.ts`, `api/work-orders/_{pilot-readiness,completion-report}.ts`, plus a `GET` handler added to `api/work-orders/_tasks.ts`, plus the demo-mode bootstrap in `api/_lib/authz.ts`.
- **Frontend:** `src/lib/workosNav.ts`, `src/lib/services/workos.ts`, `src/hooks/use{WorkOrders,Approvals,AgentCommandCentre,AuditTimeline,WorkOsSummary,WorkOsPermissions,TaskBoard}.ts`, `src/components/workos/*.tsx`, `AuthContext.getAuthToken`, `types.ts`/`Layout.tsx`/`ViewRenderer.tsx`/`useRouteGuard.ts`/`useHashRouter.ts` wiring.
- **Tests:** see the completion output.

---

## 11. Campus (the Virtual Campus tab)

`#/workos?tab=campus` — `src/components/workos/CampusView.tsx`. A 2D,
top-down model of the church drawn on a canvas from the building's
architectural floor plan (1 tile = 2.5 ft, 56 × 64 tiles), in the style of
the VWS Virtual Office concept: a spatial front-end over live WorkOS state.

- **Data, not code:** `campus/campusMap.ts` (rooms, doors, furniture, floor
  patches), `campus/campusBindings.ts` (each room's department → the CRM
  routes it owns + permission hints), `campus/campusAssignments.ts` (which
  agent sits where, which character it wears — the seating chart, meant to
  be edited).
- **Renderer:** `campus/CampusRenderer.ts` — Canvas 2D; static floor/wall
  layer built once, y-sorted furniture + characters per frame, pan/zoom,
  hit-testing, agents idling/wandering in their rooms, the visitor walking
  with arrow keys (collision with walls/furniture). No game library.
- **Live state:** agent pips and side-panel status come from
  `GET /api/agents/workos-registry` (the same hook as the Agents tab);
  "Run now" is the same `POST /api/agents/workos-run`; per-room "N waiting"
  comes from the Decision Queue counts by kind. Nothing on the campus has a
  power the WorkOS does not already have — rooms deep-link into existing hubs.
- **Honesty rules carried over:** unbuilt agents are grey pips at empty
  desks; the Care Wing is tinted/dashed and its department is
  confidential-tier (presence and counts only); the Night Crew (cron agents
  outside the registry) is listed on the hallway Bulletin Board, not drawn as
  staff; VWS platform agents (Steve/Charles/Marco) sit in a "Platform Annex"
  — the borrowed storage room — not on the ministry floor.
- **Art:** `public/campus/atlas.png` is a packed subset of LimeZu tiles
  built by `tools/campus/build-atlas.mjs` from the source packs (not in the
  repo) — see `public/campus/CREDITS.txt`.
- **Tests:** `campus/campusMap.test.ts` — rooms never overlap, every room has
  a department and vice versa, every door is walkable on both sides, every
  registry agent has a walkable seat inside its room, every room is reachable
  on foot from the canopy, every furniture sprite exists in the atlas with a
  matching collision footprint.

---

## 12. Ministry areas — the shared operational map

GRACE is the north star. An **area** is a job the church office does; the
campus and the control panel are two views of the same map:

```
area → accountable human (users)  → supporting agent (registry) → campus room
     → GRACE surfaces (existing routes)
     → work: work_orders.ministry, Decision Queue kinds
```

- **Definition (code):** `api/_lib/ministryAreas.ts` — 14 areas, each with the
  exact `work_orders.ministry` string it owns, the RBAC role that should hold
  it, a default agent and room, its GRACE surfaces, and its Decision Queue
  kinds. Re-exported to the browser as `src/lib/ministryAreas.ts` so there is
  one definition, not two.
- **Assignment (data):** `ministry_assignments` (migration `066`) stores only
  the three links a pastor can change — owner, agent, room. No row = coded
  default. Not in `churches.settings`, because `useChurchSettings` rewrites
  that whole JSONB blob from the browser and would drop unknown keys.
- **Resolver:** `resolveAreas()` in `ministryAreas.ts` is pure (no IO, no
  clock) and unit-tested, same posture as `decisionQueue.ts`. An override
  pointing at someone who is no longer active staff resolves to
  `owner: null` — an honest gap, never a dangling id.
- **API:** `GET/PUT /api/workos/areas`. GET = any active staff actor;
  PUT = `admin.manage_settings`, audited as `ministry_area_reassigned`.
  `null` and "absent" are distinct in the PUT body (null clears a link) —
  the shared `uuid_()`/`str()` validators collapse them, which is TD-045, so
  those three fields are hand-validated.
- **Surfaces, all reading one hook (`useMinistryAreas`):**
  - Campus room panel — the pairing for whichever areas sit in that room.
    A room may host several areas (Giving and Impact Card share the work
    room); all are rendered, none hidden.
  - WorkOS Overview — `MinistryAreasPanel`, the same `AreaPairing`
    component, for the whole church.
  - Agents tab — each agent card names the area, person, and room it supports.
  - Settings → **Ministry Areas** — where a pastor reassigns the three links.
- **The campus follows the assignment:** an agent's character stands in its
  area's room (`CampusRenderer.setAgents` honours `CampusAgent.room`), so
  moving an area in Settings moves the sprite on the map.
- **Honesty:** unassigned areas say "Nobody assigned — should be held by
  <role>"; defaults are labelled "default" rather than shown as decisions;
  counts are live queries. Nothing invents a person, a run, or a readiness.
- **Tests:** `src/lib/ministryAreas.test.ts` (cross-file invariants: every
  area's room and agent are real, ministry strings unique, every Decision
  Queue kind owned exactly once, one primary surface each) and
  `api/_lib/ministryAreas.test.ts` (the resolver, including the
  deactivated-owner and unknown-area cases).

The AI clergy layer (`#/leadership`) is untouched and stays its own thing:
it models pastoral presence, not operational accountability, and the two
never share an identity.

### 12.1 Work Order ownership

`work_orders.owner_user_id` has existed since migration `034` and Verity has
flagged unowned Work Orders since `agentWorkflows.ts` shipped, but nothing in
the UI could answer her. `OwnerPicker` (`src/components/workos/OwnerPicker.tsx`)
is that control:

- **Detail** — the owner sits next to status; changing it PATCHes and reloads.
- **List** — every row names its owner, or shows an amber "Unowned".
- **Create** — an owner can be named at creation. Left unset the server still
  defaults to the creator, which is the pre-existing behaviour.
- **Staff list** — `GET /api/workos/staff` (`useChurchStaff`), thin by design:
  id, display name, title. Any active staff actor may read it.

Two server-side details worth knowing:

- `PATCH /api/work-orders` now reads `owner_user_id` off the **raw** body, so
  an explicit `null` clears the column. The shared `uuid_()` validator maps
  null to undefined and the `{ ...body }` spread then drops it — TD-045 —
  which meant "unassign" was previously impossible. Assignment is still
  gated by `work_orders.manage`.
- A named owner is verified to be an **active user of the caller's church**
  before it is written (`owner_not_in_church` otherwise).

An owner who later leaves the staff list is shown as "Former staff member"
rather than silently reading as unowned. Task-level ownership
(`work_order_tasks.owner_user_id`, and the unused `useTaskBoard.reassignTask`)
is deliberately still untouched.

### 12.2 The GRACE window — campus and chat as one unit

Every Grace entry point (sidebar orb, dock, ⌘/) now opens one **floating,
non-modal window** instead of the fixed pop-out: the 2D campus fills it, the
Ask Grace chat sits as a right rail, and the brand quick-tag rail appears
when the window is wide or fullscreen.

- `src/components/ui/FloatingWindow.tsx` — generic shell: drag by header
  (pointer capture), corner resize, fullscreen toggle (double-click header
  works too), Esc closes, geometry persisted per device
  (`grace-window-geometry`), clamped so the header can never leave the
  viewport. Below `sm` it is always fullscreen. **No backdrop by design** —
  the app stays live behind it, which is what makes moving it useful.
- `CampusView` gained `embedded`/`onNavigated` props: canvas fills the
  container, the room/area panel becomes an overlay card on the map, and
  clicking a GRACE surface navigates the app underneath **and closes the
  window** — in that moment the campus is a launcher.
- Responsive inside the window: under 900px wide the campus yields entirely
  and the window is chat-only; the brand rail needs ≥1240px or fullscreen.
- **Collapse the campus**: a header toggle hides the map, turning the window
  into the classic GRACE unit — orb + quick-tag rail + chat. Remembered per
  device (`grace-window-campus-collapsed`), and hidden below 900px where
  there is no campus to toggle. With the map gone the brand rail needs far
  less room, so it stays from 700px up rather than 1240px.
- `#/workos?tab=campus` is unchanged — same component, two mounts.

### 12.3 Gather-inspired campus polish

Five ideas adapted from researching Gather (a real multiplayer virtual-office
product) into the single-admin GRACE campus, plus the RBAC gap the research
surfaced along the way.

1. **Mini Mode** — a third `FloatingWindow` state beyond windowed/fullscreen.
   The Minimize button shrinks the whole GRACE window to a small draggable
   pill (orb + a live Decision Queue count) that stays on screen while the
   pastor works elsewhere in the CRM; a plain click restores it, a real drag
   moves it without restoring (disambiguated by movement distance, not by a
   timer). Persists per device alongside the rest of the window geometry.
2. **Action-first room panel** — the room panel now leads with one filled
   button ("Open <primary surface>") above the fold, Gather's "Wave" pattern
   applied to "the one thing worth doing at this desk." The full surface
   list stays below as detail, not removed. The agent "Run now" button was
   upgraded from outline to filled to match.
3. **Agent "wave"** — an agent's sprite does a brief lift-and-scale pulse
   when its `latest_run.finished_at` changes while the window is already
   open (`CampusView` diffs `agents` against a ref; `CampusRenderer.bounce()`
   plays it). The animation curve is `computeBounce()`, a pure exported
   function, unit-tested without a canvas. Nothing bounces on first load —
   the diff ref starts empty, so every key looks unchanged on mount.
4. **Ministry-area color coding** — every area now carries `accentColor` (14
   distinct hex values, picked to avoid the 5 semantic status-pip colors).
   Rendered as a thin strip under the room's canvas label
   (`CampusRenderer.setRoomMeta`) and a left-border/dot on the `AreaPairing`,
   `MinistryAreasPanel`, and Settings cards. Never applied to a status pip —
   that channel stays ran/never-run/failed only.
5. **Calendar pins** — `GET /api/workos/areas` now also fetches upcoming
   `calendar_events` and attaches the soonest one per area via
   `attachNextEvents()` (pure, 14-day lookahead). `calendar_events.category`
   maps to an area through `EVENT_CATEGORY_AREA` — deliberately partial:
   `holiday`/`event`/`other` map to nothing rather than being guessed onto a
   room. Surfaced as a small dot next to the room's canvas label plus a
   "Next: <title> — <when>" line in the pairing panel.

**RBAC fix, found while grounding the "staff portal" question.** The four
non-admin Faithful staff seeded in `ministry_assignments` (Naomi, Fatoumata,
Trevor, Ivy) held only the generic `Member Services` role from the 059
backfill — e.g. Naomi owned Giving & Stewardship but had zero
`giving_financial.*` permission. Granted each their job-matching role
(`Finance`, `Pastoral Care`, `Volunteer Coordinator`, `Communications`) on
top of the existing grant — RBAC is additive, nothing was revoked. Their
`clerk_id`s remain synthetic demo values (`demo-staff-finance+<churchId>`,
etc.) — nobody can actually sign in as any of them yet; that still runs
through the existing `api/team/_invite.ts` flow (migration 055), untouched
here.

**Dev-server fix.** `src/lib/ministryAreas.ts` re-exports
`api/_lib/ministryAreas.ts` so the browser and the API share one
definition. In `npm run dev`, Vite serves that sibling file at its
root-relative path — `/api/_lib/ministryAreas.ts` — which collided with
`vite.config.ts`'s `/api` proxy rule and got forwarded to the (often not
running) backend instead of served as a module, breaking every page that
imports the shared map. Fixed with a narrow `bypass` for `/api/_lib/*`
(no real API route is ever registered under that prefix). Production was
never affected — Vite's build step doesn't run this dev-only proxy.
