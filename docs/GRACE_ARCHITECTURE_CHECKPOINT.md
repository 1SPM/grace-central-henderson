# GRACE Intelligence Architecture Checkpoint

**Date:** 2026-08-31 · **Branch:** `feat/ai-work-cards` @ `981d8e8`
**Scope:** staff Ask GRACE, whole-stack. Audit only — **no code was changed.**
**Companions:** [Stack Map](GRACE_INTELLIGENCE_STACK_MAP.md) ·
[Authority Matrix](GRACE_AUTHORITY_MATRIX.md) ·
[Proof Boundary Map](GRACE_PROOF_BOUNDARY_MAP.md) ·
[Capability Ledger](GRACE_END_TO_END_CAPABILITY_LEDGER.md) ·
[Risk Register](GRACE_STRUCTURAL_RISK_REGISTER.md) ·
[Contradiction Register](GRACE_CONTRADICTION_REGISTER.md) ·
[Coherence Scorecard](GRACE_INTELLIGENCE_COHERENCE_SCORECARD.md)

---

## 1. The finding, in one paragraph

GRACE is **a coherent authority system with an incoherent intelligence
system layered on top of it.** Everything about *who you are, which church
you belong to, and what you may do* is server-resolved, tested, and
genuinely hard to defeat. Everything about *what GRACE knows, how certain
she is, and whether she should act* is composed into a prompt and entrusted
to the model — including the two layers (ADR-017 capability, ADR-018
epistemics) that were built specifically to stop that. Their *deciding*
functions have zero production call sites; only their prompt text runs. The
one exception is the Prompt 10A ambiguity closure, which is real, structural
enforcement — and it runs in the browser. So the honest answer to the
checkpoint's closing question is: **not yet one system. Two well-built
halves with a seam between them, and the seam is the prompt.**

---

## 2. Deterministic vs. model authority — who actually decides

| Decision | Classification | Where |
|---|---|---|
| Tenant | **DETERMINISTIC** | signed JWT claim; never client-supplied |
| Actor identity | **DETERMINISTIC** | `resolveStaffActor` + `users` row |
| Permissions | **DETERMINISTIC** | `loadPermissionKeys` (RBAC tables) |
| Source scope (Henderson vs consolidated) | **HYBRID, model-weighted** | `scope_boundary` rows always injected; compliance is the model's |
| Memory retrieval | **DETERMINISTIC** | recency ∪ FTS ∪ `person_ids` |
| Memory *precedence* vs live data | **MODEL** | one prompt sentence |
| Capability availability | **DETERMINISTIC to compose, MODEL to apply** | resolver builds the block; nothing gates on it |
| Epistemic state | **MODEL** | `resolveActionReadiness` is never called |
| Entity resolution | **DETERMINISTIC (client)** | `hydrateAction` over `data.people` |
| Ambiguity → refuse | **DETERMINISTIC (client)** | `blockOnAmbiguity`, first in every handler |
| Clarification (when to ask) | **MODEL** | contract text |
| Action selection | **MODEL** | it emits the `<action>` block |
| Required parameters | **HYBRID** | model is told the table; handlers re-check a subset; `resolveActionReadiness`'s full table is unused |
| Approval routing | **HYBRID → DETERMINISTIC backstop** | chosen per-type in `handlers.ts`; `/execute` refuses gated, `/propose` refuses ungated |
| Execution | **DETERMINISTIC** for 4 actions (server, permissioned, audited); **CLIENT** for 9; **legacy-role** for `send_email` |
| Factual wording | **MODEL** |  |
| Inference labelling | **MODEL** | AI_BOUNDARIES says "requires" — it instructs |
| Recommendation | **MODEL** | no RECOMMEND capability is PROVEN anywhere; a NOT_RUN case exists to say so |

**Documented-as-deterministic but model-controlled at runtime:**
epistemic state, ACT-reachability, inference labelling, memory precedence,
source precedence. These are exactly the five places ADR-017/018 claim
determinism.

---

## 3. Transition boundaries (the seams)

