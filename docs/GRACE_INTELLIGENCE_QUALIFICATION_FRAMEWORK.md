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
| 2. People/households | **T** — status counts, inactivity, birthdays in `dataContext` | **P** — mechanism exists, no per-person fixture yet | **F** — `households` never queried | **F** | **T** — `add_person`/`add_note`/`update_person_status` | **T** — same + `delete_person` (gated) | **F** |
| 3. Ministry/discipleship | **P** — group names/counts real, but "activity stats" are hardcoded demo data (`getDemoCommunityDataForCRM()`) **even in production** | **F** | **F** | **F** — `discipleship_milestones`/`ministry_assignments` never reach chat | **F** — no catalog actions target this domain | **F** | **F** |
| 4. Pastoral care | **T** — unanswered prayer content (truncated, capped) | **P** — mechanism exists, no care-specific fixture | **T-ish** — prayer+giving CONNECT example above is buildable today | **F** — `crisis_flagged` isn't in the client `PrayerRequest` type; structurally invisible to chat, plus brushes the AI_BOUNDARIES personal-judgment ban | **T** — prayer CRUD actions | **T** — same, execute-only, none gated | **F** |
| 5. Sunday/worship | **P** — service times real; upcoming events show generic titles with no category, so a service and any other event look identical to the model | **F** | **F** | **F** — `SundayPrep`/`VolunteerScheduling` state never reaches chat; volunteer assignments aren't persisted to Supabase | **F** — no actions | **F** | **F** |
| 6. Events/calendar | **T** — title + date only | **F** | **F** — location/capacity/RSVP never in prompt | **F** | **T** — `add_event` | **T** — same | **F** — no rooms/resources table exists at all; room-conflict ANTICIPATE is architecturally impossible |
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
   generalizes" from "it happened to work once." Not yet started.

Both scoped to the deterministic tier only — neither needs the
live-judgment harness. Defer that harness build until a CONNECT-level
fixture is actually wanted (domain 4's prayer+giving cross-reference is the
best-grounded candidate whenever prioritized). Do not start domains 3, 5,
7, or 9 yet — each needs Medium/Large plumbing first, or a fixture there
would only prove "GRACE correctly declines to know things it has no data
for," a narrower, lower-value test than #002/#003 deliver immediately.

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
