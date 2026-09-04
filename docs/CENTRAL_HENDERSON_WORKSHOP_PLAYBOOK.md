# Central Henderson Workshop Playbook — Internal (VWS)

**Status: internal operational plan, design-only.** This playbook turns the
discovery instrument (Prompt 5,
`tools/eval-harness/central-henderson-exam/discovery/`) into an executable
engagement plan. Nothing in it modifies GRACE behavior, ingests data, or
changes the Capability Baseline.

**Companion artifacts** (this playbook is the hub; don't duplicate their
content):
- Structured data (authoritative when docs disagree):
  `tools/eval-harness/central-henderson-exam/discovery/workshop-playbook.ts`
- Central-facing agenda: `CENTRAL_HENDERSON_WORKSHOP_AGENDA.md`
- Capture workbook: `CENTRAL_HENDERSON_WORKSHOP_WORKBOOK.md`
- Pilot Contract template: `CENTRAL_HENDERSON_PILOT_CONTRACT.md`
- Readiness Scorecard: `CENTRAL_HENDERSON_PILOT_READINESS_SCORECARD.md`
- Engineering handoff template: `CENTRAL_HENDERSON_POST_WORKSHOP_HANDOFF.md`
- Facilitator question scripts: `CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md`
  (Prompt 5 — the per-question material lives THERE, referenced by phase below)

## 1. Purpose

The workshop is institutional onboarding for GRACE — not a product demo,
not a generic requirements meeting, not an architecture session. We leave
with enough **verified institutional context** to configure and qualify
GRACE for the pilot: how Central actually operates, where authoritative
information lives, who owns it, what GRACE may access, what each role may
ask, what GRACE may eventually change, which workflows matter most, what
data/integrations are required, and what stays deliberately out of scope.

The operating question: *what does GRACE need from Central Henderson
specifically to become intelligent about their operation?* — answered with
owners and decisions, not impressions.

## 2. Format and length

**Recommended: one day, 9:00–15:30**, six phases totaling 5 hours of
content plus breaks and lunch (agenda doc has the clock). Fallback: two
half-days — Phases A–C day one, D–F day two, with the demo opening day two
as a re-anchor. Do not compress Phases C–E; they are the actual point.

## 3. Phase sequence (item 3)

Timings and exit decisions are in `WORKSHOP_PHASES` (workshop-playbook.ts).
Facilitator scripts per phase:

| Phase | Duration | Question material | Exit decision |
|---|---|---|---|
| A — Mission & Pilot Outcomes | 45m | §4 below (new) | Agreed outcome list in Workbook |
| B — How Central Actually Operates | 60m | Guide §6 (Show Us ×8) | System/owner/matched-flag per demo |
| C — Where Truth Lives | 45m | Guide §7 (16 categories) | Source Register rows named |
| D — Authority & Boundaries | 45m | Guide §8 (7 sensitive areas) | Authority captures filled or owner-assigned |
| E — GRACE Priority Workflows | 60m | Guide §5 + §10, candidates below | 3–5 workflows selected |
| F — Pilot Readiness Decisions | 45m | Guide §11 + Decision Log | Log populated, exit criteria read aloud |

The live demo (§8) runs at the **top of Phase A** (10 minutes) — it earns
the room's attention and frames every later question, and at the **top of
Phase E** (the authority/action demo specifically) to ground the workflow
conversation in what approval actually looks like.

## 4. Phase A — Mission & Pilot Outcomes (item 5)

Force a small set of outcomes onto paper before anyone talks systems.
Three buckets, captured in the Workbook:

**GRACE intelligence outcomes** (we propose, they edit):
- Correctly answers the operational questions Central actually asks.
- Remembers relevant staff context across sessions.
- Distinguishes authoritative church information from staff-told notes.
- Respects role and permission boundaries.
- Safely performs approved actions through the review/approval flow.

**Operational outcomes**: drawn from what Central says in this phase and
validates in Phase E — do not pre-write these for them.

**Adoption outcomes**: define what meaningful staff usage looks like in
their words. **Do not invent numerical targets** — if they want numbers,
they set them and the Decision Log records who did.

## 5. Participants (item 4)

Full matrix in `PARTICIPANT_MATRIX` (workshop-playbook.ts): 6 required
roles (exec/pastoral leadership, operations, finance, pastoral care, CRM
admin, communications) and 4 useful ones (ministry/groups, Sunday/worship,
volunteer coordination, IT/security), each mapped to specific phases —
nobody is asked to sit through all six. Leadership must be present for
Phases A, D, and F: outcomes, authority, and decisions are theirs to make.
Role-based only — no names until Central confirms them.

## 6. Selecting Pilot Critical Workflows (item 6)

Six candidates are pre-built in `PILOT_WORKFLOW_CANDIDATES` — five derived
from the needed-for-pilot discovery items plus one **anchor workflow**
(staff tasks/overdue) that already works end-to-end and needs no new
engineering; it is the adoption on-ramp and the credibility floor.

Method, in the room: walk each candidate against the six criteria in
`WORKFLOW_SELECTION_CRITERIA` (usefulness, frequency, data availability,
permission risk, demonstrability, feasibility) using what Phases B–D just
established. A candidate that fails the data or permission criterion isn't
argued over — it gets a Decision Log entry (deferred, with owner) and we
move on. Target 3–5 selected, the anchor workflow almost certainly among
them. Each selected workflow's `qualificationCasesRequired` list becomes
engineering-handoff input; **none of it is implemented during this step**.

