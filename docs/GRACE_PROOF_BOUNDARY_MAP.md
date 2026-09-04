# GRACE Proof Boundary Map

**Date:** 2026-08-31 · **Branch:** `feat/ai-work-cards` @ `981d8e8`

Evidence classes, never collapsed:

| Class | Means |
|---|---|
| **UNIT** | a function's own behaviour, in isolation |
| **INTEGRATION** | two or more modules composed, still mocked at the edges |
| **LIVE DB** | exercised against the real Supabase project `asphekfvpiancyltzdxp` |
| **LIVE MODEL** | a real Claude call produced the behaviour |
| **LIVE UI** | a human drove the real browser surface end to end |
| **ARCH ONLY** | the code exists and is correct; no test and no run exercises it in the product path |
| **NOT PROVEN** | no evidence of any class |

A mocked Supabase (`tests/fixtures/mockSupabase.ts` resolves `.eq(...)` as
a no-op keyed only by table name) proves **INTEGRATION**, never **LIVE DB**.
A prompt instruction proves **nothing about behaviour**. A passing API-route
test proves **INTEGRATION**, never **LIVE UI**.

---

## 1. Verification run (2026-08-31)

| Suite | Result |
|---|---|
| Full repo `npx vitest run` | **171 files pass, 1551 tests pass, 73 skipped.** 1 file failed on a 5 s vitest timeout (`tools/check-frontend-safety.test.ts`, a whole-repo filesystem scan); re-run at `--testTimeout=60000` → **8/8 PASS**. No genuine failures. |
| `tools/eval-harness/run-all.ts` | **36 cases: 35 PASS, 0 PARTIAL, 0 FAIL (0 safety-critical), 1 NOT_RUN** |
| `central-henderson-exam/run-exam.ts` | **30 cases: 22 PASS, 0 PARTIAL, 0 FAIL (0 safety-critical), 8 NOT_RUN** |
| Targeted (`tools/eval-harness`, grace-*, `api/grace`, `api/actions`) | **23 files / 241 tests pass** |
| Live-judgment tier | **NOT_RUN** (paid, manual, advisory by design — ADR-016) |

No baseline was changed.

---

## 2. Behaviour-by-behaviour

### Identity, tenant, permission

| Behaviour | Strongest proof | Notes |
|---|---|---|
| Clerk JWT verified; `churchId` from signed `app_metadata` | **INTEGRATION** (`auth-helper.test.ts`, `authz.test.ts`) | + **LIVE DB**-adjacent: 48 real `ask-grace` `token_usage` rows exist, all church-scoped |
| Demo bypass cannot resolve a real tenant | **INTEGRATION** (`authz.demo.test.ts`) | derived `NON_DEMO_CHURCH_IDS` guard |
| `requirePermission` on `/api/actions/*` | **INTEGRATION** (`execute.test.ts`, `propose.test.ts`) | |
| RLS SELECT-only on the four `grace_*` tables | **LIVE DB** | verified in `pg_policy`: `grace_conversations/knowledge/memories/messages` all `relrowsecurity=true`, exactly one `r` (SELECT) policy each, no write policy |
| RLS *correctness* under a real member/staff JWT | **NOT PROVEN** | mock resolves `.eq()` as a no-op; ADR-015 admits this |
| Cross-tenant capability isolation | **UNIT** (`grace-capability.test.ts` forged-church-id cases) | never exercised with a second real tenant |

### Church truth

| Behaviour | Strongest proof | Notes |
|---|---|---|
| `grace_knowledge` seeded and retrievable | **LIVE DB** | 10 Central Henderson rows: 5 `scope_boundary`, 2 `mission`, 1 each `identity`/`strategy`/`ownership_path` |
| Mission question answered from the seed | **LIVE MODEL** | two real assistant replies persisted in `grace_messages` (2026-08-31) |
| Henderson FY2024 figure declined | **LIVE MODEL** | real persisted reply: *"I don't have an authorized Central Henderson–specific source…"* |
| Scope-boundary rows always injected | **INTEGRATION** (`grace-knowledge.test.ts`) | |
| Guardrail stops the model using *training* knowledge of Central Christian Church | **NOT PROVEN** — prompt-only by ADR-015's own admission | one live observation is not a proof boundary |
| `dataContext` excludes private prayers / private events | **UNIT** (`GraceChatContext.test.ts`, TD-066/067) | |
| Group-activity stats are per-church | **DISPROVEN** — `getDemoCommunityDataForCRM()` takes zero arguments; proven as an architectural finding, in production |

### Memory

| Behaviour | Strongest proof | Notes |
|---|---|---|
| `parseRememberDirective` → `user_stated` row | **INTEGRATION** (`_chat.test.ts`, `grace-memory.test.ts`) | |
| Extraction → `ai_extracted` row | **INTEGRATION** (`_chat.test.ts` "TD-064") | |
| Retrieval union (recency ∪ FTS ∪ person_ids) | **INTEGRATION** | |
| Memory subordinate to live data | **ARCH ONLY / prompt-enforced** | one sentence in `buildMemoryBlock`; no code path can enforce it |
| Provenance cannot be misreported | **LIVE DB (schema)** | `grace_memories_provenance_consistent` CHECK |
| Correction / supersede | **NOT PROVEN — not implemented.** `status` never transitions; `MEMORY_SUPERSEDED` reason code has no producer; two conflicting memories are both injected and the model is asked to prefer the newer date |
| **Cross-session recall, live** | **LIVE MODEL PROVEN 2026-08-31** — recalled across a new conversation, correctly attributed. Superseded the earlier zero-rows finding. But see R-17: the same reply fabricated the meeting's date. | Before the rehearsal the table held **0 rows** after 48 `ask-grace` calls — the feature had never been exercised in production. The rehearsal wrote, recalled, and then removed its own rows; **the table is empty again**, so a real workshop memory still has to be seeded deliberately. |

