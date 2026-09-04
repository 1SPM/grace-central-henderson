# GRACE UI Parity — Phase 0 Integration Point Audit

**Date:** 2026-09-01 · **Branch:** `feat/ai-work-cards` @ `a88e326`
**Scope:** §5A of the Conversational UI Parity brief — locate the canonical
chat, routing, calendar, profile, permissions, and audit integration points.
**Status:** audit only. No code changed, nothing deployed, no live data altered.

Companion: [GRACE_INTELLIGENCE_STACK_MAP.md](GRACE_INTELLIGENCE_STACK_MAP.md)
and [GRACE_AUTHORITY_MATRIX.md](GRACE_AUTHORITY_MATRIX.md) already trace the
chat/permission/audit halves in depth; this note adds routing, calendar and
profile, and corrects two of the brief's stated premises.

---

## 0. Three findings that change the plan

### 0.1 The calendar gap is inverted — GRACE was right, the dashboard is showing generated events

The brief records:

> "What is happening this week?" → *GRACE said the calendar was clear while the
> dashboard showed an upcoming event.*

and prescribes (Phase 2): *"Move chat context to the dashboard's canonical
calendar/work composition."*

**Do not do this as written.** The dashboard's calendar is not a canonical
source. `src/components/Dashboard.tsx:94` calls
`buildDashboardCalendarIndex(events, zoned.year)`
(`src/lib/calendarEvents.ts:45`), which calls
`mergeCalendarWithRhythm(events, [year-1, year, year+1])`
(`src/lib/churchCalendarRhythm.ts:187`). That merge injects, for three years:

- `buildChurchRhythmEvents(year)` — Easter, Advent, Christmas Eve, "Easter
  Outreach Week", "Christmas Blessing Drive", "Christmas Caroling Outreach", …
- `buildWeeklySundayServiceEvents(year)` — a synthetic **"Sunday Service"
  10:00 AM, Main Sanctuary" on every Sunday of the year**

None of these exist in `calendar_events`. Verified against the live Central
Henderson tenant: **46 `calendar_events` rows, `start_date >= now()` = 0.**
There is no real upcoming event. The chat read the real array and answered
correctly; the dashboard rendered synthetic filler and looked authoritative.

Implementing Phase 2 as specified would make GRACE narrate generated content to
church staff as though it were their calendar — the same fabrication class as
the inactivity bug fixed in `77760fb` and the memory-date bug fixed in `022a9ea`.

### 0.1a RESOLVED — measured on the live tenant, 2026-09-01

Since this note was first written, an **uncommitted working-tree change** (not
in any commit; `git diff` on branch `fix/member-portal-p0`) added the merge to
the chat path:

```
+  const calendarEvents = mergeCalendarWithRhythm(events, [now.getFullYear(), now.getFullYear() + 1]);
-  const upcomingEvents = events
+  const upcomingEvents = calendarEvents
       .filter(e => !e.isPrivate && new Date(e.startDate) >= now && ...)
```

with the rationale *"Asking GRACE about the week must not silently omit a
scheduled service merely because it is supplied by the church rhythm layer."*

**Measured result against the live Central Henderson tenant.** Replicating that
exact filter over the real `calendar_events` rows:

```
live calendar_events rows: 46
REAL events in the next 7 days: 0

What buildDataContext now sends as "Upcoming events (7d)":
  SYNTHETIC | Labor Day       — 9/7/2026
  SYNTHETIC | Membership Class — 9/5/2026
  SYNTHETIC | Sunday Service   — 9/6/2026

merged size 247 = real 46 + generated 201
```

**All three are generated. None exists in the church's records.** A pastor
asking "what's happening this week?" is now told about a Membership Class and a
Sunday Service that are not in their system — a worse answer than the truthful
"the calendar is clear" that prompted the change. The merge inflates 46 real
rows to 247.

**Recommendation — do not ship the chat-side merge.**

*Option A (recommended, minimal).* Drop the merge from `buildDataContext` and
fix the real divergences instead: remove or widen the hard 7-day ceiling, use
the church timezone and day-start boundary the dashboard uses
(`useChurchClock`), and make the empty state explicitly truthful — *"No events
are scheduled in your calendar for the next 7 days"* rather than `none`.
`buildDataContext` already sets this precedent for attendance: *"attendance not
tracked in this system — do not claim anyone is inactive."* The same sentence
shape is the correct answer here.