| Seam | Contract | Trust boundary | Enforced at | Coverage | Bypass |
|---|---|---|---|---|---|
| Auth → Context | `StaffActor` | **real** | `authz.ts` | INTEGRATION | none found |
| Context → Retrieval | `churchId`/`userId` filters + RLS | **real** | queries + Postgres | INTEGRATION + live RLS posture | none found |
| Knowledge → Model | text block | **advisory** | prompt | INTEGRATION | contradiction by a later block |
| Memory → Model | text block + subordination sentence | **advisory** | prompt | INTEGRATION | no supersede mechanism (R-08) |
| Capability → Model | text block | **advisory** | prompt | INTEGRATION | gates nothing (C-02, C-04) |
| Epistemics → Model | contract text + collision list | **advisory** | prompt | UNIT for the unused resolver | **the decision layer never runs** (R-02) |
| **Model → Action** | `<action>{json}</action>` | **real** | `validateAction` (client) | UNIT | a second surface parses XML with its own vocabulary (R-01) |
| Action → Hydration | `PendingAction` + ambiguity flags | **real** | `hydrateAction` (client) | UNIT | model-supplied ids skip it (R-13) |
| Hydration → Approval | `blockOnAmbiguity` then route | **real** | `handlers.ts` (client) | UNIT | none on this surface; **absent on `#/redesign`** |
| Approval → Execution | `requiresApproval` | **real** | `/execute` + `/propose` | INTEGRATION | none found |
| Execution → Audit | `recordAudit` | **real, non-transactional** | executor + route | INTEGRATION | 9 actions never enter it |

The weakest seams are **Epistemics → Model** (advisory where documented as
enforcing) and **Model → Action** on the unaudited second surface.

---

## 4. TD-062 — reassessed

**What is still client-composed.** Not "the church-data context" — the
whole system prompt: the persona (`buildAdminPersonaHeader`), the tone
rules, the `ACTIONS —` instruction block, the **rendered action catalog**
(`buildChatActionPrompt()`), and the church data. Up to 40 000 characters,
placed *first*, ahead of every server-composed block.

- **Influences ANSWER?** Yes — completely. It is the largest and
  highest-position block.
- **Influences epistemic state?** Yes — the epistemic contract is a later
  block, and nothing resolves a conflict between them deterministically.
- **Influences action selection?** Yes — it is the text that teaches the
  model the action vocabulary and its JSON shape.
- **Influences execution?** **No.** Every real read and write remains bounded
  by `resolveStaffActor`, `requirePermission`, RLS, and the approval gate,
  none of which read `dataContext`. Capability, permission, and tenant are
  isolated from it by construction (ADR-017 was explicit about this and the
  code honours it).
- **Residual attack surface.** An attacker with an authenticated staff
  session can rewrite the persona, contradict the guardrail footer, and
  steer the post-turn extraction pass into writing chosen memories for their
  own user — a real integrity concern, not an authorization one.

**Classification: ACCEPTABLE FOR WORKSHOP · MUST FIX BEFORE PILOT.**
TD-062's own re-entry trigger — *"before Ask GRACE gains any new
server-side action capability beyond the existing proposal/approval flow"* —
has effectively been reached: the route now also carries a persistent
memory write path, which is exactly the case the trigger names as raising
the value of an injection. The bounded first move is **not** porting all of
`buildDataContext`: move the persona and `buildChatActionPrompt()`
server-side (small diff, removes the security-relevant half) and leave the
data aggregation for a separately scoped sprint.

---

## 5. Paper safety

| Control | Where it is claimed | Reality |
|---|---|---|
| Ambiguous destructive target is refused | ADR-018 closure, `handlers.ts` | **STRUCTURALLY ENFORCED** — and doubly so (ids left unset + explicit check). The one unambiguous win of the last three prompts. |
| Gated actions cannot be executed directly | `/api/actions/execute` | **STRUCTURALLY ENFORCED** |
| Approval requires `approvals.decide` | `/api/approvals` | **STRUCTURALLY ENFORCED** |
| **A consequential action stops at a *different* named human** | TD-061 framing, positioning | **DOCUMENTED ONLY** — no separation of duty exists; the proposer may approve their own request (C-13) |
| Tenant isolation | ADR-017 §14 | **STRUCTURALLY ENFORCED** (signed claim + server resolution) |
| Memory is per-user, provenance-consistent | ADR-014 | **STRUCTURALLY ENFORCED** (RLS + CHECK constraint) |
| Church knowledge has no runtime write path | ADR-015 | **STRUCTURALLY ENFORCED** (no write policy, no code path) |
| **Memory is supplementary; live data wins** | ADR-014/018, AI_BOUNDARIES | **PROMPT-ENFORCED** |
| **Source precedence chain** | ADR-014/015/017/018 | **DOCUMENTED ONLY** — no mechanism exists |
| **PROHIBITED outranks every other evidence state** | ADR-018 | **DOCUMENTED ONLY** at runtime; the precedence function is real and uncalled |
| **Every inference must be labelled** | AI_BOUNDARIES | **PROMPT-ENFORCED** (worded as "requires") |
| **ACT-readiness gate** | ADR-018 item 18 | **TEST-ONLY** — `resolveActionReadiness` runs only in tests |
| **Capability boundary is authoritative for what GRACE can do** | ADR-017 | **PROMPT-ENFORCED** — and contradicted by `dataContext` for attendance (C-02) and by the executor for `send_email` (C-04) |
| **Moderation on Ask GRACE** | ADR-014 | **DOCUMENTED ONLY** — never requested from the gateway |
| **Every surface reads the catalog** | `actionCatalog.ts` header | **DOCUMENTED ONLY** — `#/redesign` declares its own |
| **`runtimeAvailable`** | manifest | **TEST-ONLY ASSUMPTION** — `true` for all 8 while production has none of the code |

