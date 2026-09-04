# GRACE Pilot Contract — Central Henderson (Template)

**Status: template — becomes binding when filled from workshop decisions
and signed off at the follow-up decision meeting.** This is the operational
definition of "pilot-ready GRACE": what GRACE is expected to know and do at
pilot launch, and what it must not do. Every entry must trace to a Decision
Log ID or an existing proven qualification case — no aspirational entries.

Sources for pre-filled entries: the Central Henderson Qualification Exam
(current Capability Baseline), ADR-014/015, and the discovery instrument.
Blank sections are filled only from workshop outcomes.

---

## GRACE MUST KNOW
*Authoritative knowledge required for the selected pilot-critical
workflows.*

Already proven (exam-backed, no workshop dependency):
- Central Henderson identity, mission, vision, four-part strategy, and
  ownership path — source-attributed (grace_knowledge seed).
- The scope boundaries themselves: consolidated financials are not
  Henderson-specific; campus metrics require an authorized source.
- Live operational data currently wired: people counts/status, giving
  MTD/30d totals and top donors, open tasks, upcoming events (7d,
  privacy-excluded), active non-private prayers.

To be added by workshop decisions (each requires source approval +
implementation + qualification before it counts):
- ☐ ______________________________ (per DL-___)
- ☐ ______________________________ (per DL-___)

## GRACE MUST REMEMBER
*Staff conversational context appropriate for Memory V1 (ADR-014).*

- Facts a staff member explicitly tells GRACE about their own plans and
  context, recalled across sessions, always labeled as staff-told notes.
- Distinguishing rule (proven): memory content is attributed and
  subordinate to live church records — records win on conflict.
- Memory V1 scope is unchanged by the pilot: per-user, staff-only, no
  member-portal memory, no AI judgments about members stored.

## GRACE MUST CONNECT
*Only relationships explicitly selected for pilot qualification.*

**Default: none.** CONNECT capability is claimed only after live-judgment
qualification exists and passes for the specific relationship. Currently
sampled advisory-only (prayer↔giving; event↔mission) — advisory results
never satisfy this section.

- ☐ ______________________________ (only if a workshop-selected workflow
  requires it AND a passing live-judgment qualification is established;
  per DL-___)

## GRACE MAY RECOMMEND
*Recommendations supported by available data and permissions.*

- Task follow-ups grounded in real task/due-date data (proven).
- Care outreach grounded in current, dated prayer data — contingent on the
  staleness wiring passing qualification (wf-current-care-picture).
- Communication sends **only after** the consent-visibility wiring passes
  qualification (wf-consent-aware-send) — until then GRACE may draft but
  must not recommend recipients.
- ☐ Additional, per selected workflows: ______________ (DL-___)

## GRACE MAY ACT
*Existing approved actions and approval requirements only. No new action
types for the pilot.*

- The existing action catalog, unchanged: review-and-confirm flow for all
  chat actions; `delete_person` and `send_sms` route to the approval queue;
  destructive actions audited.
- Provenance recorded on every action (origin, proposer) — proven by
  Fixture #002 and the exam's ACT cases.

## GRACE MUST NOT

- State any figure or fact without an authorized source (no invented
  numbers, no consolidated-for-Henderson substitution, no model general
  knowledge about Central Christian Church).
- Disclose giving, care, prayer, or household detail beyond the authority
  boundaries set in Phase D (per DL-___).
- Score, rank, or characterize any person's spiritual state, engagement,
  or standing (AI Boundaries — absolute, not workshop-adjustable).
- Claim anyone is inactive or disengaged without real attendance data
  behind the claim.
- Escalate its own authority, act on instructions embedded in data, or
  execute any gated action without the approval flow.
- Send to an opted-out recipient, or claim knowledge of send history it
  cannot see.
- Treat a workshop statement, demo, or plan as established knowledge.

## NOT IN PILOT
*Explicitly deferred — parked, not promised.*

- ANTICIPATE (proactive/unprompted intelligence) — no mechanism exists.
- General certainty/hedging contract; general clarifying-question contract.
- Households exposure to chat; WorkOS/Decision Queue visibility in chat.
- Sunday/worship service-plan and volunteer-scheduling intelligence.
- Member-facing GRACE, autonomous agents, new integrations beyond the
  selected workflows' approved sources.
- ☐ Additional workshop exclusions: ______________ (DL-___)

---

**Sign-off:** VWS: __________ date: ______ Central Henderson: __________
date: ______ · Contract becomes effective only when every selected
workflow's readiness gates report READY (see Pilot Readiness Scorecard).