*Option B (only if the rhythm must be visible to GRACE).* Tag synthetic events
at their source — `rhythm()` already mints recognisable ids
(`${year}-easter`, `sunday-service-${year}-…`) — with an explicit
`source: 'rhythm' | 'church'`, and have the prompt label them:
*"Sunday Service — 9/6 (recurring pattern, not a scheduled entry)."* That
honours the change's stated intent without asserting generated events as
records.

*Root cause is data, not code.* The dashboard looked right and chat looked
wrong only because Central Henderson has **zero future events**. Whether that
is a real gap or simply an unpopulated calendar is a discovery question.

### 0.1b Related: `CalendarEvent.isPrivate` is inert against the database

`calendar_events` has **no privacy column** — verified against live
`information_schema`: `id, church_id, title, description, start_date, end_date,
all_day, location, category, created_at, updated_at`. `CalendarEvent.isPrivate`
(`src/types.ts:136`) is set only in `src/constants.ts` (static mock data) and
read only by the TD-067 filter. It can never be `true` for a real event, so
**TD-067's fix protects nothing in production** — its regression test passes
because it constructs objects in memory. `TECH_DEBT.md` marks TD-067
**RESOLVED**; that status is wrong as it applies to real data, and should be
corrected to note that the field needs a column and a UI before the filter
means anything.

**What to do instead:** decide, as a product question, whether the rhythm
overlay should exist at all in a live tenant; if it stays, it must be visually
and structurally distinguished from church data, and chat must be able to tell
them apart. Only then is there a shared composition worth reusing.

### 0.2 There are already three assistant implementations, not one

The brief says *"Do not create a second assistant implementation."* Three exist:

| Surface | Entry | Transport | Memory | Knowledge | Capability/Epistemic | Action vocabulary |
|---|---|---|---|---|---|---|
| **Ask GRACE** (governed) | `src/contexts/GraceChatContext.tsx` | `POST /api/grace/chat` | `grace_memories` (RLS, provenance) | `grace_knowledge` | yes | `ACTION_CATALOG` (14) |
| **`#/redesign`** | `src/components/redesign/RedesignAskGrace.tsx` | `POST /api/ai/generate` | `localStorage['grace-ai-memory-v1']` | none | none | its own XML protocol; `log_interaction`/`check_in` are in no catalog |
| **Cmd+K → AI tab** | `src/components/GlobalSearch.tsx:402` (`handleAISubmit`) | `generateAIText` → `/api/ai/generate` | none | none | none | none (keyword short-circuits + free text) |

`GlobalSearch.tsx:370` hardcodes `Church: Grace Community Church` into its
prompt — the wrong church for this tenant. `/api/ai/generate` performs a budget
check but **no moderation**, and does not compose capability, epistemic,
knowledge, or memory context.

Any UI-parity work must decide which surface is *the* assistant. Building
command-to-route on `GraceChatContext` alone leaves two unrouted assistants that
users can reach today.

### 0.3 `households` is empty, not merely unwired

Brief §D wants household/family relationships in profile memory. The tables
exist (migration 031) and are correctly permissioned, but the live tenant has
**0 `households` and 0 `household_members` rows**. This is a data-acquisition
question for discovery, not an integration task.

---

## 1. Chat entrypoints, prompt composition, client callbacks

| Concern | Canonical location |
|---|---|
| Turn endpoint | `api/grace/_chat.ts` (`POST`/`GET`), routed at `api/[...path].ts:74` `'grace/chat'` |
| Prompt assembly | `api/grace/_chat.ts:196-199` — `[dataContext, knowledgeBlock, memoryBlock, capabilityBlock, epistemicBlock, history, question]` |
| **Client-composed system prompt** | `src/contexts/GraceChatContext.tsx:63` `buildDataContext()` — persona, tone, action instructions, church data. Sent as a free-text `dataContext` field, ≤40 000 chars (TD-062) |
| Persona | `src/lib/grace-chat/adminPersona.ts` `buildAdminPersonaHeader()` |
| Action prompt | `src/lib/actionCatalog.ts:236` `buildChatActionPrompt()` — generated from the catalog |
| Model gateway | `api/_lib/ai/gateway.ts` `generateStreamed()` — budget + usage; **moderation not requested by the chat route** |
| Adapter | `api/_lib/ai/adapters/claude.ts` (`callClaudeStream`) |
| Response → actions | `src/lib/grace-actions.ts` `parseActions()` → `hydrateAction()` |
| Client dispatch | `src/lib/grace-chat/handlers.ts` `runActionHandler()` |
| Transport helper | `src/lib/services/graceChat.ts` `sendGraceTurn()` |