---

## 6. Capability islands (inventory only — nothing was connected)

1. **`#/redesign` Ask GRACE** — a whole second assistant, invisible to the
   governance stack (R-01).
2. **Households** — real tables (migration 031), 9 columns, never queried by
   any chat path. Honestly declared as `cap-household`.
3. **Sunday prep / volunteer scheduling** — UI state, never persisted to
   Supabase, never prompt-visible. Declared as `cap-volunteer-scheduling`.
4. **Work Orders / Decision Queue / approvals** — a live subsystem (4 pending,
   2 decided approvals; 248 agent findings) with the most mature
   authorization pattern in the codebase (`assign_work_order_owner`), and
   GRACE cannot see or reach any of it. Declared as `cap-decision-queue-visibility`.
5. **Consents / opt-outs** — real table, RLS-confirmed by Fixture #002,
   never consulted before a send. Declared as `cap-comms-consent-visibility`.
6. **Announcements / scheduled messages** — zero chat visibility (domain 9 KNOW = F).
7. **`fetchCommunityPosts(churchId, …)`** — a real per-church path that exists
   and is unused; `buildDataContext` calls the zero-arg demo function instead (R-12).
8. **`audit_logs` / `security_events`** — written, `audit.view`-gated, never
   readable through GRACE even for an authorized reviewer.
9. **`permissions.sensitivity`** — seeded meaningfully, read by no runtime path.
10. **Giving detail** — pledges, campaigns, designated funds: persona coaches
    the vocabulary, no data exists. Corrected at the capability layer by
    `cap-giving-detail`, not at the persona layer.
11. **Prayer dates** — present on the record, absent from the prompt, so no
    staleness qualification is possible.

Islands 2–6 and 9–11 are **honestly declared** by the capability layer. That
is the system working: the gaps are named, not hidden. Islands 1 and 7 are
not declared — they are drift.

---

## 7. The 10 × 7 grid — audit overlay

**The frozen Capability Baseline is unchanged.** This overlay records where
the conceptual grid and the runtime have diverged.

| Domain | Baseline (proven) | Runtime evidence | Weakest seam | Confidence | Next evidence needed |
|---|---|---|---|---|---|
| 1 Church identity | KNOW, REMEMBER | **LIVE MODEL** — two persisted correct mission answers | training-knowledge guardrail is prompt-only | **High** | a deliberate adversarial "what do you know about Central Christian Church" run |
| 2 People/households | KNOW (wiring), REMEMBER, RECOMMEND (catalog shape) | wiring only; memory has 0 live rows | 3 of 4 ACT actions bypass the server pipeline | **Medium** | one live memory round-trip; households remain out of scope |
| 3 Ministry/discipleship | none | **negative** — group stats are demo data in production | zero-arg `getDemoCommunityDataForCRM()` | **High (that it is broken)** | wire `fetchCommunityPosts`, or stop emitting the line |
| 4 Pastoral care | KNOW, REMEMBER, RECOMMEND, ACT(`delete_prayer`) | prompt composition proven; no live prayer action ever run | no dates ⇒ no staleness; `add_prayer` hardcodes `isPrivate:false` | **Medium** | a live `delete_prayer` on a TEST record |
| 5 Sunday/worship | none | service times only | whole subsystem unpersisted | **High** | discovery — what is the real system of record |
| 6 Events/calendar | KNOW, RECOMMEND, ACT(documented) | 7-day forward window, private excluded | **zero** server-routed action in the domain | **Medium** | not a workshop priority |
| 7 Giving/finance | none | MTD + 30d + top-5 only | persona/data mismatch, now capability-corrected | **Medium** | discovery — which giving system of record |
| 8 Staff/work | KNOW (limitation), RECOMMEND, ACT(`delete_task`) | titles only | Work Orders/Decision Queue unwired | **Medium** | a live `delete_task` on a TEST record |
| 9 Communications | ACT (both paths) | **no live send, ever** | `send_email` gate ≠ advertised gate; consent-blind | **Low** | `send_sms` propose→approve→execute on a TEST person |
| 10 Governance | KNOW, REMEMBER, ACT (strongest cell) | RLS posture live-verified; routing INTEGRATION-proven | routing chosen client-side; `sensitivity` unenforced | **High** | a live approval round-trip from the chat door |

