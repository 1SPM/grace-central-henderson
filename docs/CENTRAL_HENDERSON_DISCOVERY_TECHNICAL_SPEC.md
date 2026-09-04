# Central Henderson Discovery Instrument — Internal Technical Specification

**Status: internal, design-only.** This is Layer A of the discovery instrument
— full traceability for engineering/product use. Layer B
(`CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md`) is the Central-facing
version: same content, no technical jargon, no adversarial-test language, no
implementation-debt IDs. Read this file to understand *why* a workshop
question exists; read that one to actually run the session.

**Source data:** `tools/eval-harness/central-henderson-exam/discovery/` —
`discovery-items.ts`, `systems-of-record.ts`, `authority-sensitivity-map.ts`,
`show-us-dont-tell-us.ts`, `source-register.ts`, `workshop-outputs.ts`. This
document narrates that data; it does not restate it wholesale. Regenerate
your understanding from the TypeScript source if this doc and the code ever
disagree — the code is authoritative.

**Upstream sources this instrument was built from** (per requirement 1, read
in full, not rediscovered): the Central Henderson GRACE Qualification Exam
(`tools/eval-harness/central-henderson-exam/`), its `knowledge-gap-map.ts`
and generated `.md`/`.json`, its `pilot-priority-ranking.ts`, the GRACE
Intelligence Qualification Framework
(`docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md`), the Capability
Baseline within that doc, Fixture #001 (Central Henderson church knowledge)
and Fixture #002 (governance/authority), ADR-014 (Memory V1), ADR-015
(Central Henderson church knowledge), ADR-016 (the Qualification Framework
itself), and `docs/AI_BOUNDARIES.md`.

## 1. Purpose and the line this instrument crosses

Through the qualification exam, the operative question was **"how
intelligent is GRACE?"** — answered empirically, against real Central
Henderson data, with a scorecard and a Knowledge Gap Map.

This instrument changes the question to **"what does GRACE need from Central
Henderson specifically to become intelligent about their operation?"** Every
discovery item below traces back to a demonstrated gap — a specific
qualification case, or a specific line in the Knowledge Gap Map — not a
generic church-discovery template. Where a question could not be traced to a
gap (a handful of systems-of-record and authority questions exist for
completeness, not because a specific case failed), that is noted explicitly
rather than implied.

## 2. Domain weighting

All 10 knowledge domains are represented, but not equally, per the existing
pilot-priority ranking (`pilot-priority-ranking.ts`):

- **Needed for Pilot** (5 items) — the live workshop should concentrate here.
  Communications consent visibility, ministry/discipleship real activity
  data, giving persona/data mismatch, prayer staleness signal, and
  Henderson-specific financial/attendance data.
- **Valuable After Pilot** (4 items) — households, WorkOS/Decision Queue
  visibility, permission-sensitivity enforcement (an internal engineering
  item, not a Central question — included for domain completeness only),
  events past-history/campaign linkage.
- **Future Advanced Intelligence** (5 items) — the general certainty/hedging
  contract, the general clarifying-question contract, Sunday/worship data
  pipelines, ANTICIPATE, and the giving/care authority question (elevated
  here despite being conceptually "future" because it's the single highest-
  stakes *unresolved authority* question in the whole set — see §4).

Full detail: `tools/eval-harness/central-henderson-exam/discovery/discovery-items.ts`.

## 3. Discovery items — full traceability

Each `DiscoveryItem` (14 total) carries: `gapId`, `relatedCaseIds` (verified
against the exam's real case ids by
`central-henderson-discovery.test.ts`), `domain`, `priority`, `accessClass`,
`accessClassRationale`, what GRACE currently knows, what it cannot know, the
Central-facing question, why GRACE needs it, the likely authorized role, the
authoritative source required, `sourceType`, `sensitivity`,
`permissionConsiderations`, `dataTemporality`, `freshnessRequirement`,
`capabilityUnlockedIfSupplied`, and `intelligenceLevelPotentiallyUnlocked`.

