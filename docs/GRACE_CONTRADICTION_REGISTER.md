# GRACE Contradiction Register

**Date:** 2026-08-31 · **Branch:** `feat/ai-work-cards` @ `981d8e8`

Places where two parts of the system make **incompatible claims**. Distinct
from the Risk Register: a risk is something that could go wrong; a
contradiction is something that is already inconsistent with itself.

Status vocabulary: **CLOSED** · **OPEN — WORKSHOP SAFE** · **OPEN — PILOT
BLOCKER** · **OPEN — SECURITY BLOCKER**.

---

## C-01 · "Live data outranks static knowledge outranks memory" — asserted, never enforced
**ADR-014/015/017/018 all restate a source-precedence chain.** In code there is
no precedence mechanism at all: `promptParts` is
`[dataContext, knowledgeBlock, memoryBlock, capabilityBlock, epistemicBlock, history, question]`
joined with `\n\n` (`_chat.ts:196-199`). Ordering is the only signal, and the
*least* authoritative source (client `dataContext`) is **first**. The only
conflict-resolution device is one sentence in `buildMemoryBlock`.
**Status: OPEN — WORKSHOP SAFE.** No live conflict has been observed, and the
demo script does not create one. Reclassify to PILOT BLOCKER if any capability
is built that depends on the precedence holding.

## C-02 · Capability block says attendance is unavailable; the same prompt supplies attendance
`KNOWN_CAPABILITY_GAPS`'s `cap-attendance` renders *"I don't currently have a
qualified way to answer attendance questions."* Two blocks earlier,
`buildDataContext` supplies `Check-ins last 30d: N` and a named
`Inactive members/regulars: …` list (`GraceChatContext.tsx:96-108, 191`).
Both statements reach the model in one prompt.
**Status: OPEN — WORKSHOP SAFE.** Central Henderson currently has no attendance
rows, so the data line renders its honest *"attendance not tracked in this
system"* fallback and the contradiction does not surface. **It surfaces the
moment attendance data exists** — which is a likely post-discovery outcome.
Reclassify to PILOT BLOCKER on the first attendance import.

## C-03 · Two registries of "what GRACE can do," cross-checked against neither each other nor the executors
`ACTION_CATALOG` (14 actions, `permission`/`requiresApproval`/`audited`) and
`PILOT_CAPABILITY_MANIFEST` (8 PROVEN entries) both describe capability.
`grace-capability.test.ts` checks the production manifest against the *eval*
manifest — a copy of itself — not against the catalog, and neither is checked
against what the endpoints actually enforce. C-04 is the first concrete
divergence this blind spot allowed.
**Status: OPEN — PILOT BLOCKER.** The drift check protects the wrong seam.

## C-04 · `send_email`: catalog and manifest say `communications.send`; the endpoint checks legacy roles
`actionCatalog.ts` `permission: 'communications.send'`;
`capability-manifest.ts` `permissionKey: 'communications.send'` with the claim
*"if you have permission to send communications"*;
`api/agentmail/_send.ts:13,27` and `_reply.ts:27`:
`requireClerkAuth({ allowedRoles: ['admin','pastor','staff'] })`.
GRACE will tell a staff member they are not authorized while the executor sends.
**Status: OPEN — PILOT BLOCKER.** Not a security *hole* (the endpoint is still
staff-gated and audited), but an external, unrecallable action whose real gate
is not the gate GRACE describes. Deliberately not fixed here: tightening the
route could break sends for staff who never received the RBAC key.