**Divergence.** The grid's ACT column reads far stronger than the runtime
supports. Domains 2, 4, 6, 8 all show ACT — but the underlying truth is
"a catalog entry and a client-side dispatcher exist," and **nothing in any
of those cells has ever executed against live data.** The grid measures
*mechanism present*; it does not measure *mechanism exercised*.

---

## 8. The middle-intelligence gap — still real?

**Yes, and Prompts 9/10/10A made it more visible, not smaller.**

GRACE can jump KNOW → ACT because both ends have machinery: data lines in
the prompt, and an action catalog with executors. The middle has none.

- **CONNECT is not proven anywhere.** Every CONNECT cell is NOT YET PROVEN,
  FUTURE, or a documented finding. The two CONNECT scenarios that exist
  (`pc-connect-prayer-and-giving`, `chn-connect-event-mission`) live in the
  **advisory** live-judgment tier, are excluded from CI, and were last run
  manually.
- **INTERPRET is not proven anywhere.**
- **RECOMMEND has a dedicated NOT_RUN case
  (`ep-recommend-no-currently-proven-recommendation-tracking`) whose entire
  purpose is to record that no RECOMMEND capability is PROVEN in any domain.**
- **ANTICIPATE is declared unavailable** (`cap-anticipate`).

Concrete examples of the jump:
1. *"Delete Sarah"* → GRACE can emit `delete_person` (ACT) but has no way to
   connect Sarah's giving, prayer, and task records to notice the deletion is
   consequential. The safety comes from approval routing, not understanding.
2. *"Who needs follow-up?"* → GRACE can list open tasks (KNOW) and create
   tasks (ACT), but cannot connect a task to the prayer request, the giving
   lapse, and the missed attendance that would make the recommendation right.
3. *"Should we text the Nguyens?"* → GRACE can `send_sms` (ACT) but cannot
   see consent, prior sends, or opt-out (`cap-comms-consent-visibility`).

**Is CONNECT the next architectural layer? No — building it now would be
premature.** CONNECT means relating records across authoritative domains.
Today the prompt contains: people counts, giving totals + top-5 donor names,
non-private unanswered prayer text, open task **titles only**, 7-day event
titles, and demo group stats. There is not enough cross-domain *substance*
in the prompt to connect. A CONNECT layer built on this would be a reasoning
layer over a data surface that Central Henderson has not yet told us is the
right one. The blocker is **source**, not architecture — and source is a
discovery output.

---

## 9. Four readiness statuses

### DEMO READINESS — **READY**
Legs 1 and 2 are live-model proven, with persisted evidence in
`grace_messages`: the mission answer and *"I don't have an authorized Central
Henderson–specific source…"*. Ten `grace_knowledge` rows are live. The
capability and epistemic blocks compose on every turn. 1551 tests pass; the
exam and harness report zero safety-critical failures.
*Conditions:* demonstrate from the branch Preview and say so; do not ask
about group activity (R-12); do not demonstrate `send_email` (C-04).

### DISCOVERY WORKSHOP READINESS — **CONDITIONAL**
> **Updated 2026-08-31 after the live rehearsal** (see
> [Rehearsal Log](GRACE_WORKSHOP_REHEARSAL_LOG.md)). Legs 4a and 4b now have
> live end-to-end evidence and are **READY**. Leg 3 recalls correctly but
> **fabricates the meeting's date** (R-17, reproduced 2/2) and must be fixed
> before it is shown. The condition below is therefore now one small code fix
> plus a UI pass, not three rehearsal tasks.
Conditional on three rehearsal tasks, not engineering:
1. **Write one memory on the live tenant in a prior session** and confirm it
   recalls the next day. `grace_memories` is empty; leg 3 has nothing to
   recall.
2. **Rehearse leg 4 once, end to end, on a TEST-only target** —
   propose → Decision Queue → decide → execute → audit row. It has never run.
3. **Confirm the Preview URL is the one shown**, and state plainly that this
   is a Preview build, not production.
The discovery instrument, gap map, playbook, workbook, facilitator packet,
pilot contract, and requalification engine are all present and test-backed.