**There is no tool-calling.** The model emits `<action>{json}</action>` blocks
parsed client-side. A `GraceUiCommand` would most naturally be a new catalog
`ActionGroup` (see §7), not a new mechanism.

## 2. Routing — the registry the brief asks for already exists

| Concern | Canonical location |
|---|---|
| Route registry | `src/hooks/useHashRouter.ts:12` `VIEW_TO_PATH: Record<View, string>` — the complete view↔path map |
| Reverse map | `PATH_TO_VIEW`, derived from the same object |
| View union | `src/types.ts:139` `type View` — 60 views |
| Navigation API | `useHashRouter()` → `{ view, setView, selectedPersonId, setSelectedPersonId }` |
| Record deep links | `#/person/:id`, `#/wallets/:personId` (`parseHash`) |
| Sub-page convention | `?tab=` query — e.g. `#/people?tab=groups`, `#/actions?tab=birthdays`, `#/sunday-prep?tab=attendance`, `#/settings?tab=<page>` |
| **Human label → view** | `src/components/GlobalSearch.tsx:52` `NAV_ITEMS[]` — label, subtitle, icon, view, optional `sundayTab` |
| Palette host | `src/components/GlobalSearch.tsx` (Cmd+K, bound in `Layout.tsx`) |
| Palette actions | `src/lib/paletteActions.ts` — catalog-derived, permission-filtered |
| Per-area nav helpers | `src/lib/{careNav,congregationNav,leadershipNav,settingsNav,sundayNav,workosNav,actionCenterNav,graceMobileNav}.ts` |

`NAV_ITEMS` labels already match the brief's §4 surface table nearly 1:1
("Impact Card Accounts", "GRACE WorkOS", "Growth & Engagement", "Pastoral
Care"…). **This is the registered-route registry — do not build a second one.**
The brief's `{ kind: 'navigate'; route: string }` should carry a `View` (a
closed union) rather than a free string, which satisfies "reject arbitrary
client-provided URLs" by construction.

**Gap:** `setView(view)` takes only a view. There is no API for
`?tab=` sub-navigation; tabs are read from `window.location.search` by each
host component. Sub-page commands ("open volunteer birthdays") need a
`setView(view, tab?)` extension — a real but small change.

## 3. Calendar / operational state composition

| Concern | Canonical location |
|---|---|
| DB read | `src/hooks/useSupabaseData.ts:237` `supabase.from('calendar_events').select('*').order('start_date')` — browser client, RLS-scoped |
| Shared array | `src/App.tsx:163` `events = dbEvents.map(toEventLegacy)` — passed to **both** the dashboard and `graceChatProps` |
| Dashboard index | `src/lib/calendarEvents.ts:45` `buildDashboardCalendarIndex()` → **rhythm-merged (§0.1)** |
| Plain index | `src/lib/calendarEvents.ts:18` `buildCalendarIndex()` — no synthetic events |
| Next-event label | `src/lib/dashboardSummary.ts:141` `findNextEventLabel(eventsByDay, churchTodayKey)` |
| Church clock | `src/hooks/useChurchClock.ts` → `{ zoned, churchTodayKey }`, timezone-aware |
| Chat's view | `GraceChatContext.tsx:110` `upcomingEvents` |

Chat and dashboard **share one source array**. Four divergences in how they
filter it — all in `buildDataContext` vs `findNextEventLabel`:

| # | Dashboard | Chat |
|---|---|---|
| 1 | synthetic rhythm + weekly services merged in | real events only |
| 2 | no upper bound on "next event" | hard 7-day window |
| 3 | `day >= todayStart` (midnight, church tz via `churchTodayKey`) | `startDate >= now` (wall-clock instant) |
| 4 | **no `isPrivate` filter** | `!e.isPrivate` (TD-067) |

Divergence 4 is the dashboard leaking what chat deliberately withholds — worth
its own look. Divergence 3 means an event earlier *today* shows on the dashboard
and is invisible to chat. `data.churchTimezone` is passed into `GraceData` and
**never used** by `buildDataContext`.

