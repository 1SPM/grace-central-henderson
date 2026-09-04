# Pilot Readiness Scorecard — Central Henderson (Template)

**Status: template — scored before pilot launch, re-scored after every
material change.** Gate definitions are authoritative in
`PILOT_READINESS_GATES` (workshop-playbook.ts). Each gate reports
**READY / CONDITIONAL / NOT READY, with evidence** — a bare status with no
evidence line is invalid.

**Hard rule: there is no overall READY while the Safety gate — or any
safety-critical requirement inside another gate — is NOT READY.**
CONDITIONAL means "ready if the named condition holds"; the condition must
be written down, owned, and dated.

Scored by: __________ Date: __________ Build/commit scored: __________

---

## Gate 1 — Source Readiness
Required authoritative sources for every selected workflow identified,
verified, and scoped in the Source Register.

**Status:** ☐ READY ☐ CONDITIONAL ☐ NOT READY
**Evidence** (Source Register rows at `verified` per workflow):
_____________________________________________

## Gate 2 — Data Readiness
Required information reaches GRACE through an approved mechanism — never
workshop notes or manual paste.

**Status:** ☐ READY ☐ CONDITIONAL ☐ NOT READY
**Evidence** (merged/deployed implementation per workflow):
_____________________________________________

## Gate 3 — Permission Readiness
Roles, access, and approval paths for selected workflows configured to
match the Phase D decisions.

**Status:** ☐ READY ☐ CONDITIONAL ☐ NOT READY
**Evidence** (Decision Log IDs + matching configuration):
_____________________________________________

## Gate 4 — Intelligence Readiness
Every `qualificationCasesRequired` entry for the selected workflows
implemented and passing.

**Status:** ☐ READY ☐ CONDITIONAL ☐ NOT READY
**Evidence** (green exam run including the new/updated cases; run date +
commit): _____________________________________________

## Gate 5 — Action Readiness
Pilot actions verified against the existing catalog and approval system —
no new action types.

**Status:** ☐ READY ☐ CONDITIONAL ☐ NOT READY
**Evidence** (Fixture #002 + exam ACT cases passing on the deployed
build): _____________________________________________

## Gate 6 — Safety Readiness ⚠ safety-critical
No unresolved safety-critical qualification failures anywhere in the exam.

**Status:** ☐ READY ☐ CONDITIONAL ☐ NOT READY
**Evidence** (exam scorecard: safety-critical failures section empty):
_____________________________________________

## Gate 7 — Environment Readiness
Authentication, deployment, model gateway, Memory V1, and required
integrations functioning in the pilot environment.

**Status:** ☐ READY ☐ CONDITIONAL ☐ NOT READY
**Evidence** (scripted smoke pass: login → chat → memory recall → action
propose/approve; date + environment): _____________________________________________

---

## Overall

| Gate | Status | Blocking? |
|---|---|---|
| 1 Source | | |
| 2 Data | | |
| 3 Permission | | |
| 4 Intelligence | | |
| 5 Action | | |
| 6 Safety ⚠ | | |
| 7 Environment | | |

**Overall: ☐ READY ☐ CONDITIONAL ☐ NOT READY**

Conditions attached (each with owner + date):
_____________________________________________

*A successful demo, a signed contract, or leadership enthusiasm changes
nothing on this scorecard — only evidence does.*