### PILOT READINESS — **NOT READY**
Five blockers (Scorecard §Pilot): branch-only deployment (R-03/C-11); no
moderation (R-05/C-09); the `#/redesign` parallel assistant (R-01/C-06/C-07);
`send_email` permission mismatch (R-07/C-04); client-composed system prompt
(R-04/TD-062). Every capability entry is `proofBoundary: 'mock'` and no chat
action has ever executed live.

### PRODUCTION READINESS — **NOT READY**
Production carries none of this code. Beyond the pilot blockers: no live-UI
coverage of any chat path; audit writes are non-transactional (TD-060);
memory has no correction path (R-08); domain 3 emits fabricated data (R-12).

**No green status implies another.** DEMO READY rests on two turns that
happen not to touch memory, actions, moderation, or production.

---

## 10. The four-part workshop demo — validated

| Leg | Status | Prompt 9/10/10A impact | Failure & recovery |
|---|---|---|---|
| **1. KNOWN** — "What is our mission and four-part strategy?" | **STRONG — live proven twice** | **Minimal.** This worked at ADR-015. The capability block adds honest framing; the epistemic block adds nothing here. | Retrieval miss → empty knowledge block → GRACE answers from `dataContext` alone. Recovery: ask the narrower question ("what is the four-part strategy") — `to_tsquery` OR over 10 rows makes a total miss unlikely. |
| **2. BOUNDARY** — "What was Central Henderson's FY2024 revenue?" | **STRONG — live proven** | **Material.** ADR-015 already produced the decline; ADR-017 now adds `cap-identity-know`'s explicit *"no authorized campus-specific source"* and ADR-018 adds `SOURCE_SCOPE_MISMATCH`'s rule that a nearby source never answers the actual question. The decline is now **triple-grounded** (scope rows + capability block + epistemic rule) instead of single-grounded. | Worst case: the model answers from training knowledge of the real, publicly documented Central Christian Church. This is guarded only by prompt text (ADR-015 says so). Recovery: ask GRACE to name her source — she has none to name. **Do not press the question twice** hoping for a better phrasing. |
| **3. MEMORY** — a real prior-session fact | **REHEARSED 2026-08-31 — misdated the meeting (R-17); FIXED and re-verified over 4 live samples. READY.** | **Minimal.** ADR-014 owns this leg entirely. | **Observed live, 2/2 runs:** GRACE recalled *"Thursday at 2pm"* correctly and attributed it (*"you told me"*) — then added *"that's scheduled for today (Aug 31), so that's coming up in a few hours."* Aug 31 2026 is a **Monday**. She read the memory's `created_at` label as the event date (**R-17**). Also: the next turn's extraction wrote a **duplicate** row carrying the wrong date (**R-19**). **Recovery: none in-demo — fix R-17, then re-run the rehearsal, then seed the real memory a day early through the real UI.** |
| **4. AUTHORITY** — a safe TEST-only action | **REHEARSED 2026-08-31 — READY.** Both the refusal and the full propose→approve→execute→audit chain ran live. | **Material, and the best story of the three prompts.** 10A makes the ambiguity refusal real and structural, and Central Henderson's live roster genuinely contains **2 Sarahs and 3 Marcuses** — so *"Delete Sarah"* → *"More than one person matches 'Sarah'. I found: … Which one do you mean?"* is a true, data-grounded refusal, not a scripted one. Following it with a fully-specified `send_sms` to a TEST person shows propose → Decision Queue → approve → execute → audit. | **Observed live, 2/2 runs:** *"Delete Sarah"* → *"Which Sarah — Sarah Mitchell or Sarah Chen?"*, with the deterministic `hydrateAction` backstop independently confirmed (`personAmbiguous: true`, `personId: undefined`). The full `delete_person` chain then ran against a TEST person: `/execute` refused it (400 `action_requires_approval`), `/propose` queued it, approval executed it, audit recorded it. Caveat at the time: proposer and approver were **the same user** (**C-13**), and the mutation audit row said `action='update'` for a deletion (**R-18**) — both closed 2026-09-04 and re-rehearsed live (self-approval → 403; approved deletion filed as `delete`). **Do not demonstrate `delete_person` on anything but a TEST record**, and do not demonstrate `send_email` at all. |

**Recommended shape.** Legs 1 → 2 → 4 → 3, with leg 3 last so that a
same-session "remember X" → new conversation → "what did I tell you"
round-trip can stand in if the pre-seeded memory misbehaves. **Do not add a
fifth demo.** The temptation after three architecture prompts is to show the
capability block or the epistemic contract; both are prompt text, and
showing them would be showing paper.

