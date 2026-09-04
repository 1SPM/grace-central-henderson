# GRACE Intelligence Coherence Scorecard

**Date:** 2026-08-31 · **Branch:** `feat/ai-work-cards` @ `981d8e8`

**PROVEN** · **PARTIAL** · **NOT PROVEN** · **BLOCKED**
Deliberately not averaged. A safety-critical BLOCKED must stay visible.

---

### Tenant Integrity — **PROVEN**
`churchId` comes from a Clerk-signed `app_metadata.church_id` claim and is
never accepted from a request body (`auth-helper.ts:68-72`). The demo bypass
is double-gated by `DEMO_HOSTS` **and** a derived `NON_DEMO_CHURCH_IDS`
refusal, and yields to any Bearer token (`authz.ts:100-165`, `authz.demo.test.ts`).
Every retrieval query filters `church_id` explicitly. RLS is enabled with
SELECT-only policies on all four `grace_*` tables — **verified live** in
`pg_policy` on project `asphekfvpiancyltzdxp`. Capability claims are
tenant-gated to `QUALIFIED_CHURCH_ID` and a forged church id yields the
generic block (`grace-capability.test.ts:173-179`).
*Residual (not enough to downgrade):* RLS policy **correctness** under a real
member/staff JWT is untested — the mock resolves `.eq()` as a no-op.

### Authority Integrity — **PARTIAL**
Server-side authority is sound: `resolveStaffActor` → `loadPermissionKeys` →
`requirePermission`, with `x-grace-view-as` gated on the caller's own
`admin.manage_settings` and logged. But the prompt's authority ordering is
inverted — the client-composed `dataContext` is the **first and largest**
block, ahead of every server-composed one (`_chat.ts:196`), and the declared
source-precedence chain has no enforcement mechanism at all (**C-01**).
Two registries claim capability and are cross-checked against each other but
not against the executors (**C-03**).

