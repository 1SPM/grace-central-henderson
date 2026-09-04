# Central Henderson Pre-Workshop Readiness — Checklist, Verification & GO Gate

**Status: live operational checklist (Prompt 7).** Verification results
below are from the 2026-08-31 readiness sprint against commit `d9997ba`.
Re-verify environment items within 48h of the actual workshop date.

Status values: **READY / IN PROGRESS / BLOCKED / NOT REQUIRED.** No item is
READY without evidence.

---

## 1. Readiness checklist

### People
| Item | Owner | Status | Evidence required | Blocker? | Due |
|---|---|---|---|---|---|
| Central confirms names for 6 required roles | Central (via Sean) | BLOCKED | Confirmed attendee list | Yes | Before invitation |
| Central confirms decision-authority attendance (Phases A/D/F) | Central | BLOCKED | Leadership named on list | Yes | Before invitation |
| VWS facilitator, scribe, demo operator assigned | Sean | IN PROGRESS | Names on Control Sheet | Yes | Before invitation |
| Giving/care session format decided (Option A/B, §4 of Participant Request) | Central + VWS | IN PROGRESS | Decision recorded | No — both paths planned | Before agenda finalized |

### Environment
| Item | Owner | Status | Evidence | Blocker? | Due |
|---|---|---|---|---|---|
| Demo environment identified | VWS | **READY** | Branch Preview alias (grace-crm-git-feat-ai-work-cards…vercel.app), deployment Ready, current commit | — | done |
| Preview env vars complete (incl. both Clerk keys, ANTHROPIC_API_KEY) | Sean | **READY** | `vercel env ls preview`: 12 vars present, names verified 2026-08-31 — the 2026-08-30 missing-Clerk-keys gap is resolved | — | done |
| Chat route deployed + configured | VWS | **READY** | POST /api/grace/chat → **401** (auth-gated; not 503 config-missing, not 404) | — | done |
| TTS route configured | VWS | **READY** | POST /api/grace/tts → 401 | — | done |
| Actions route deployed | VWS | **READY** | POST /api/actions/propose → 401 | — | done |
| Authenticated end-to-end pass (login → chat → tenant shows real Central data) | Sean | IN PROGRESS | One real signed-in session on the Preview URL | Yes | ≤48h before workshop |
| Deployment freshness re-check on workshop eve | Sean | IN PROGRESS | `vercel inspect` shows Ready on current commit | Yes | Workshop eve |
| WorkOS visibility in demo | — | NOT REQUIRED | Not in the approved demo sequence | — | — |

> **Production note (known limitation, not a workshop blocker):** production
> (gracecrm-centralhenderson.org) returns **404 on /api/grace/chat** — the
> branch carrying Memory V1 + church knowledge (37 commits) has not been
> promoted to main/production. The workshop runs on the branch Preview.
> Whether to promote before the *pilot* is a joint decision for the
> Decision Log — not resolved in this sprint.

### Demo
| Item | Owner | Status | Evidence | Blocker? | Due |
|---|---|---|---|---|---|
| Demo 1 Known — mechanism qualified | VWS | **READY** | Exam chx-* cases passing (smoke suite 2026-08-31); live-judge samples this session answered mission correctly | — | done |
| Demo 2 Boundary — mechanism qualified | VWS | **READY** | Scope-boundary guardrail cases passing; live samples declined revenue question correctly | — | done |
| Demo 3 Memory — mechanism qualified | VWS | **READY** | Memory V1 acceptance tests passing (cross-session recall) | — | done |
| Demo 3 Memory — fact seeded in a real prior session | Sean | IN PROGRESS | "Remember that our GRACE workshop demo is [day]" saved + verified retrievable next session | Yes | Workshop eve |
| Demo 4 Authority — mechanism qualified | VWS | **READY** | Fixture #002 + exam ACT cases passing (delete_person → propose/approval) | — | done |
| Demo 4 Authority — labeled TEST record staged | Sean | **CONDITIONAL** | "TEST ONLY — GRACE Demo" person created via UI; cleanup step scheduled | No (demo marked CONDITIONAL until staged) | Workshop eve |
| Voice/TTS live check | Sean | CONDITIONAL | One authenticated voice reply on Preview | No — typed fallback is primary recovery | Workshop eve |

### Evidence
| Item | Owner | Status | Evidence | Blocker? | Due |
|---|---|---|---|---|---|
| Qualification smoke suite green | VWS | **READY** | 129/129 passing across 14 files, 2026-08-31 (see §3) | — | done |
| Zero safety-critical exam failures | VWS | **READY** | Exam run 2026-08-31: 22 PASS / 0 FAIL / 8 NOT_RUN (live-judgment-only), safety-critical section empty | — | done |
| Evidence package written | VWS | **READY** | CENTRAL_HENDERSON_EVIDENCE_PACKAGE.md | — | done |