| Gap ID | Domain | Priority | Class | Related case(s) |
|---|---|---|---|---|
| `dg-comms-consent-visibility` | communications | needed_for_pilot | B | com-know-zero-comms-visibility-finding, com-recommend-consent-blind-send-not-yet-testable |
| `dg-ministry-real-activity-data` | ministry_discipleship | needed_for_pilot | B | min-know-hardcoded-demo-data-finding |
| `dg-giving-persona-vocabulary-mismatch` | giving_finance | needed_for_pilot | A | giv-know-persona-promises-data-not-present-finding, giv-adversarial-unsupported-campaign-or-fund-question |
| `dg-prayer-staleness-signal` | pastoral_care | needed_for_pilot | B | pc-know-active-prayers-lack-date-context-finding |
| `dg-henderson-specific-financial-attendance-data` | church_identity | needed_for_pilot | A | chx-know-authoritative-seed-retrieval, chx-remember-legal-tax-status-caveat-preserved |
| `dg-households-not-exposed` | people_households | valuable_after_pilot | B | ph-know-households-not-exposed-finding |
| `dg-workos-decision-queue-visibility` | staff_work | valuable_after_pilot | B | stf-know-decision-queue-visibility-mischaracterized-finding |
| `dg-permission-sensitivity-enforcement` | governance_security_authority | valuable_after_pilot | D | (Fixture #002 finding — not in this exam's case set) |
| `dg-events-past-history-and-campaign-link` | events_calendar | valuable_after_pilot | A | evt-remember-no-past-event-history-finding, evt-connect-event-and-giving-campaign-cross-reference |
| `dg-general-certainty-hedging-contract` | church_identity | future_advanced_intelligence | D | ph-know-no-general-anti-inference-guardrail-finding |
| `dg-general-clarifying-question-contract` | pastoral_care | future_advanced_intelligence | D | (no dedicated case — framework-level finding) |
| `dg-sunday-worship-data-pipelines` | sunday_worship | future_advanced_intelligence | A | wor-know-only-static-service-times-finding, wor-know-no-volunteer-schedule-grounding-finding |
| `dg-anticipate-capability` | church_identity | future_advanced_intelligence | D | (no dedicated case — framework-level finding, every domain) |
| `dg-giving-care-authority-unresolved` | pastoral_care | needed_for_pilot | B+C | pc-know-prayer-visibility-policies-exist-as-documented, pc-know-prayer-visibility-enforcement-live-db-boundary |

Full field-level content lives in the TypeScript source — this table is a
navigation index, not a substitute.

## 4. Access-class classification (item 4)

Every gap is classified so we never ask Central a question that is actually
our own engineering problem:

- **A — Knowledge missing.** Central must tell us; the information doesn't
  exist anywhere in our system. 3 items: giving persona/data mismatch (do
  they even have pledges/campaigns as a concept?), Henderson-specific
  financial data (by design, only a consolidated source exists), Sunday
  worship data pipelines (may not exist as a tracked concept at all), and
  events past-history/campaign link (same shape).
- **B — Knowledge exists, GRACE can't access it.** An engineering wiring
  problem, not a Central question, though Central's answer to "where does
  this live" still matters for prioritizing the wiring work. 5 items:
  communications consent, ministry real activity data, prayer staleness
  (the date is already on the row), households, WorkOS/Decision Queue.
- **C — Authority/permission unresolved.** The information may exist and be
  technically reachable, but who GRACE is allowed to expose it to, and
  under what conditions, has never been decided. 1 item carries this
  jointly with B: giving/care authority — see below, this is the single
  highest-stakes open item in the whole instrument.
- **D — Capability does not exist.** More data will not fix it; it needs a
  new prompt/architecture surface. 4 items: permission-sensitivity
  enforcement (internal only), the general certainty/hedging contract, the
  general clarifying-question contract, ANTICIPATE.

**`dg-giving-care-authority-unresolved` is deliberately the most prominent
item in the set** despite formally living in `pastoral_care`: it spans
giving and care, the two most sensitive domains in the qualification exam,
and its resolution (a policy decision from senior leadership, not a data
source) is a prerequisite for any future work on either domain. See
`authority-sensitivity-map.ts`'s `auth-giving` and `auth-pastoral-care`
entries for the structured sub-questions.

## 5. Systems of Record (item 5) — 16 categories

`systems-of-record.ts` holds one discovery question per category, with a
blank capture shape (`systemOfRecord`, `dataOwner`, `accessMethod`,
`updateFrequency`, `sensitivity`, `graceAuthority`) to fill in live. **Do not
assume GRACE/Supabase is authoritative for any of these** — that assumption
is exactly what this section tests. Categories: people/member records,
households/families, attendance, groups, discipleship/next steps, pastoral
care, prayer requests, volunteers, Sunday scheduling, events/calendar,
giving, funds/campaigns, staff tasks/work, communications, policies,
permissions/roles.

## 6. Authority & Sensitivity Map (item 6) — 7 sensitive areas

`authority-sensitivity-map.ts` covers giving, pastoral care, prayer,
spiritual conversations, household/family information, staff matters, and
communications consent. Each carries 7 sub-questions: who may see it, who
may ask GRACE about it, who may change it, who may authorize GRACE to act on
it, whether GRACE may summarize it, whether GRACE may combine it with
another domain's information, and whether GRACE may retain it in
conversational memory. **This does not design new permission architecture**
— it captures requirements for a decision Central's leadership, not GRACE
engineering, needs to make.

## 7. "Show Us, Don't Tell Us" (item 8)

`show-us-dont-tell-us.ts` holds the 8 workflow demonstrations, each linked
to the discovery item(s) it would validate or contradict. The point is
distinguishing *stated* process from *actual operational* process — capture
which system was demonstrated and who owns it, and flag explicitly if the
demonstration didn't match what was said earlier in the session.

## 8. Source Register (item 9)

`source-register.ts` seeds exactly one verified entry — the FY2024
consolidated financial statements (`src-fy2024-consolidated-financials`),
scope-restricted exactly as ADR-015 states: supplementary/historical, not
Henderson-specific, never a source for individual giving/care data. The
remaining 16 rows are `pending_discovery` placeholders, one per
systems-of-record category — **no new data is ingested by this instrument**.

## 9. Workshop outputs (item 10) — six artifacts

`workshop-outputs.ts` defines each as a derivation, not new data:

1. **Knowledge Map** — `buildKnowledgeMap()`, grouped by domain from
   `DISCOVERY_ITEMS`.
2. **Source Register** — `source-register.ts`, re-exported.
3. **Authority Map** — `authority-sensitivity-map.ts`, re-exported.
4. **Integration Backlog** — `buildIntegrationBacklog()`, items classed A or
   B (systems GRACE eventually needs access to).
5. **Qualification Backlog** — `buildQualificationBacklog()`, every gap
   mapped to what it would take to make the related qualification case(s)
   testable — **status is always `PARTIAL_OR_NOT_YET_PROVEN` in this
   artifact; nothing here is PROVEN by a workshop answer alone.**
6. **Pilot Readiness Gaps** — `buildPilotReadinessGaps()`, the 5
   `needed_for_pilot` items.

## 10. The discovery ↔ qualification lifecycle (item 11)

```
Qualification test → Knowledge gap → Discovery question →
Authorized source → GRACE integration/knowledge → Qualification retest →
Capability becomes PROVEN
```

See `DISCOVERY_TO_QUALIFICATION_LIFECYCLE` in `discovery-items.ts` for the
7-step version tied to real file paths. **A workshop answer alone must never
automatically change the Capability Baseline** in
`docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md`. Only a subsequently
implemented and passing qualification fixture can move a cell from
PARTIAL/NOT YET PROVEN to PROVEN. This is the same discipline the exam
itself already applies to its own Knowledge Gap Map — the workshop doesn't
get an exception.

## 11. Items that could not be converted into a Central question

Per requirement 14, point 9 — these are GRACE engineering/capability
problems, not things Central Henderson can answer:

- **`dg-permission-sensitivity-enforcement`** — `permissions.sensitivity` is
  seeded with real values but read by no runtime code path. No Central
  answer changes this; it needs an engineering decision (enforce it, or
  formally deprecate the column).
- **`dg-general-certainty-hedging-contract`** — no confidence/hedging
  contract exists anywhere in the prompt/gateway. A new design surface.
- **`dg-general-clarifying-question-contract`** — only narrow, keyword-
  scoped crisis detection exists; no general contract for asking a
  clarifying question when a request is ambiguous.
- **`dg-anticipate-capability`** — no proactive/scheduled injection path
  into chat exists at all, for any domain. The largest single build in the
  whole map, out of scope for the pilot by design.

These four are included in the discovery item set anyway (with `centralQuestion`
explicitly stating "not a Central question") purely for domain-coverage
completeness in the technical spec — they are deliberately **omitted** from
the Central-facing workshop guide (Layer B), per requirement 12's
instruction not to expose unnecessary architecture detail there.

## 12. What this instrument does not do

Per requirement 13 — this is design/documentation only. It does not: ingest
new Central data, modify `grace_knowledge`, change Memory V1, wire
households into Ask GRACE, wire WorkOS into Ask GRACE, change giving
visibility, change communications behavior, redesign permissions, build
ANTICIPATE, build live-model evaluation, or change the Capability Baseline.

## 13. Recommendation for what happens after the workshop

Once a real session happens and the six outputs above are filled in:

1. Update `pilot-priority-ranking.ts` and `knowledge-gap-map.ts` with
   anything Central raised that the exam didn't anticipate — same
   discipline the ranking file already asks of itself (their stated reason,
   not just "per discussion").
2. For every gap resolved by a real, authorized source (moving from A/B to
   "supplied"), open the corresponding integration work as its own scoped
   engineering task — not part of this instrument.
3. Once an integration lands, re-run the qualification exam against it and
   update the Capability Baseline dated entry — never edit a prior baseline
   entry in place.
4. Do not implement any of this automatically from workshop notes — each
   step above is a deliberate, separately-scoped decision.

**This step designs the discovery mechanism; it does not execute it.**
