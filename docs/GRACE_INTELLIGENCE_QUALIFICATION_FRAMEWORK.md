# GRACE — Intelligence Qualification Framework

**Status:** Standing evaluation model for staff Ask GRACE (ADR-016). Design is
complete; the fixture suite that proves each cell is built incrementally.
**Scope:** Staff Ask GRACE only (`api/grace/_chat.ts`). The member portal
assistant, the static demo companion, and the marketing visual are separate
stacks with different guarantees and are not covered by this framework.
**Companion doc:** [`GRACE_INTELLIGENCE_LAYER.md`](GRACE_INTELLIGENCE_LAYER.md)
— the operational/accountability loop this framework is reconciled against,
not a duplicate of.

---

## 1. Why a second axis

`GRACE_INTELLIGENCE_LAYER.md` already defines a five-stage loop — **GRACE
sees (Live) → GRACE understands (Partial) → GRACE proposes (Partial) → People
decide (Live) → GRACE acts (Live, with named exceptions)** — plus an outer
"controlled playbook improvement" ring, explicitly *later, not built*. That
loop is a **process/accountability axis**: who is allowed to do what, and
whether that stage has shipped.

This framework adds a **knowledge-sophistication axis**, independent of who's
allowed to act on the answer:

**KNOW → REMEMBER → CONNECT → INTERPRET → RECOMMEND → ACT → ANTICIPATE**

The two axes compose as a matrix, not a merged line: a domain/level cell has
a knowledge grade *and* separately sits somewhere on the accountability loop.
A model can reach ANTICIPATE (surface an unprompted forward-looking
judgment) while the loop keeps that entirely at "GRACE proposes" —
ANTICIPATE does not imply autonomy; the loop does. Do not map ANTICIPATE
onto the outer "playbook improvement" ring either — that ring is about the
system revising its own playbooks from outcomes, a third, higher-order axis,
out of scope here.

### The seven levels, defined against this codebase

1. **KNOW** — answers from static/structural facts always present in the
   prompt (church profile, service times, counts). Fixture #001's
   positive-retrieval/source-attribution tests are KNOW-level.
2. **REMEMBER** — answers from a targeted `grace_memories`/`grace_knowledge`
   retrieval keyed to the specific query, not a static block. Concretely
   gradable: did `retrieveChurchKnowledge`/`retrieveMemories` get called
   with the right query and return the right rows. The `to_tsquery`
   OR-vs-AND regression (multi-word queries were silently AND'd because
   `{type:'websearch'}` drops a bare `|`) is the canonical regression case
   for this level.
3. **CONNECT** — cross-references two disjoint facts not pre-joined anywhere
   in the prompt or schema, forcing the *model* to do the join. Example:
   `dataContext` includes prayer-request content (domain 4) and giving
   totals (domain 7) as two independent blocks — "has this recent widow
   also stopped giving this month" requires holding both and relating them
   by name. Whether both facts are present in the prompt is deterministic;
   whether the model actually related them is not (see §4).
