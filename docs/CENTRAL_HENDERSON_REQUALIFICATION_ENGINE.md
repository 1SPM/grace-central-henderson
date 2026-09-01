# Post-Discovery Implementation & Requalification Engine

**Status: mechanism built, registries empty (Prompt 8, pre-workshop).**
This engine converts *future, verified* workshop findings into bounded
GRACE implementation work and requires requalification before any
capability is considered proven. The workshop has not occurred; nothing
here contains an invented Central answer, source, permission, or decision.

**Authoritative code:** `tools/eval-harness/central-henderson-exam/requalification/`
— `types.ts` (schemas), `intake-rules.ts` (enforced gates),
`impact-map.ts` (requalification impact analysis),
`pilot-capability-manifest.ts` (seeded from PROVEN evidence only),
`index.ts` (registries — empty), `requalification.test.ts` (33 integrity
tests). When this doc and the code disagree, the code wins.

## The lifecycle this engine formalizes

```
Qualification → Gap → Discovery → Authorized Source/Decision →
[ Implementation → Requalification ] → Proven Capability
                └────── this engine ──────┘
```

## 1. Discovery Change Intake

Every "we learned something that may require a GRACE change" becomes a
`DiscoveryChange`: id, domain, originating gap ID, related qualification
case IDs, Decision Log ID, source IDs + authority, scope, sensitivity,
permission implications, requested capability, current state, target
intelligence level, change type, implementation boundary, qualification
required, safety-critical flag, escalation state, evidence gates, status.

Change types: knowledge/configuration · data exposure · integration ·
permission/authority · action · workflow · evaluation-only ·
architecture/capability. An unverified workshop statement cannot become a
change that classifies as ready — `classifyIntake()` refuses it.

## 2. Evidence gates → intake classification

Six gates, each null-until-proven: **Decision** (approved DL entry),
**Source** (verified authoritative source, where one is consumed),
**Scope**, **Authority**, **Permission**, **Qualification target** (we
know exactly what passing looks like). Classification is computed, not
asserted:

- no Decision Log entry → `NEEDS_DECISION`
- any other gate missing → `NEEDS_EVIDENCE`
- `architecture_capability` type → `ENGINEERING_PREREQUISITE` (always)
- dangerous change without approved escalation → `NEEDS_DECISION`
- everything satisfied → `READY_FOR_IMPLEMENTATION`
- `DEFERRED` / `REJECTED` only by explicit logged decision.

## 3. Source-to-GRACE admission gate

Five evidence tiers, strictly ordered: **workshop statement → observed
workflow → provided source → verified authoritative source → approved
GRACE source.** Only the last may enter `grace_knowledge`, live context,
or any authoritative path — `sourceAdmissible()` additionally requires
provenance, ownership, scope, authority, freshness, sensitivity,
verification, enumerated permitted uses, and **at least one prohibited
use** (every source has at least a scope boundary).

The canonical worked example is the FY2024 consolidated source
(`SOURCE_ADMISSIONS[0]`): approved via ADR-015, admitted with the explicit
prohibition that consolidated information never silently becomes
Henderson-specific truth. No new source was ingested in this step.

## 4. Implementation Packet (the template later given to Claude Code)

```markdown
## Implementation Packet — [packet-id]
**Change:** [chg-…] · **Gap:** [dg-…] · **Decision:** [DL-…]
**Problem** — which qualification gap this closes, in one paragraph.
**Evidence** — the authorized discovery evidence (DL id, admitted source ids).
**Current behavior** — what GRACE does today, cited to a case/finding.
**Target behavior** — what GRACE should do after, in observable terms.
**Non-goals** — what must NOT change (list).
**Source boundary** — exactly what information is allowed in.
**Permission boundary** — who may access/use it.
**Implementation surface** — the one GRACE subsystem allowed to change.
**Qualification cases** — what must pass (new + re-run ids).
**Regression cases** — existing behavior that must remain intact.
**Rollback condition** — what result rejects/reverts the change.
```

## 5. One-gap-at-a-time sequencing

Default: one bounded gap → implementation → qualification → baseline
decision, before anything else. `canGroupChanges()` permits grouping only
when changes share the same authoritative source, permission boundary,
and implementation surface, are each independently qualifiable, and
neither is safety-critical. Anything else splits.