## 4. Person, household, leadership, task, interaction models

| Entity | Canonical location |
|---|---|
| Person (client) | `src/types.ts` `interface Person` — 19 fields; **no role, no ministry, no household object** (`familyId?` only) |
| Person (DB) | `people` — church-scoped, RLS |
| Households | `households` / `household_members` (migration 031) — exist, **0 rows live**, never queried by chat |
| Leaders | `src/lib/verifiedLeaders.tsx` `AnchorLeader` + `useVerifiedLeaders()` — `display_name, title, bio, photo_url, expertise_areas, credentials`; migration 067 links `users.person_id` |
| Ministry assignments | `ministry_assignments` (**7 rows live**), `api/_lib/ministryAreas.ts` |
| Leader activity | `api/leadership/_activity.ts` |
| Team / roles | `api/team/_set-role.ts`, `_invite.ts` |
| Tasks / interactions | `src/types.ts`; `interactions` (**98 rows live**) |
| Staff actor ↔ person | `StaffActor.personId` (`api/_lib/authz.ts:172`) |

**What chat currently sees about a person:** only aggregate counts and, for
memory, `person_ids` tags. `buildDataContext` emits status counts, top-5 donor
names, inactive names, birthday names, and open task titles — **never a profile**.
That is the whole of gaps #3 and #4 in the brief: not a retrieval bug, an
absent capability. `cap-household` and `cap-attendance` already declare this
honestly in `api/_lib/capability-manifest.ts`.

## 5. Auth, tenant, RBAC, sensitivity

| Concern | Canonical location |
|---|---|
| JWT verification | `api/_lib/auth-helper.ts` `requireClerkAuth()` — `churchId` from signed `app_metadata.church_id` |
| Actor resolution | `api/_lib/authz.ts:220` `resolveStaffActor()` → `StaffActor { userId, clerkUserId, churchId, role, permissions:Set, personId }` |
| Permission load | `api/_lib/authz.ts:431` `loadPermissionKeys()` — `user_roles` → `role_permissions` → `permissions.key` |
| Enforcement | `api/_lib/authz.ts:498` `requirePermission(req,res,supabase,key)` |
| Member actor | `resolveMemberActor()` (+ preview-token path) |
| Demo bypass | `isDemoModeActive` / `resolveDemoChurchId` — `DEMO_HOSTS` + `NON_DEMO_CHURCH_IDS`, double-gated |
| RLS | migrations; SELECT-only on the four `grace_*` tables (verified live in `pg_policy`) |
| Capability resolution | `api/_lib/grace-capability.ts` — qualification / runtime / actor authorization, kept separate |
| **Sensitivity** | `permissions.sensitivity` enum exists (migration 032) and is **read by no runtime path** — proven as a finding by Fixture #007 |

For the brief's "need-to-know, not rank alone": the RBAC key set is the only
implemented axis. **Ministry/team scope is not an enforcement dimension
anywhere**, and `sensitivity` is inert. Brief §D's policy context (role +
ministry scope + sensitivity + relationship) requires two mechanisms that do
not exist yet — this is the largest gap between the brief and the codebase.

## 6. Audit and approval

| Concern | Canonical location |
|---|---|
| Audit write | `api/_lib/workosAudit.ts:68` `recordAudit()` → `audit_logs` (`action, entity_type, entity_id, before, after, reason, source_app, correlation_id, route, method`) |
| Strict variant | `recordAuditOrThrow()` |
| Security events | `api/_lib/securityLog.ts` `logSecurityEvent()` → `security_events` |
| Platform events | `api/_lib/platformEvents.ts` `emitPlatformEvent()` |
| Ungated execute | `api/actions/_execute.ts` — refuses `requiresApproval`, `requirePermission`, executes, audits |
| Gated propose | `api/actions/_propose.ts` — refuses non-approval actions, writes `agent_actions` + `approvals` |
| Decide | `api/approvals/_index.ts` PATCH — `approvals.decide`, conditional on `status='pending'` |
| Executors | `api/_lib/agentActionExecutors.ts` `ACTION_EXECUTORS` (5 types) |
| Atomic path | migration 070 — `assign_work_order_owner` only |

This maps directly onto the brief's §E preview→confirm→execute→audit
requirement, and is the most mature machinery in the product. Two caveats
already recorded in the risk register:

- **R-18** — `api/approvals/_index.ts:331` hardcodes `action: 'update'`, so an
  approved *deletion* is filed as an update.
- **C-13** — no separation of duty: `requested_by_user_id` is recorded and never
  compared to the approver. "Stops at a named human" is true; "a *different*
  human" is not.

Also relevant to §E: **9 of the 14 catalog actions never reach a server
permission check or audit row** — they run through React callbacks against the
browser Supabase client (catalog records `audited: false`; pinned by
`api/_lib/actionCatalogBinding.test.ts`).

## 7. Reuse map — what NOT to build

| Brief asks for | Already exists — reuse |
|---|---|
| Route registry | `VIEW_TO_PATH` + `View` union |
| Label → route | `GlobalSearch.NAV_ITEMS` |
| "Jump To" launcher | `GlobalSearch` (Cmd+K), `paletteActions.ts` |
| Client navigator | `useHashRouter().setView` / `setSelectedPersonId` |
| Action vocabulary + consequence/approval metadata | `src/lib/actionCatalog.ts` |
| Preview → confirm → execute → audit | `/api/actions/propose` → `/api/approvals` → `executeAgentAction` → `recordAudit` |
| Tenant + permission gate | `resolveStaffActor` / `requirePermission` / RLS |
| Capability truthfulness ("I can open / prepare / need approval") | `api/_lib/grace-capability.ts` + `capability-manifest.ts` — already models `qualified` / `permission_required` / `approval_required` / `unavailable` / `prohibited` |
| Ambiguity handling ("Open James") | `countPersonMatches` + `blockOnAmbiguity` (Prompt 10A) — **already live-proven**: *"Which Sarah — Sarah Mitchell or Sarah Chen?"* |
| Conversation memory + attribution | `grace_memories`, ADR-014 |
| Test fixtures | `tests/fixtures/shared-platform.ts`, `tests/fixtures/mockSupabase.ts`, `tools/eval-harness/` |

**Recommended shape for `GraceUiCommand`:** add a `navigate` group to
`ACTION_CATALOG` with `consequence: 'low'`, `requiresApproval: false`,
`audited: false`, and a `promptExample` per representative command. It then
flows through the existing parse → hydrate → handler path for free, appears in
`buildChatActionPrompt()` automatically, and is covered by the existing
catalog-binding test. Handler calls `setView` instead of a fetch.

## 8. Test infrastructure

- `vitest.config.ts` — `src/**`, `tools/**`, `api/**`, jsdom, `src/test/setup.ts`
- Fixtures: `FIXTURE_CHURCH_ID`, `FIXTURE_OTHER_CHURCH_ID`, `FIXTURE_STAFF_USER`,
  `FIXTURE_SUSPENDED_USER`, `FIXTURE_PERSON`, `FIXTURE_ROLE_PERMISSIONS`
- `createMockSupabase()` — **resolves `.eq()` as a no-op keyed only by table
  name**, so no test can distinguish a scoped query from an unscoped one
- Eval harness: `tools/eval-harness/` (deterministic) + `live-judge/` (advisory)
- Live-tenant harness: `tools/eval-harness/live-rehearsal/` — real handlers,
  real DB, real model, only Clerk stubbed
- Gate: lint, typecheck, vitest, RLS lint, rollback lint, frontend-safety,
  gitleaks, CodeQL, build, eval-harness (`SECURITY_GATE.md`)

Current state: **1590 tests pass, 0 fail.**

## 9. Blockers per phase

| Phase | Blocker |
|---|---|
| 1 — navigation | `setView` has no `?tab=` parameter. Three assistant surfaces (§0.2) — pick one. |
| 2 — canonical calendar | **§0.1.** The dashboard composition is not canonical. Resolve the synthetic-rhythm question before reusing anything. |
| 3 — profile memory | No profile retrieval exists at all. `households` empty. Ministry scope and `sensitivity` are not enforcement dimensions (§5). |
| 4 — approval/audit | Machinery is sound; R-18 and C-13 should be closed first if the demo narrative is dual control. |
| 5 — expansion | Depends on 1–4. |

## 10. What this audit did not verify

- No browser drove any surface; the four gaps in the brief are reproduced by
  **source inspection and live queries**, not by re-running the UI.
- The `#/redesign` and Cmd+K assistants were read, not exercised.
- No focused regression tests were added — §5A is an audit step, and the brief
  asks for tests in Phase 1+.