4. **INTERPRET** — applies domain judgment to characterize ambiguous
   *situational* data, not just join facts. Hard-constrained by
   `docs/AI_BOUNDARIES.md`'s explicit ban on judgments about a *person*
   ("no 'this member seems distant,' no scoring, no inferred spiritual
   state") — INTERPRET tests must target situational judgment, never
   personal judgment, and should include an explicit negative case per
   domain asserting GRACE refuses/hedges on the banned category.
5. **RECOMMEND** — proposes a specific next action tied to a real
   `ACTION_CATALOG` entry with correct parameters. The six offline agents
   (`api/_lib/agents/*.ts`) already do equivalent reasoning server-side but
   are disconnected from chat — a RECOMMEND fixture is effectively asking
   "can Ask GRACE reach the same conclusion an agent already reaches, using
   only what's in its own prompt."
6. **ACT** — executes a catalog action via `POST /api/actions/execute`
   (auto) or `/propose` (queued) per `src/lib/grace-chat/handlers.ts`. This
   is where the ladder and the process loop are closest to identical — "ACT"
   here literally is "GRACE acts," scoped to the 14 catalog actions.
   Deterministically gradable: execute-vs-propose routing per the catalog's
   `requiresApproval` flag, and the shape of the resulting
   `agent_actions`/`approvals` row.
7. **ANTICIPATE** — surfaces a forward-looking judgment unprompted. **No
   mechanism does this in staff chat today** — `dataContext` assembles once
   per message, reactively; the six cron agents' findings reach chat only
   as an opaque count (`useGraceOpsAggregates`, "operations: N
   observations"), never as reasoned-over content. This is Future-capability
   for every domain — stated plainly rather than force-fitting partial
   credit.

---

## 2. The 10×7 grid

T = testable now · P = partial · F = future capability

| Domain | KNOW | REMEMBER | CONNECT | INTERPRET | RECOMMEND | ACT | ANTICIPATE |
|---|---|---|---|---|---|---|---|
| 1. Church identity | **T** — Fixture #001 | **T** — Fixture #001 | **P** | **P** | **F** | **F** | **F** |
| 2. People/households | **T** — status counts, inactivity, birthdays in `dataContext` | **T** — `grace_memories` person_ids matching, proven by Fixture #003 | **F** — `households` never queried | **F** | **T** — `add_person`/`add_note`/`update_person_status` | **T** — same + `delete_person` (gated) | **F** |
| 3. Ministry/discipleship | **P** — group names/counts real, but "activity stats" are hardcoded demo data (`getDemoCommunityDataForCRM()`) **even in production** | **F** | **F** | **F** — `discipleship_milestones`/`ministry_assignments` never reach chat | **F** — no catalog actions target this domain | **F** | **F** |
| 4. Pastoral care | **T** — unanswered, non-private prayer content (truncated, capped), proven by Fixture #004 (also fixed TD-066: private prayers previously leaked into this) | **T** — `grace_memories` person_ids matching, proven by Fixture #004 | **P** — corrected from an earlier T by Fixture #004: both prayer and giving facts reach the prompt, but that proves KNOW-level presence, not that the model relates them — requires live judgment, not yet built | **F** — `crisis_flagged` isn't in the client `PrayerRequest` type; structurally invisible to chat, plus brushes the AI_BOUNDARIES personal-judgment ban | **T** — prayer CRUD actions, catalog shape proven by Fixture #004 | **T** — `delete_prayer` server-routed and proven; `add_prayer`/`mark_prayer_answered` are chat-door-only (documented finding, Fixture #004) | **F** |
| 5. Sunday/worship | **P** — service times real; upcoming events show generic titles with no category, so a service and any other event look identical to the model | **F** | **F** | **F** — `SundayPrep`/`VolunteerScheduling` state never reaches chat; volunteer assignments aren't persisted to Supabase | **F** — no actions | **F** | **F** |
| 6. Events/calendar | **T** — title + date only, capped to 7 days, private events excluded (TD-067), proven by Fixture #005 | **F** | **F** — location/capacity/RSVP never in prompt | **F** | **T** — `add_event`, catalog shape proven by Fixture #005 | **T** — but `add_event` is chat-door-only with zero server-routed action in this domain at all (starker than domains 2/4, which each had one) — proven/documented by Fixture #005 | **F** — no rooms/resources table exists at all; room-conflict ANTICIPATE is architecturally impossible |
| 7. Giving/finance | **P** — MTD/30d totals, top-5 donors real; but the persona prompt coaches fluency in pledges/campaigns/funds the model has zero data for | **F** | **F** | **F** | **F** — zero catalog actions | **F** | **F** |
| 8. Staff/work | **P** — open task titles only, no assignee/priority/due date; `isOverdueTasksQuery` is a deterministic client-side short-circuit worth its own fixture | **F** | **F** | **F** — Work Orders/Decision Queue entirely unwired into `GraceChatProvider` | **T** — task CRUD actions | **T** — same, `delete_task` audited not gated | **F** — `assign_work_order_owner` (the most mature action-authorization pattern in the codebase) is agent-only by design, unreachable from chat |
| 9. Communications | **F** — zero visibility into announcements/scheduled_messages/consents | **F** | **F** | **F** | **P** — `send_email`/`send_sms` exist but recommending outreach with no visibility into what's already sent or who opted out is a correctness risk | **T** — both actions exercise ungated and gated external-consequence paths | **F** |
| 10. Governance/security | **T** — permission-denial via `authz.ts`, route-level | **T** — `security_events`/`audit_logs`, append-only, `audit.view`-gated | **T** — but tests a labeling gap (`permissions.sensitivity` unenforced), not real enforcement | **P** — consequence-tier judgment gradable against the catalog directly | **T** — the catalog + `requiresApproval` routing | **T** — full execute/propose pipeline, provenance rows | **F** — no autonomous playbook-improvement loop to anticipate against |

**Honest read.** Domains 2, 4, 6, 8, 10 have a real KNOW→ACT path because
they have both prompt-visible data and matching catalog actions. Domains 3
and 5 are structurally thin because whole subsystems never reach chat.
Domain 7 is thin because the model is coached to sound fluent about data it
doesn't have. Domain 9 has live-fire actions but no visibility to ground
them safely. **No domain has a real ANTICIPATE path today.**

---

## 3. Cross-cutting judgment axes

| Axis | Grounding mechanism | Status |
|---|---|---|
| Fact vs memory vs inference vs recommendation | The repeated `source`/`origin_surface` CHECK-constrained convention (`grace_memories.source`, `grace_knowledge.source_label`, `agent_actions.origin_surface`, `consents.source`, `agent_findings.source`) | **Testable now** — most reusable substrate in the codebase for this axis |
| Authoritative vs supplementary sources | ADR-015's fixed prompt order: `dataContext` wins over `knowledgeBlock` wins over `memoryBlock` | **Testable now** — literal-prompt block-ordering assertion, Fixture #001's own pattern |
| Campus vs organization scope | None — one church (Central Henderson) only, no multi-campus concept anywhere in the schema | **Aspirational** — Fixture #001's cross-*church* adversarial test is not cross-*campus* coverage; no fixture until a second campus exists |
| Current vs historical information | Weak — `status`/`created_at` exist, no explicit versioning/"as-of" semantics | **Partial** — testable as "cites FY2024 as FY2024," not yet as "reasons across two periods" |
| Public vs internal vs confidential data | `permissions.sensitivity` enum exists (migration 032) but is read by no runtime code path — real enforcement is RLS tiering on `care_requests`/`prayer_requests` | **Needs real enforcement before testable as designed** — test the RLS behavior directly (domain 4); the unused enum is a finding, not a test target |
| User permission | `authz.ts`'s `resolveStaffActor`/`requirePermission` + the catalog's `permission` field | **Testable now** |
| Read vs write vs consequential actions | Catalog's `consequence ∈ {low,destructive,external}`, `requiresApproval`, `audited` | **Testable now for write/consequential.** No `read`/`view` action type exists in the catalog; read-gating lives separately in `authz.ts`'s `*.view` keys — test it there directly |
| Certainty vs uncertainty | None — no confidence scoring, no "I don't know" contract anywhere in the prompt/gateway | **Not Yet Testable — No Grounding Mechanism** |
| Knowing when more info is required | `detectCrisisLanguage()` — deliberately keyword-only, explicitly documented as intentional | **Partial** — testable narrowly as "triggers the keyword path correctly," not as general clarifying-question behavior, which doesn't exist as a contract |

Three of nine axes — campus/org scope, certainty/uncertainty, general
clarifying-question behavior — have **no grounding mechanism at all**.
"Not Yet Testable — No Grounding Mechanism" is a distinct third bucket from
"Partial," so the framework never implies these are close to testable.

---

## 4. Scoring model

**Deterministic tier** (same pattern as Fixture #001 — assert on the literal
prompt string or the literal route/DB-row behavior, never live model
output): per cell, **Pass / Partial / Fail** + a one-line evidence note.
Covers KNOW, REMEMBER, and the *mechanical* half of ACT/RECOMMEND (was the
right data assembled/routed, not "did the model reason well"). One new
vitest fixture file per domain-scenario pair, same mock-Supabase harness.
The `to_tsquery` bug is the standing caveat: the mock is a no-op stub blind
to query-mode differences — pair deterministic fixtures with periodic
live/integration runs for the retrieval layer specifically, don't trust the
mock alone.

**Live-judgment tier** (CONNECT, INTERPRET, RECOMMEND's reasoning half,
ANTICIPATE): **this test infrastructure does not exist yet** — zero
live-model-behavior testing anywhere in the codebase today. Would need a
fixed scripted scenario set per domain, a real `generate()` call, and a
rubric grade (not exact-match) — an LLM-as-judge second call is the
pragmatic path given cost/determinism. Every live-judgment result is tagged
**non-deterministic — advisory**, never conflated with hard-fixture
pass/fail in CI gating.

**Rollup.** A domain's grade is its lowest fully-Fail level *below* its
highest Pass level ("gaps below ceiling"), not an average — this avoids
implying smooth progression the architecture doesn't support (e.g. domain 6
jumping KNOW→ACT with nothing gradable between).

---

## 5. Architectural findings (from the design pass)

These are the concrete gaps the grid above encodes, named individually so
they're scannable without reading the whole matrix:

- **No real ANTICIPATE path exists today, for any domain.** `dataContext`
  assembles once per message, reactively; nothing surfaces an unprompted
  forward-looking judgment into chat.
- **Communications can act without sufficient visibility.** `send_email`
  and `send_sms` execute with no prompt-visible record of what's already
  been sent or who has opted out — a correctness risk independent of
  permissions.
- **Giving/finance persona capability exceeds available data.** The prompt
  coaches fluency in pledges, campaigns, and funds the model has no actual
  data for — a hallucination-shaped gap, not yet a fixture.
- **Ministry/discipleship currently includes hardcoded demo data — even in
  production.** `getDemoCommunityDataForCRM()` backs "activity stats" for
  real churches, a live data-integrity bug independent of this framework.
- **WorkOS/Decision Queue intelligence is not materially exposed to Ask
  GRACE.** It reaches chat only as an opaque count
  (`useGraceOpsAggregates`, "operations: N observations"), never as
  reasoned-over content.
- **No general certainty/hedging contract exists.** Nothing in the
  prompt/gateway lets the model express or the system grade confidence.
- **No general clarifying-question contract exists.** Crisis-keyword
  detection (`detectCrisisLanguage()`) is deliberately narrow and
  intentional — not a stand-in for asking "which person did you mean?"
- **Households are not currently available to Ask GRACE.**
  `buildDataContext()` never queries `households`/`household_members`.

---

## 6. Recommended sequence

1. **Fixture #002 — domain 10 (governance/security/authority), KNOW through
   ACT.** Most Testable-now cells (5 of 7), most mature existing mechanism
   (`authz.ts` + `actionCatalog.ts` + the approval pipeline), and exercises
   three cross-cutting axes for free (user permission, read/write/
   consequential, fact-vs-memory-via-provenance). Status: **implemented**,
   see the Capability Baseline below.
2. **Fixture #003 — domain 2 (people/households), KNOW/REMEMBER/RECOMMEND/
   ACT** — explicitly skip CONNECT/INTERPRET/ANTICIPATE for now.
   Second-most mechanically complete domain, and a second REMEMBER-level
   data point that isn't church-identity data — distinguishes "the pattern
   generalizes" from "it happened to work once." Status: **implemented**,
   see the Capability Baseline update below.

3. **Fixture #004 — domain 4 (pastoral care), KNOW/REMEMBER/RECOMMEND/ACT**
   (CONNECT tracked but not proven — see the Capability Baseline update
   below). Chosen as the richest remaining domain after #002/#003. Found
   and fixed a real, live privacy defect (TD-066) along the way, and
   corrected an earlier overclaim in this doc's own §2 grid (domain 4
   CONNECT was T, should have been P — the live-judgment harness genuinely
   doesn't exist yet, so that cell can't be more than tracked). Status:
   **implemented**, see the Capability Baseline update below.