## 7. Evidence workflow (item 9) — nothing becomes knowledge by being said

The pipeline for everything captured:

```
Captured → Source requested → Owner confirmed → Scope classified →
Permission classified → Verified → Approved for GRACE → Implemented →
Qualification retested
```

Four evidence tiers, marked at capture time in the Workbook:
1. **Told** — someone said it. Lowest tier. Never ingested as-is.
2. **Demonstrated** — we watched the workflow. Stronger, still not a source.
3. **Authoritative source** — a named system/document with a confirmed owner.
4. **Approved GRACE source** — tier 3 plus an explicit, logged decision that
   GRACE may use it, with scope and permissions.

Only tier 4, implemented through a real mechanism and re-qualified, ever
reaches `grace_knowledge` or a prompt. **Workshop notes never silently
become grace_knowledge** — the FY2024 source's own ADR-015 path (reviewed,
scoped, migrated, tested) is the template every future source follows.

## 8. Live demonstration strategy (item 13)

Four steps, ~10 minutes, sequence and cautions in `DEMO_SEQUENCE`:

1. **Known** — "What's Central Henderson's mission?" → sourced answer.
2. **Boundary** — "What was our revenue last year?" → honest decline, no
   authorized Henderson-specific source. *Narrate this as the product's
   spine: GRACE knowing what she doesn't know is the feature.*
3. **Memory** — recall a fact seeded in a real prior session ("when's the
   retreat?"). Seed it beforehand for real — never fake it live.
4. **Authority** — ask GRACE to delete a **clearly-labeled test record**
   → it proposes rather than executes; show the pending approval.

Every step runs on proven capability (exam cases / ADR-014 / Fixture #002).
**Do not fabricate a capability for the demo**, and never run destructive
demos against real member data — create and clean up a labeled test record.

## 9. Facilitation runbook (item 12)

- **Opening**: use the Guide §4 script, then add one line for this
  playbook's frame: "By end of day we'll have decided, together, exactly
  what GRACE will and won't do in the pilot — and who owes whom what."
- **Explaining GRACE simply**: "An assistant for your staff that answers
  from your real records, remembers what you tell it, and asks permission
  before it changes anything." Stop there; the demo does the rest.
- **Why we ask about systems/data**: "GRACE is only as truthful as the
  sources you authorize. We're mapping where truth lives so GRACE never
  guesses." 
- **Redirecting feature brainstorming**: "That's a good one — parking lot,
  with your name on it, so it doesn't get lost." Then actually write it in
  the Workbook's parking lot. Never debate merit in the room.
- **"GRACE should know everything"**: point back to the boundary demo —
  "You saw her decline the revenue question. That's deliberate. Everything
  she knows entered through a door you approved. Today we're choosing
  which doors."
- **Sensitive information**: if someone starts sharing an individual's care
  or giving specifics, pause capture: "We don't need the specifics — we
  need who's *allowed* to see specifics." Nothing person-identifying about
  care/giving goes in the Workbook.
- **Recollection vs. authority**: when an answer sounds like memory, ask
  "if we needed to verify that Monday, what would we open?" — that names
  the source or reveals there isn't one. Mark the tier either way.
- **Closing each section**: read the phase's exit decision aloud and get
  verbal confirmation before moving on. An unconfirmed section gets an
  owner and follow-up, not a silent skip.
- **Closing the workshop**: read the exit criteria (§10) as a checklist,
  aloud, marking each met/owed. Schedule the follow-up decision meeting
  before anyone leaves the room.

Central-facing language stays conversational — no fixture IDs, RLS,
migrations, prompt architecture, debt IDs, or adversarial-test language.

## 10. Exit criteria (item 14)

We do not leave with "a good meeting." We leave knowing:

1. Agreed pilot outcomes (Phase A capture).
2. Selected Pilot Critical Workflows (3–5, Phase E).
3. Systems of record for those workflows (Phase C).
4. Source/data owners, by name now (Phase C).
5. Sensitive-data boundaries (Phase D).
6. Permission/authority requirements (Phase D).
7. Integrations required (Phase F).
8. Sources Central still owes us — itemized, with their owner and a date.
9. VWS engineering work required (feeds the handoff template).
10. Qualification tests to create/re-run (from selected workflows).
11. Unresolved blockers, each with an owner.
12. Next decision meeting: date and owner, set before leaving.

Any required answer that isn't available gets **an owner and a follow-up
date recorded — never an invented answer.**

## 11. Lifecycle preservation (item 16)

Unchanged and non-negotiable:

```
Qualification → Gap → Discovery → Authorized Source/Decision →
Implementation → Requalification → Proven Capability
```

and post-launch:

```
Real usage → observed gap → qualification case → controlled improvement →
requalification
```

No workshop decision, integration, or successful demo changes the
Capability Baseline by itself. Only passing qualification evidence moves a
cell to PROVEN — the same rule Prompt 5 documented, restated here because
the workshop is exactly where the temptation to shortcut it will appear.

## 12. Non-goals (item 18)

This engagement does not: ingest Central data, modify `grace_knowledge` or
Memory V1, add integrations, wire households or WorkOS, change permissions,
add actions, build CONNECT reasoning, ANTICIPATE, autonomous agents, or
live-model evaluation infra — and does not alter the Capability Baseline
because a capability is *planned*. Pilot operational design only.