## 6. Qualification-before-baseline (non-negotiable)

`canProposeProven()` refuses a PROVEN proposal unless ALL of: implementation
complete · deterministic qualification passing · safety-critical cases
passing · correct proof boundary (a mock pass never claims live-DB
enforcement) · required live/integration evidence passing · no
authority/source regression · **explicit human review**. It categorically
refuses: proposals with zero qualification evidence, architectural
findings, and live-judgment-required levels backed only by advisory
samples or NOT_RUN. The Capability Baseline never mutates automatically.

Intelligence-level discipline is enforced the same way: data available ≠
KNOW; prompt presence ≠ CONNECT; explanation ≠ INTERPRET; suggestion ≠
RECOMMEND; tool availability ≠ ACT; scheduling ≠ ANTICIPATE. The harness
continues rendering unsupported levels PARTIAL / NOT YET PROVEN / FUTURE.

## 7. Requalification impact analysis

`buildRequalificationPlan(change, ALL_EXAM_CASES)` derives, per change —
never "rerun everything":
- **direct cases** (the change's own domain),
- **safety regression cases** (every safety-critical case in affected
  domains — governance is affected by *every* change),
- **cross-domain regression cases** (hand-authored `IMPACT_RULES`: giving
  exposure → people + care + governance; households → care +
  communications + governance; any action → governance; any integration →
  church-identity attribution + governance; permission changes → the three
  most sensitive domains),
- **live/integration evidence** (live_db-boundary cases are named
  explicitly so a mock pass is never mistaken for enforcement proof).

## 8. Dangerous-change escalation

Changes touching tenant isolation, the authorization model, care exposure,
giving/donor privacy, privilege elevation, destructive actions,
communications authority, personal/spiritual inference, autonomous
action, source precedence, or memory authority require explicit
architecture/security review before implementation. Detection is both
textual (trigger patterns) and **structural** — every
`permission_authority` change, every `action` change, and every
`confidential`-sensitivity change escalates regardless of how it's
worded, so a developer cannot reclassify one as ordinary configuration.

## 9. Pilot Readiness delta tracking

Each implementation produces a `ReadinessDelta` against the existing seven
gates (Source/Data/Permission/Intelligence/Action/Safety/Environment):
previous status → change ID → new evidence → proposed status → **reviewer
decision**. A gate never changes because code merged.

## 10. Pilot Capability Manifest

The machine+human-readable answer to *"what can GRACE actually do for
Central Henderson today?"* — seeded exclusively from the exam's 7 PROVEN
cells (identity KNOW/REMEMBER, people REMEMBER, care REMEMBER, comms ACT,
governance KNOW/ACT), each with sources, permissions, qualification
evidence, proof boundary, allowed claim, prohibited claim, and known
limitations. Integrity tests verify every cited case exists, is
deterministic, is not an architectural finding, and that each entry's
proof boundary matches its case's — and that no CONNECT/INTERPRET/
RECOMMEND/ANTICIPATE claim exists.

## 11. Release-to-pilot states

`IMPLEMENTED → QUALIFIED → APPROVED_FOR_PILOT → PILOT_ACTIVE`, plus
`SUSPENDED` / `RETIRED`. Movement is explicit; qualification and pilot
approval are separate decisions. Every manifest entry currently sits at
**QUALIFIED** — none is approved for pilot, and the deployment reality is
recorded honestly: the qualified build lives on the branch Preview;
production lacks `/api/grace/chat`. Promoting the branch is a separate
decision, deliberately outside this engine (Prompt 8 item 16).

## 12. Remaining templates (fill-in skeletons)

**Requalification Result:** plan id · run date · passed/failed/not-run
case ids · live-evidence outcome · PASS/FAIL/INCOMPLETE.
**Baseline Change Proposal:** proposal id · change id · domain · level ·
from → to status · qualification evidence · reviewed by · approved.
**Readiness Delta:** delta id · gate · change id · previous status · new
evidence · proposed status · reviewer decision.
(TypeScript shapes for all three live in `types.ts`; instances belong in
the registries only once real runs/reviews produce them.)

## 13. Post-lifecycle rule (after pilot launch)

```
Real usage → observed gap → qualification case → controlled improvement →
requalification
```

Same gates, same discipline — production observation is just another
discovery channel feeding the same intake.