4. **Fixture #005 — domain 6 (events/calendar), KNOW/RECOMMEND/ACT.**
   REMEMBER/CONNECT/INTERPRET correctly stay `future` (no grid correction
   needed — no analogous mechanism to person-tagged memory exists for
   events). Found and fixed a third instance of the TD-066 privacy-field
   shape (TD-067), found this time by a deliberate sweep rather than by
   accident. Status: **implemented**, see the Capability Baseline update
   below.

All four scoped to the deterministic tier only — none needed the
live-judgment harness, which still doesn't exist. Build that harness only
when a CONNECT-level (or deeper) claim is actually wanted to be proven, not
just tracked — domain 4's prayer+giving cross-reference (now represented,
unproven, as `pc-connect-prayer-and-giving-cross-reference`) is the
best-grounded candidate whenever that's prioritized. Do not start domains
3, 5, 7, or 9 yet — each needs Medium/Large plumbing first, or a fixture
there would only prove "GRACE correctly declines to know things it has no
data for," a narrower, lower-value test than #002-#005 deliver
immediately. Domain 8 (staff/work) is the last domain reachable without
new plumbing — its KNOW cell is only Partial (task titles only, no
assignee/priority/due date), so a Fixture #006 there would prove less at
KNOW than #002-#005 did, but RECOMMEND/ACT are both Testable.