## C-05 · Epistemics says ASK on ambiguity; the executor's ambiguity check is a different check
`buildEpistemicContext` publishes a server-computed collision list from the full
`people` table. `blockOnAmbiguity` — the thing that actually refuses — reads
`personAmbiguous`, computed by `countPersonMatches` over the **client's** loaded
roster. ADR-018 explicitly rejected a client-composed ambiguity signal
("a client-composed signal for a safety-relevant gate would be inconsistent with
[ADR-017]") and then left the enforcing half on the client.
**Status: OPEN — WORKSHOP SAFE.** The client roster is the full church roster in
practice today (60 people). Becomes a real divergence at scale or under
pagination.

## C-06 · ADR-014 says the localStorage memory was retired; a live surface still uses one
ADR-014: *"the only 'memory' is `src/lib/grace-brain.ts`, a `localStorage`
list… per-browser, unscoped by church or user, lost on cache clear, with no
provenance"* — presented as the thing being replaced. `RedesignAskGrace.tsx:99-117`
implements a **new** one (`grace-ai-memory-v1`), model-written, unscoped,
provenance-free, on a live authenticated surface at `#/redesign`.
**Status: OPEN — PILOT BLOCKER.**

## C-07 · `actionCatalog.ts` claims every surface reads its vocabulary from the catalog
File header: *"Every surface — the chat assistant, the agents, and any future
command palette — reads its vocabulary from here rather than declaring its own."*
`RedesignAskGrace.tsx:22-38` declares its own protocol, including
`log_interaction` and `check_in`, which exist in no catalog.
**Status: OPEN — PILOT BLOCKER** (same root cause as C-06/R-01).

## C-08 · ADR-018 calls `resolveActionReadiness` the gate on ACT; nothing calls it
*"This is the single function that decides whether ACT is reachable at all
(item 18)."* Zero production call sites. Whether ACT is reachable is decided by
`handlers.ts` — a hardcoded per-type switch — and by the server endpoints.
**Status: OPEN — PILOT BLOCKER.** The described control does not exist at
runtime. It is not *wrong* — the endpoints do enforce — but the architecture
document names an enforcer that is not in the path.

## C-09 · ADR-014 says the chat route goes through "budget + moderation + usage"
Moderation is never requested (`_chat.ts:214`), so neither the input gate nor
the post-hoc output pass runs. ADR-014 additionally documents the streaming
output-moderation gap as "accepted" — implying it *runs and logs*. It does not.
**Status: OPEN — PILOT BLOCKER** for a pastoral-care product.

## C-10 · AI_BOUNDARIES says the epistemic contract "requires" inference labelling
*"the epistemic contract (`api/_lib/grace-epistemic.ts`) **requires** every
inference to be labeled as such."* It **instructs**. There is no code that can
detect an unlabelled inference, and the qualification cases that would prove the
behaviour are honestly `requiresLiveJudgment` with no `run()`.
**Status: OPEN — WORKSHOP SAFE.** A wording correction, but the wording is what
a reader would rely on. Same shape for *"PROHIBITED outranks every other
evidence state"* — true of a function nothing calls.

## C-11 · The manifest says `runtimeAvailable: true`; production carries none of it
All 8 entries set `runtimeAvailable: true`, with a comment explaining the field
exists "for the day that stops being true." That day is now: `main` has no
`api/grace/_chat.ts`. The eval-side manifest's header **does** say so
("production does not carry /api/grace/chat"); the production copy the resolver
actually reads does not.
**Status: OPEN — PILOT BLOCKER** (resolves on merge + deploy).

## C-12 · Fixture #003 states `buildDataContext` is not exported; it is
`fixture-003-people-households.cases.ts:12,63,72`. It has been exported since
TD-066, and Fixtures #004/#005/#006 plus the epistemic and self-awareness suites
all import it.
**Status: OPEN — WORKSHOP SAFE.** Housekeeping; it understates a real boundary.

## C-13 · "Every consequential action stops at a named human" — but not a *different* one
`TECH_DEBT.md` TD-061 and GRACE's own positioning describe the approval gate as
the control that puts a person between GRACE and an irreversible change.
`api/actions/_propose.ts:124` records `requested_by_user_id`. The decide path
(`api/approvals/_index.ts:87-184`) checks `approvals.decide`, church scope, and
`status='pending'` — and **never compares `requested_by_user_id` to
`actor.userId`**. There is no separation-of-duty control anywhere in the repo
(`grep` for `self_approv|own request|requested_by` returns only writers).
A System Administrator — which the live Central Henderson demo account is, with
all 49 permissions including `approvals.decide` — can ask GRACE to
`delete_person`, then approve their own request seconds later in the Decision
Queue. The change is fully audited and attributed; it simply is not a second
pair of eyes.
**Status: OPEN — WORKSHOP SAFE**, and in fact it is what makes a solo
rehearsal/demo of leg 4 possible at all. **Reclassify to PILOT BLOCKER** if the
pilot contract promises dual control. *Found while rehearsing demo leg 4 on the
live tenant (2026-08-31); it corrects an incorrect "self-approval blocked"
claim made earlier in this same checkpoint.*

---

## Previously known findings, reassessed

| Finding | Prior status | Now |
|---|---|---|
| Action ambiguity → destructive action (Prompt 10A) | OPEN | **CLOSED** for the catalog chat surface: `hydrateAction` leaves ids unset when ambiguous, and `blockOnAmbiguity` runs first in every entity-resolving handler, before approval routing. Re-opened only in the sense that `#/redesign` was never covered (R-01). |
| TD-061 chat actions unpermissioned/unaudited | Partially resolved | **CLOSED for the 4 destructive/external actions.** Still open for the 9 create/update actions — honestly recorded (`audited: false`) and pinned, so **not a contradiction**, a documented limit. |
| TD-066 / TD-067 private prayer & event leakage | RESOLVED | **CLOSED**, with regression tests. |
| TD-064 / TD-065 memory extraction & write failures | RESOLVED | **CLOSED in code**; but `grace_memories` holds **0 live rows**, so the fix is INTEGRATION-proven, not live-proven. |
| Domain 3 hardcoded demo community data | Documented finding | **OPEN — WORKSHOP SAFE** if not demonstrated; PILOT BLOCKER otherwise (R-12). |
| Households not exposed to chat | Documented gap | **Not a contradiction** — the capability block declares it honestly (`cap-household`). |
| Sunday/worship state not connected | Documented gap | **Not a contradiction** — declared (`cap-volunteer-scheduling`); persona no longer names "Sunday prep" (ADR-017 correction). |
| Work Orders / Decision Queue invisible to chat | Documented gap | **Not a contradiction** — declared (`cap-decision-queue-visibility`). |
| Giving persona/data mismatch | OPEN | **OPEN — WORKSHOP SAFE.** The persona still coaches pledges/campaigns/funds vocabulary; `cap-giving-detail` now corrects it at the capability layer. Two blocks in one prompt still disagree, but one of them is explicitly authoritative and the other is style guidance. |
| Communications visibility (consent-blind sends) | Documented gap | **Not a contradiction** — declared (`cap-comms-consent-visibility`). |
| `permissions.sensitivity` seeded but unenforced | Documented finding | **OPEN — WORKSHOP SAFE.** Proven as a finding by Fixture #007; never counted toward PROVEN. |
| Campus vs organization scope | No grounding mechanism | **Not a contradiction** — the framework says so explicitly; `grace_knowledge`'s scope-boundary rows are the only handling and they are always injected. |
| Freshness / versioning | Weak | **OPEN — WORKSHOP SAFE.** No "as-of" semantics anywhere; prayer dates still absent from the prompt. |
| Live-model proof gap | OPEN | **Narrowed, not closed.** Two live model behaviours are now evidenced in `grace_messages`; everything else remains mock-bounded. |
| Production `/api/grace/chat` deployment gap | OPEN | **Still open — C-11 / R-03.** Confirmed against `main`. |

## Prompt 9 / 10 / 10A impact on this register
- **Prompt 9 (ADR-017, capability)** closed real persona overclaiming and added
  a tenant-gated, always-present, server-composed boundary. It **created** C-02,
  C-03, C-04 and C-11 by writing capability claims down precisely enough to be
  checked against the executors for the first time. That is a net gain: these
  contradictions existed silently before; now they are legible.
- **Prompt 10 (ADR-018, epistemics)** gave the model an explicit contract and a
  real, server-computed collision list. It **created** C-08 and sharpened C-10
  by naming enforcers that do not run.
- **Prompt 10A (action-resolution closure)** is the only one of the three that
  changed **runtime enforcement**. It genuinely closed the ambiguous-destructive-
  target defect on the catalog surface, and it is the reason C-05 is a seam
  rather than a hole.