### Workshop materials
| Item | Owner | Status | Evidence | Blocker? | Due |
|---|---|---|---|---|---|
| Playbook, Agenda, Workbook, Contract, Scorecard, Handoff | VWS | **READY** | Committed at d9997ba | — | done |
| Facilitator packet | VWS | **READY** | CENTRAL_HENDERSON_FACILITATOR_PACKET.md | — | done |
| Demo runbook + recovery plan | VWS | **READY** | CENTRAL_HENDERSON_DEMO_RUNBOOK.md | — | done |
| Central pre-read | VWS | **READY** (draft — Sean tone-review before sending) | CENTRAL_HENDERSON_WORKSHOP_PREREAD.md | No | Before invitation |
| Participant request | VWS | **READY** (draft — same review) | CENTRAL_HENDERSON_PARTICIPANT_REQUEST.md | No | Before invitation |
| Control sheet | VWS | **READY** | CENTRAL_HENDERSON_WORKSHOP_CONTROL_SHEET.md | — | done |

### Logistics
| Item | Owner | Status | Evidence | Blocker? | Due |
|---|---|---|---|---|---|
| Workshop date agreed | Central + VWS | BLOCKED | Calendar confirmation | Yes | — |
| Venue / video link | Central + VWS | BLOCKED | Booking/link | Yes | After date |
| Screenshare access to Central's systems for Show-Us phase | Central | BLOCKED | Confirmed in pre-read reply | No — noted as CONDITIONAL if absent | Before workshop |

### Decision readiness
| Item | Owner | Status | Evidence | Blocker? | Due |
|---|---|---|---|---|---|
| Giving/care Option A/B chosen | Central | IN PROGRESS | Reply to Participant Request §4 | No | Before agenda finalized |
| VWS aligned on the 6 workflow candidates + selection method | Sean | IN PROGRESS | Sean's read-through of facilitator packet | No | Before workshop |

## 2. Environment verification detail (2026-08-31)

Exact environment tested: **branch Preview**
`grace-crm-git-feat-ai-work-cards-spmmusicbiz-gmailcoms-projects.vercel.app`,
deployment created 2026-08-31 15:33 PT (commit `d9997ba`), status Ready.

| Check | Result |
|---|---|
| Root | 302 → sign-in (Clerk auth active) |
| POST /api/grace/chat | 401 — deployed, env complete, auth-gated |
| POST /api/grace/tts | 401 — deployed, configured |
| POST /api/actions/propose | 401 — deployed, auth-gated |
| GET /api/grace/memories | 302 — deployed |
| Preview env vars | 12 present incl. CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, ANTHROPIC_API_KEY, SUPABASE_*, VITE_DEFAULT_CHURCH_ID (names verified only — no values read or printed) |
| Production /api/grace/chat | **404** — Memory V1 not promoted; production unsuitable for this demo |

The 2026-08-30 failure signature (chat 503 `service_not_configured`, TTS
401-from-missing-Clerk) is gone: chat now 401s properly. Guard against
recurrence: the workshop-eve checklist re-runs these exact probes.

## 3. Qualification smoke suite (2026-08-31)

**PASS — 129/129 tests, 14 files**, covering: Memory V1 cross-session
recall + chat route; Fixture #001 (church knowledge boundary); Fixture
#002 + execute/propose (governance/authority approval behavior); the full
Central Henderson exam incl. every safety-critical case; eval-harness
runner integrity; discovery + playbook integrity; and the
inactivity-fabrication regression tests. Exam CLI run same day: 22 PASS /
0 FAIL / 8 NOT_RUN (live-judgment-only, by design). **No safety-critical
failures. No CONDITIONAL results in the deterministic tier.**

## 4. GO / CONDITIONAL GO / NO-GO

**GO** — all of:
- Central decision-makers confirmed for Phases A/D/F.
- Workshop-eve probes: chat/tts/propose return 401 unauthenticated AND one
  authenticated pass shows real Central data.
- Smoke suite green incl. zero safety-critical failures.
- Materials committed; facilitator packet reviewed by facilitator.
- Demo 3 fact seeded and verified; Demo 4 test record staged.
- No unresolved blocker preventing meaningful discovery.

**CONDITIONAL GO** — proceed, documenting the limitation:
- Voice unavailable → typed demo (recovery plan primary fallback).
- One *useful* participant absent → source-owner follow-up assigned.
- Giving/care moved to a private follow-up (Option A chosen late).
- Demo 4 unstaged → skip live action demo, show the approval queue
  concept via screenshots of the qualification evidence instead.

**NO-GO** — any of:
- Authentication broken on the demo environment.
- Ask GRACE chat unavailable (non-401 failure signature returns).
- Tenant scope uncertain (any doubt the environment shows Central's data).
- Any safety-critical qualification failure.
- Wrong data/environment (e.g. Faithful demo tenant data visible).
- No decision-capable Central leadership attending.
- Any demo step would depend on fabricated behavior.

## 5. Coordination split

**VWS completes internally:** facilitator/scribe/demo-operator assignment;
workshop-eve environment re-probe; pre-read + participant-request tone
review; facilitator read-through.

**Requires Central:** attendee names + availability; date; venue/video;
screenshare access to their systems; confirmation of leadership decision
authority; the giving/care Option A/B choice (their call, our framing).

**Joint:** final agenda lock after Option A/B; next-decision-meeting
scheduling (in the room); whether/when to promote the branch to
production for the pilot (Decision Log item, post-workshop).

**Human-in-the-loop demo staging (Sean, authenticated, workshop eve):**
seed the Demo 3 memory fact; create the Demo 4 labeled test record; one
full authenticated pass of all four demo steps; voice spot-check.
