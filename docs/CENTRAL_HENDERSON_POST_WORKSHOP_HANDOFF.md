# Post-Workshop Engineering Handoff — Central Henderson (Template)

**Status: template — filled after the workshop; this is where discovery
becomes bounded implementation work.** Every item below must trace to a
Decision Log ID and, where applicable, a discovery gap ID. An item with no
decision behind it does not belong here — send it back to the parking lot
or the follow-up meeting.

**Nothing in this handoff is implemented during the workshop step itself.**
Each section becomes its own scoped engineering task, executed under the
normal lifecycle: implementation → qualification retest → only then a
Capability Baseline change.

Prepared by: __________ Date: __________ From workshop of: __________

---

## 1. Approved sources to ingest/configure
*Per source: what, owner at Central, scope restrictions, sensitivity,
mechanism (migration / integration / config), and the required
scope-boundary guardrail if it carries figures.*

| Source | DL ID | Gap ID | Owner | Scope/sensitivity | Mechanism |
|---|---|---|---|---|---|
| | | | | | |

## 2. Integrations to build
*Only what selected workflows require. "Later" items stay in the Decision
Log as deferred, not here.*

| Integration | DL ID | Workflow | Bounded scope statement |
|---|---|---|---|
| | | | |

## 3. Permissions to configure
*Matching Phase D decisions exactly — no permission architecture redesign.*

| Permission change | DL ID | Authority area | Configuration |
|---|---|---|---|
| | | | |

## 4. GRACE context/data exposure changes
*Wiring existing data into chat (e.g. prayer dates, consent visibility,
real group activity) — each is a small, separately-reviewable change.*

| Change | DL ID | Gap ID | Files/surface expected |
|---|---|---|---|
| | | | |

## 5. Qualification fixtures to create/update
*From each selected workflow's `qualificationCasesRequired`. These gate
Intelligence Readiness — write them BEFORE or WITH the implementation, in
the established exam/fixture pattern.*

| Fixture/case | Workflow | New or re-run | Passing = |
|---|---|---|---|
| | | | |

## 6. Pilot-critical workflows to validate end-to-end
*The selected 3–5, each validated in the pilot environment against its
success condition before launch.*

| Workflow | Success condition | Validated (date/by) |
|---|---|---|
| | | |

## 7. Known exclusions
*Copied from the Pilot Contract's NOT IN PILOT section — engineering must
not "helpfully" build any of these.*

- _____________________________________________

## 8. Blocking decisions
*Decisions the workshop could not resolve that block one of the above.
Each has an owner and a date — work items they block stay unstarted.*

| Blocker | Blocks | Owner | Decision due |
|---|---|---|---|
| | | | |

---

**Completion definition:** this handoff is done when the Pilot Readiness
Scorecard can be scored with evidence on every gate — not when the code
merges. The scorecard, not this document, decides launch.