---

## Evaluation harness

`tools/eval-harness/` implements this framework's **deterministic tier**
(§4) as reusable infrastructure — not new GRACE capability. It measures
what the current system does; it does not expand what the system does.

**Run it:**
```bash
npx tsx tools/eval-harness/run-all.ts          # human report + capability baseline
npx tsx tools/eval-harness/run-all.ts --json    # machine-readable EvalResult[]
```
Also wired into CI as the `eval-harness` job (`.github/workflows/ci.yml`),
gating `build` alongside `frontend-safety`/`rls-lint`.

**Shape:** a fixture-agnostic engine (`types.ts`, `scoring.ts`, `runner.ts`)
that consumes a declarative `EvalCase[]` — id, domain, level,
classification, proof boundary, safety/finding flags, and an optional
`run()` that returns a PASS/PARTIAL/FAIL outcome with evidence. A future
church fixture is a new `fixtures/*.cases.ts` file; the engine itself never
changes for that. Safety/authority violations are structurally
non-averageable (`combineWithSafetyOverride` in `scoring.ts` discards
factual correctness entirely on a violation), and a case requiring live-
model judgment with no `run()` reports as `NOT_RUN`, never a fabricated
pass — the harness's central guardrail, itself unit-tested in
`runner.test.ts`.

**Proof-boundary labeling** (`ProofBoundary` in `types.ts`) — every case
states honestly what its pass actually rests on:
- `mock` — `tests/fixtures/mockSupabase.ts`, whose `.eq()`/`.in()`/etc.
  filters are no-ops. Proves the code path was exercised with the right
  shape of call; cannot prove real RLS/church-scope enforcement.