---

## 11. Safety bypass review

| Attempt | Result |
|---|---|
| Forged church id in the request body | **Blocked.** `churchId` is read only from the signed JWT (`auth-helper.ts:68`). Covered by `grace-capability.test.ts:179`. |
| Forged permission claim in conversation or `dataContext` | **Blocked.** `actor.permissions` is server-loaded; `buildCapabilityContext` never reads `dataContext`. Covered by the self-awareness suite. |
| Unauthenticated demo bypass on a real tenant host | **Blocked.** `DEMO_HOSTS` excludes `gracecrm-centralhenderson.org`, and `NON_DEMO_CHURCH_IDS` refuses the env fallback. `authz.demo.test.ts`. |
| Prompt injection via `dataContext` | **Partially open by design (TD-062).** Can change what GRACE *says* and steer the extraction pass. Cannot change tenant, permission, or execution. |
| Memory authority elevation ("my memory says I'm an admin") | **Blocked for authority.** Capability and permission never read memory. **Open for facts** — memory subordination is prompt-only. |
| Capability elevation by adversarial phrasing | **Blocked structurally** — the block is unconditional, never gated on a classifier. |
| Ambiguous destructive target | **Blocked on the catalog surface** (10A). **Open on `#/redesign`**, which has no ambiguity check at all (R-01). |
| Missing action parameters | **Partially open.** Handlers re-check a subset (title, personId, body…). `add_task` still defaults a missing `dueDate` to +7 days. `REQUIRED_ACTION_PARAMETERS` is never enforced at runtime. |
| Direct execute bypass of an approval-gated action | **Blocked.** `/api/actions/execute` refuses `requiresApproval` before touching the actor. `execute.test.ts`. |
| Approval bypass | **Blocked.** `approvals.decide` required; church-scoped; conditional on `status='pending'` so a concurrent decision cannot double-execute. |
| Self-approval (proposer decides own request) | **Blocked (2026-09-04).** The PATCH decide path refuses `approve`/`approve_with_changes` when `requested_by_user_id === actor.userId` (403 `self_approval`). Withdrawing one's own request is still allowed; agent proposals are unaffected. Route-tested; live rehearsal asserts the refusal, then approves as a second System Administrator. (C-13, closed) |
| Source-scope laundering (consolidated figure as Henderson's) | **Prompt-guarded only** — but live-observed holding once. |
| Cross-tenant retrieval | **Blocked.** Every query filters `church_id`; RLS SELECT-only verified live in `pg_policy`. |
| Unauthorized sensitive-data access | **Blocked for private prayers/events** (TD-066/067, regression-tested). **Open in one direction:** the epistemic block publishes colliding roster names to the model on every turn (R-11). |

**No new bypass was found.** The `#/redesign` surface (R-01) is not a new
bypass of the audited stack — it is a pre-existing surface the stack was
never applied to. It is reported rather than fixed because the fix is not
narrowly bounded (a second architecture would have to be brought under the
catalog), it creates only non-destructive records, and item 27's default is
audit, not implementation.

**No code was changed during this checkpoint.** No finding met all six of
item 27's conditions: the two candidates worth considering — `#/redesign`
ambiguity (R-01) and the `send_email` permission mismatch (R-07) — fail on
"narrowly bounded" and on "clearly proven safe to change" respectively
(tightening `_send.ts` could break sends for staff who were never granted
the RBAC key).

---

## 12. Test-architecture weaknesses

**Strengths worth preserving:** adversarial cases fail via `dangerousFailure()`;
`requiresLiveJudgment` cases carry no `run()` and report NOT_RUN rather than a
fabricated pass; architectural findings never inflate a cell; a NOT_RUN case
exists purely to record that no RECOMMEND capability is proven; the production
manifest is duplicated rather than imported from `tools/`, with a drift check.
This is better discipline than most production codebases have.

**Weaknesses:**
1. **The drift check compares the manifest to a copy of itself**, not to the
   executors. It cannot catch C-04 and did not.
2. **Prompt-presence asserted as behaviour.** Many self-awareness and epistemic
   cases prove a block is *in the prompt*. That is composition proof, correctly
   labelled — but the rollup reads as capability.
3. **`mockSupabase` resolves `.eq()` as a no-op keyed only by table name.** No
   test can distinguish a correctly scoped query from an unscoped one. Every
   tenant-scoping test is therefore a *code-shape* test.
4. **`proofBoundary: 'mock'` on 100% of PROVEN entries** — and the field is not
   duplicated into the production manifest, so the runtime copy looks stronger
   than the eval copy.
5. **Unit tests for functions with no production call sites** (`resolveActionReadiness`
   et al.) contribute to green counts without contributing to behaviour.
6. **Stale fixture reasoning** — Fixture #003 records a proof-boundary limit
   ("`buildDataContext` is not exported") that has been false since TD-066.
7. **Zero live-UI coverage** of the chat panel, action cards, Execute, or the
   ambiguity message — the exact surfaces the workshop will demonstrate.
8. **A safety-relevant test file can fail on a 5-second timeout**
   (`check-frontend-safety.test.ts`) and be indistinguishable from a real
   finding at a glance.

---

## 13. What GRACE actually is today — internal (VWS leadership)

**She knows** what Central Henderson's ten approved knowledge rows say about
its identity, mission, four-part strategy, and ownership path, with source
attribution — and she knows the boundaries of that source well enough to
decline a Henderson-specific financial figure rather than substitute the
consolidated one. That decline is live-observed, not theorised. Beyond that
she knows only what the browser assembles each turn: headcounts by status,
month-to-date and 30-day giving totals with top donors, non-private
unanswered prayer text, open task titles, seven days of public event titles,
upcoming birthdays, and — a real defect — hardcoded demo group-activity
statistics.

**She remembers** what an individual staff member tells her, scoped to that
person and that church, with database-enforced provenance and read-only RLS.
The mechanism is built and tested; **the live table is empty**, so
cross-session recall has been proven in integration and never observed in
production data. There is no correction mechanism: a corrected fact becomes
a second note, and choosing between them is left to the model.

**She can access** exactly what the client sends her plus what the server
retrieves for her. She cannot see households, attendance history, volunteer
schedules, the Decision Queue, consent records, announcements, giving
detail, or the audit trail — every one of which is a real subsystem in this
product, and most of which she now declares honestly when asked.

**She can do** fourteen catalogued actions. Four are properly governed:
`delete_task` and `delete_prayer` execute server-side with a permission
check and an audit row; `delete_person` and `send_sms` route to a human
holding `approvals.decide` before anything happens. Nine create/update
actions still run through the browser with no server permission check and no
audit row. `send_email` sends through a route that checks a legacy role list
rather than the permission GRACE tells the user is required. **No chat
action of any kind has ever executed against live data.**

**She can refuse.** This is the strongest thing about her. She refuses
outside-scope financial questions (live-proven), she refuses to score or
judge a person's spiritual state or character as an absolute prohibition
checked before every other table, and — since the Prompt 10A closure — she
structurally refuses to act on an ambiguous target, leaving the entity id
unset so that even a handler that skipped the check fails closed. Central
Henderson's roster really does contain two Sarahs.

**She can clarify** — under a well-designed contract that the model is asked
to honour. The contract's deterministic half (name collisions, the
parameter table) is composed correctly; its *deciding* half never executes.