### Capability self-awareness

| Behaviour | Strongest proof | Notes |
|---|---|---|
| Manifest ↔ eval-manifest drift check | **UNIT** (`grace-capability.test.ts`) | |
| Resolver: qualified / permission / approval / gap / prohibited | **UNIT** | |
| Tenant gate on the capability block | **UNIT** | |
| Capability block reaches the prompt every turn | **INTEGRATION** (self-awareness suite, 17 cases) | |
| GRACE *answers* capability questions truthfully | **NOT PROVEN** (`requiresLiveJudgment`, no `run()`) | honest by design |
| Manifest claims match executor behaviour | **DISPROVEN for `send_email`** — manifest says `communications.send`, endpoint checks legacy roles |
| Every manifest entry's own declared boundary | `proofBoundary: 'mock'` — **self-declared INTEGRATION for all 8 entries** |

### Epistemics

| Behaviour | Strongest proof | Notes |
|---|---|---|
| `resolvePrecedence`, `modeForEvidenceState`, `resolveActionReadiness`, `safeExplanationFor` | **UNIT** (`grace-epistemic.test.ts`, 29-case epistemic suite) | |
| Any of the above running in the product | **ARCH ONLY — zero production call sites** | |
| `detectNameCollisions` over the real roster | **LIVE DB** | Central Henderson has 9 colliding first names, incl. **2 Sarahs** and 3 Marcuses |
| The epistemic contract changes model behaviour | **NOT PROVEN** — prompt-enforced; 4 suite cases honestly `requiresLiveJudgment` with no `run()` |

### Actions

| Behaviour | Strongest proof | Notes |
|---|---|---|
| `parseActions` / `validateAction` | **UNIT** | |
| `hydrateAction` never resolves an ambiguous id | **UNIT** (`grace-actions.test.ts`) | |
| `blockOnAmbiguity` first in every entity-resolving handler | **UNIT** (`handlers.test.ts`) | the Prompt 10A closure |
| `/api/actions/execute` refuses `requiresApproval` actions | **INTEGRATION** (`execute.test.ts`) | |
| `/api/actions/propose` refuses non-approval actions | **INTEGRATION** (`propose.test.ts`) | |
| Approval decide → execute → audit | **INTEGRATION** (`decisions.test.ts`, `agentActions.test.ts`) | |
| Separation of duty (proposer ≠ approver) | **NOT PROVEN — not implemented.** No test asserts it because no code enforces it. |
| **Any chat action executing against real data** | **LIVE DB PROVEN 2026-08-31** — a `delete_person` ran the full propose→approve→execute→audit chain against a TEST person on the live tenant. | Before the rehearsal, `agent_actions` held only agent-door `flag_*` rows and `audit_logs` no chat-origin row at all. The rehearsal's rows are retained as evidence. `delete_task`, `delete_prayer` and both send paths remain unexercised live. |
| The 9 create/update actions carry a server permission check or audit row | **DISPROVEN** — catalog records `audited:false`; `ph-act-chat-door-bypasses-server-pipeline` pins it |
| Ambiguity blocking on `#/redesign` | **NOT PROVEN — not implemented** (`RedesignAskGrace.resolvePerson` is silent first-match-wins) |

### Model boundary

| Behaviour | Strongest proof | Notes |
|---|---|---|
| Budget enforcement + usage metering | **INTEGRATION** + **LIVE DB** (48 `ask-grace` rows) | |
| Prompt composition order | **UNIT** (block-order assertions) | |
| **Moderation on Ask GRACE** | **NOT PROVEN — not enabled.** `generateStreamed` is called with neither `moderateInput` nor `moderateOutput`. ADR-014's "budget + moderation + usage" claim is two-thirds true. |
| Streaming path delivers, persists, extracts | **INTEGRATION** + **LIVE DB** (9 persisted messages) | |
| Ask GRACE reachable in **production** | **DISPROVEN** — `main` carries neither `api/grace/_chat.ts` nor the `'grace/chat'` route entry |

### UI

| Behaviour | Strongest proof |
|---|---|
| Anything at all in the Ask GRACE panel | **NOT PROVEN as LIVE UI.** No automated browser coverage exists for the chat panel, action cards, Execute button, or the ambiguity message. The nine persisted `grace_messages` are the only trace of a human driving the real surface, and none of them exercised memory or an action. |

---

## 3. Summary

| Class | Count of audited behaviours |
|---|---|
| LIVE DB | 5 |
| LIVE MODEL | 2 (mission answer, boundary decline) |
| LIVE UI | **0** |
| INTEGRATION | 16 |
| UNIT | 11 |
| ARCH ONLY | 5 (whole epistemic decision layer) |
| NOT PROVEN | 9 |
| DISPROVEN | 5 |

**The strongest end-to-end proof GRACE currently has** is the pair of live
Central Henderson turns preserved in `grace_messages`: the mission answer
(sourced, conversational) and the FY2024 decline (correct refusal). Those
two are genuinely LIVE MODEL + LIVE DB.

**The weakest** is everything downstream of the model: no chat action has
ever run against real data, no memory currently exists, and no UI path is
covered by anything.