- `live_db` — a real Postgres/RLS guarantee. This harness's deterministic
  tier builds no such case itself; see the existing `tools/*-smoke.test.ts`
  files for that layer.
- `static_catalog` — a check against static in-process source (the action
  catalog, a source file's literal text), no Supabase mock involved.

**Fixture #001 and #002** are represented here (`fixtures/fixture-001-*`,
`fixtures/fixture-002-*`) without weakening their original assertions —
each harness case duplicates the literal guardrail strings/assertions from
its authoritative `.test.ts` file (which remains the real regression gate,
left unmodified) rather than importing from or replacing it. A harness
case failing while its authoritative test still passes means the harness's
copy has gone stale — fix the copy, never loosen it to match.

The Capability Baseline section below should be cross-checked against the
harness's own `renderCapabilityBaseline()` output whenever either changes;
it remains hand-maintained prose, not auto-generated, so a mismatch is a
prompt to update this doc, not a bug in the harness.

---

## GRACE Capability Baseline — 2026-08-31

What has an actual passing, committed test behind it as of this date — not
the grid's T-cell design classification, which is broader than what's
proven. This section gets a new dated entry (not an edit-in-place rewrite)
each time a new fixture lands, so the baseline's history stays legible.

- **Domain 1 (church identity): KNOW, REMEMBER** — proven by Fixture #001
  (`api/grace/_chat.central-henderson-fixture.test.ts`,
  `api/_lib/grace-knowledge.test.ts`).
- **Domain 10 (governance/security/authority): KNOW through ACT** — proven
  by Fixture #002 (`api/actions/governance-authority.fixture-002.test.ts`),
  alongside the pre-existing `api/actions/execute.test.ts` and
  `api/actions/propose.test.ts` it builds on.
- Everything else in the 10×7 grid remains **unproven by test** as of this
  date, regardless of its T/P/F design classification in §2. The baseline
  is deliberately narrower than the grid.