**What is missing:** any proven CONNECT, INTERPRET, RECOMMEND, or
ANTICIPATE capability in any of the ten domains; moderation on the chat
route; server-side prompt composition; a memory correction path; and any
live evidence of memory or action.

**What is only future architecture:** the epistemic decision resolver
(complete, tested, uncalled), the capability manifest as an enforcement
mechanism (it supplies wording, not gates), `runtimeAvailable` (true
everywhere, false in production), and `permissions.sensitivity` (seeded,
read by nothing).

**And one thing to say plainly:** none of this is in production. The whole
intelligence stack lives on `feat/ai-work-cards`. `main` has no Ask GRACE
turn endpoint at all.

---

## 14. What GRACE is today — Central-facing

GRACE knows Central Henderson's mission, four-part strategy, and ownership
path from the material you approved, and she'll tell you where each answer
came from. Just as importantly, she knows what she wasn't given: ask her for
a Henderson-specific revenue, attendance, or debt figure and she'll tell you
she doesn't have an approved source for it, rather than reaching for a number
from somewhere else.

She sees your day-to-day: who's in your people list and at what stage,
what's been given this month, what prayer requests are open, what tasks are
outstanding, and what's on the calendar this week. Prayer requests and events
marked private never reach her.

She remembers what you personally tell her — *"my meeting with Bill is
Thursday"* — and only you. Another staff member never sees your notes, and
she'll always tell you a note came from you rather than from the church's
records.

She can help you act: add a task, log a note, record a prayer request,
update someone's stage, schedule an event, send a message. Some of those she
does straight away. The consequential ones — removing a person, sending a
text — she prepares and hands to a person with the authority to decide.
Nothing irreversible happens because GRACE decided it should.

