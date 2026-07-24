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

Registry of the 11 named agents (`api/_lib/agentRegistry.ts`). **3 have a
real, recorded workflow** (`grace`, `verity`, `sentinel` —
`api/_lib/agentWorkflows.ts`): each reads real tables (overdue tasks,
blocked Work Orders, stale approvals, missing contact info, unowned Work
Orders, stale data-subject requests) and writes real `agent_runs` +
`agent_actions` rows. **The other 8 are registered but show "Not yet
implemented — no executions recorded"** rather than fabricated activity —
this was a deliberate scope decision (see TECH_DEBT.md TD-046), not an
oversight; the spec explicitly permits "controlled local or server-side
workflows" over full autonomy, and explicitly requires real recorded
execution over animated mock activity. None of the three implemented
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