**Update — 2026-08-31 (Fixture #003):**
- **Domain 2 (people/households): KNOW (data-wiring only), REMEMBER, RECOMMEND (catalog shape only)** —
  proven by Fixture #003 (`tools/eval-harness/fixtures/fixture-003-people-households.cases.ts`).
  KNOW and RECOMMEND are proven at a narrower boundary than domains 1/10: KNOW proves
  `GraceChatProvider` is wired with people/tasks/prayers/attendance data, not the exact
  composed prompt string (`buildDataContext` is client-side and not exported — see the
  fixture file's header). RECOMMEND proves the catalog/permission shape a recommendation
  would route through, not live-model reasoning quality (same "mechanical half only"
  boundary as domain 10's own RECOMMEND cell).
- `framework-grid.ts`'s `people_households` REMEMBER cell flipped P→T, earned by this
  fixture (a second REMEMBER-level data point outside church-identity data, using the
  same `grace_memories`/`resolvePersonIds` mechanism `api/grace/_chat.test.ts`'s
  pre-existing "automatic retrieval" acceptance test already proved) — see §2's table,
  also updated.
- **New architectural finding**: domain 2's ACT-level catalog actions are NOT uniformly
  server-routed. Only `delete_person` (gated) goes through `/api/actions/execute`/`propose`
  (already proven by Fixture #002). `add_person`, `add_note`, and `update_person_status`
  run entirely through a client-side-only dispatcher (`src/lib/grace-chat/handlers.ts`'s
  `runActionHandler`) with no catalog permission check, no approval, no audit row at the
  point of dispatch — matching `actionCatalog.ts`'s own TD-061 framing (pre-existing,
  documented, not a new hole). Represented as `ph-act-chat-door-bypasses-server-pipeline`,
  `isArchitecturalFinding: true` — does not count toward domain 2's ACT cell being PROVEN.

**Update — 2026-08-31 (Fixture #004):**
- **Domain 4 (pastoral care): KNOW, REMEMBER, RECOMMEND (catalog shape only), ACT (delete_prayer only)** —
  proven by Fixture #004 (`tools/eval-harness/fixtures/fixture-004-pastoral-care.cases.ts`).
- **Real privacy defect found and fixed (TD-066, RESOLVED) — not just documented.** Grounding
  this fixture found that `buildDataContext()` (`src/contexts/GraceChatContext.tsx`) included
  private prayer requests' content in the live Ask GRACE prompt on the same terms as public
  ones — no `isPrivate` check existed anywhere in the function. This ran on ordinary use, not
  adversarial phrasing. Fixed before the fixture was built (`&& !p.isPrivate` added to both the
  filter and its reported count), with a direct regression test
  (`src/contexts/GraceChatContext.test.ts`) independent of the harness. `buildDataContext` was
  exported (previously module-private) as a direct consequence of making this fixable and
  testable — not weakened, not worked around.
- `framework-grid.ts`'s `pastoral_care` REMEMBER cell flipped P→T (earned, same REMEMBER
  pattern as Fixture #003) and CONNECT flipped **T→P** — a correction, not an upgrade: the
  original T assumed "both facts present in the prompt" was sufficient proof of a CONNECT-level
  capability; building the case for real showed that's KNOW-level evidence, not proof the model
  relates the facts. Represented as `pc-connect-prayer-and-giving-cross-reference`,
  `requiresLiveJudgment: true`, deliberately no `run()` — reports NOT_RUN, never a fabricated
  pass. See §2's table, also updated.
- **New architectural finding (documented, not fixed)**: same chat-door pattern as domain 2 —
  `add_prayer`/`mark_prayer_answered` bypass the server pipeline; only `delete_prayer` is
  server-routed (proven above). A smaller, related, unfixed gap noted as evidence within that
  same finding case: the chat-door `add_prayer` handler hardcodes `isPrivate: false` on every
  prayer it creates, so a prayer asked to be created private via chat silently isn't — lower
  severity than TD-066 (no existing privacy designation is violated, it's a missing default),
  flagged for a separate decision rather than fixed in this pass.

**Update — 2026-08-31 (Fixture #005):**
- **Domain 6 (events/calendar): KNOW, RECOMMEND, ACT (documented, no server-routed action exists)** —
  proven by Fixture #005 (`tools/eval-harness/fixtures/fixture-005-events-calendar.cases.ts`).
  REMEMBER/CONNECT/INTERPRET correctly stay `future` — no grid correction needed there, unlike
  Fixture #004's CONNECT downgrade — because `grace_memories`' person-name matching has no
  equivalent for events.
- **A third instance of the same privacy-field gap, found and fixed before the fixture was
  built (TD-067, RESOLVED).** `CalendarEvent.isPrivate` existed but `buildDataContext` never
  checked it — a private event's title reached the prompt the same as a public one. Lower
  severity than TD-066 (title only, not full content), but the same shape of bug, found by
  deliberately sweeping every `GraceData`-consumed type for a third instance after fixing
  TD-066 rather than waiting to trip over it fixture-by-fixture. The sweep found no further
  instance — `isPrivate`/similar fields exist only on `PrayerRequest` and `CalendarEvent`.
- **ACT-level finding here is starker than domains 2/4**: `add_event` is not just chat-door-only,
  it is the *only* events-domain catalog action — no delete/update-event action exists at all,
  so this domain has zero server-routed actions to contrast the finding against (domains 2/4
  each had one — `delete_person`/`delete_prayer`). Represented as
  `ec-act-no-server-routed-action-exists`, `isArchitecturalFinding: true`.
  is deliberately narrower than the grid.