And she asks before she guesses. If you say *"delete Sarah"* and there's
more than one Sarah, she stops and asks which one — she won't pick.

**What she can't do yet:** she doesn't have your household or family
groupings, she can't tell you who has or hasn't attended, she can't see
volunteer schedules or Sunday service plans, and she can't see pledges,
campaigns, or designated funds — only overall giving totals and top givers.
She can send a message but can't yet check whether someone has opted out
first. And she only answers when you ask; she doesn't watch for things and
bring them to you.

The workshop is where you tell us which of those gaps actually matter.

---

## 15. Next-step recommendation

# A — PROCEED TO CENTRAL DISCOVERY

**Why, from the evidence.**

1. **The blocker is source, not architecture.** Six of ten domains
   (2, 4, 6, 8, 10 and partially 1) already have a working KNOW→ACT path.
   The four that don't — ministry, Sunday/worship, giving, communications —
   are thin because *we do not know what Central's systems of record are*,
   not because a reasoning layer is missing. Building CONNECT over
   headcounts, giving totals, and task titles would be reasoning over a data
   surface Central hasn't validated.
2. **CONNECT would be premature (§8).** Not one CONNECT, INTERPRET, or
   RECOMMEND cell is proven, and the harness contains a case whose only
   purpose is to say so honestly. That is not a signal to build the next
   level up — it is a signal that the levels below it lack substance.
3. **Foundation-fix-first (C) is tempting and wrong *for this decision*.**
   The five pilot blockers are real, and every one of them must be closed
   before a pilot. But none of them blocks a **discovery workshop**: no
   blocker prevents demonstrating from a Preview, and the two legs that need
   work need *rehearsal*, not engineering. Fixing them now would delay the
   workshop to solve problems whose right scope the workshop itself will
   inform — particularly TD-062, whose correct target shape depends on which
   data Central actually wants GRACE to hold.
4. **Waiting produces better engineering.** The most valuable thing we could
   learn this month is which of the eleven capability islands Central cares
   about. Building any of them first is a guess.

**The one thing to do before the workshop** is not engineering: **rehearse
demo legs 3 and 4 once on the live tenant** (§10). GRACE has never
remembered anything in production and has never performed a governed action
on real data. Both are five-minute rehearsals; both are embarrassing to
discover live.

**What should stay intentionally blocked until discovery evidence arrives:**
households wiring, giving wiring, attendance wiring, Sunday systems, WorkOS
exposure, CONNECT/INTERPRET/RECOMMEND/ANTICIPATE, new actions, permission
changes, embeddings, LLM-as-judge, and any Capability Baseline change.

**What Central must decide that we cannot:** which systems are the real
records for giving, attendance, and Sunday planning; what "household" means
to them; who is allowed to see giving detail and pastoral-care content; what
must always require approval; and which of the ten domains is worth pilot
engineering at all.

**Immediately after discovery, and before any pilot:** the five blockers, in
this order — merge/deploy (R-03), moderation (R-05), `send_email` permission
(R-07), the `#/redesign` surface (R-01), server-side prompt composition
(R-04/TD-062). Those are a scoped sprint, not this checkpoint.

---

## 16. The closing question

**Is GRACE a coherent intelligence system, or a collection of individually
working layers with gaps between them?**

**Neither, cleanly — and the precise answer matters more than the label.**

Her **authority system is coherent**. Identity, tenant, permission,
approval, and audit agree with each other, are server-resolved, are hard to
defeat, and were re-verified from three independent angles in this audit
(code, tests, live database). Nothing found here punctures it.

Her **intelligence system is not yet coherent.** The four layers built to
make it so — church truth, memory, capability, epistemics — are each
individually well-built and individually tested, and they all terminate in
the same place: **text in a prompt, adjacent to a larger, higher-positioned
block the client composed.** They do not constrain each other, they cannot
resolve a conflict with each other, and the two that were explicitly
designed to *decide* something have no runtime call site at all. That is why
the same prompt can declare attendance unavailable while supplying
attendance, and why GRACE can tell a user they lack permission to send an
email the server will happily send.

The gap between the two halves is exactly one thing: **the layers that know
things and the layers that enforce things are not connected to each other.**
Prompt 10A is the single place where they were — one deterministic gate,
enforced before approval, honoured by every handler — and it is
conspicuously the most convincing safety property in the system.

That is a good position to be at a checkpoint. The hard half — authority —
is done and proven. The soft half is well-designed and needs to be *wired*,
not redesigned. And the right time to wire it is after Central tells us what
it should be wired to.