### Source Integrity — **PARTIAL**
Strong where it was built: `grace_knowledge` has **no runtime write path**,
scope-boundary rows are injected unconditionally, and a live Central Henderson
turn shows the boundary holding (*"I don't have an authorized Central
Henderson–specific source…"*, persisted in `grace_messages`). Weak elsewhere:
group-activity stats come from `getDemoCommunityDataForCRM()`, a zero-argument
demo fixture, **in production** (`GraceChatContext.tsx:128`); no freshness or
"as-of" semantics exist anywhere; and the guardrail against the model's own
training knowledge of Central Christian Church is prompt-only by ADR-015's own
admission.

### Memory Integrity — **PARTIAL**
Schema-level integrity is real and live: `church_id + user_id` scoping,
SELECT-only RLS, and a `grace_memories_provenance_consistent` CHECK that makes
a mis-provenanced row impossible. Subordination to live data is a **prompt
sentence**, not a mechanism. There is **no correction or supersede path** —
`status` never transitions, dedupe is exact-text only, and `MEMORY_SUPERSEDED`
is a reason code with no producer (**R-08**). And the live table holds
**0 rows** after 48 real `ask-grace` turns: cross-session recall is
INTEGRATION-proven and has never been observed in production data.

### Capability Truthfulness — **PARTIAL**
The mechanism is right: server-composed, unconditional, tenant-gated,
prohibitions checked before everything else, drift-detected against the eval
manifest, and it corrected genuine persona overclaiming. What it says is not
always true of what the system does — attendance is declared unavailable in the
same prompt that supplies attendance (**C-02**), and `send_email`'s advertised
permission is stricter than the one the endpoint enforces (**C-04**). All 8
entries declare `proofBoundary: 'mock'`, and all 8 declare
`runtimeAvailable: true` while production carries none of the code (**C-11**).

### Epistemic Integrity — **NOT PROVEN**
The contract is well-designed and well-tested as pure functions (29-case suite,
all adversarial cases via `dangerousFailure()`). **None of the deciding
functions run.** `resolveActionReadiness`, `resolvePrecedence`,
`modeForEvidenceState`, `safeExplanationFor` and `resolveActionCapability` have
zero production call sites; only the prompt text and the collision list reach a
request. Every epistemic guarantee in the system is therefore model compliance
with instructions, not enforcement (**R-02**, **C-08**, **C-10**).
*Genuinely earned:* `detectNameCollisions` runs live against the real roster
(2 Sarahs, 3 Marcuses at Central Henderson).

### Action Safety — **PARTIAL**
The best-engineered part of the system. `hydrateAction` deliberately leaves
`personId`/`taskId`/`prayerId` unset when ambiguous, so a handler that skipped
the explicit check still fails closed; `blockOnAmbiguity` runs **first** in
every entity-resolving handler, before approval routing; `/api/actions/execute`
and `/propose` refuse each other's action classes by construction; approvals
require `approvals.decide`. Held back by: there is NO separation of duty — `requested_by_user_id` is recorded and never compared to the approver (C-13); the ambiguity gate runs in the browser over
the client's roster (**C-05**); a parallel surface has no gate at all
(**R-01**); and no chat action has **ever executed against live data** —
`agent_actions` and `audit_logs` contain no chat-originated row of any type.

### Permission Integrity — **PARTIAL**
`requirePermission` is correct and used consistently on `/api/actions/*` and
`/api/approvals`. Nine of fourteen chat actions never reach it (**R-06**,
honestly recorded as `audited: false` and pinned by
`actionCatalogBinding.test.ts`), and `send_email` reaches a legacy role check
instead (**C-04**). `permissions.sensitivity` is seeded and read by nothing —
proven as a finding by Fixture #007, never counted as enforcement.

### Auditability — **PARTIAL**
Where auditing exists it is well built: `recordAudit` with `before`/`after`
snapshots, a `correlationId`, and — uniquely honest — an `audit_incomplete`
flag surfaced *to the user in chat* when the mutation lands but the trail does
not. `security_events` covers auth failures, cross-tenant probes, `view_as`,
and failed chat-message writes. Against that: the 9 create/update actions write
no audit row (they leave an `Interaction` note, which is ordinary editable
product data, not a trail), audit writes are non-transactional (TD-060), and
**nothing has yet been audited from the chat door in production**.

### Test / Proof Integrity — **PARTIAL**
Unusually strong discipline: 1551 passing tests; adversarial cases use
`dangerousFailure()` rather than plain `fail()`; `requiresLiveJudgment` cases
carry **no `run()`** and report NOT_RUN rather than a fabricated pass; a
NOT_RUN case exists specifically to record that **no RECOMMEND capability is
proven anywhere**; architectural findings never count toward PROVEN; the
production manifest is duplicated rather than imported from `tools/`, with a
drift check. Weaknesses: every PROVEN capability is `proofBoundary: 'mock'`;
the drift check compares the manifest to a copy of itself rather than to the
executors (**C-03**); several suites assert **prompt-block presence** as
evidence of behaviour; Fixture #003 records a proof-boundary reason that is no
longer true (**C-12**); and there is **zero live-UI coverage** of the chat
panel, action cards, or the ambiguity message.

### Workshop Readiness — **PARTIAL**
Two of four demo legs (KNOWN, BOUNDARY) are **LIVE MODEL proven** with
persisted evidence. Two (MEMORY, AUTHORITY) have never been performed
end-to-end on live data, and MEMORY currently has no prior-session fact to
recall because `grace_memories` is empty. Nothing blocks the workshop; two legs
need rehearsal, not engineering.

### Pilot Readiness — **BLOCKED**
Five blockers, each independently sufficient: the stack is not on `main` and
production has no Ask GRACE (**R-03/C-11**); no moderation on a pastoral-care
assistant (**R-05/C-09**); a second live assistant with none of the guarantees
(**R-01/C-06/C-07**); `send_email`'s enforced gate ≠ its advertised gate
(**R-07/C-04**); and the client-composed system prompt (**R-04/TD-062**), which
TD-062's own re-entry trigger — *"before Ask GRACE gains any new server-side
action capability"* — has now been reached.
