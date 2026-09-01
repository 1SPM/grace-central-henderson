# GRACE End-to-End Capability Ledger

**Date:** 2026-08-31 · **Branch:** `feat/ai-work-cards` @ `981d8e8`

An audit of the **runtime support** behind every PROVEN entry in
`api/_lib/capability-manifest.ts`. **The manifest is not modified by this
document.** A manifest entry can be technically valid and still rest on an
unproven seam; where that is true it is stated.

Tenant gate: every entry below is claimed only to actors whose
`churchId === 11111111-…-1111` (Central Henderson). Every other church
receives the generic "no qualified evidence yet" block.

---

## cap-identity-know — *Answer identity / mission / strategy / ownership questions*
- **Domain / level:** church_identity / KNOW
- **Evidence:** `chx-know-authoritative-seed-retrieval` (exam, PASS)
- **Runtime path:** `_chat.ts` → `retrieveChurchKnowledge` → `buildKnowledgeBlock` → prompt block 2 → Claude
- **Authorization dep.:** none beyond authenticated staff (`permissionKey: null`)
- **Epistemic dep.:** the `scope_boundary` rows + `GUARDRAIL_FOOTER` — always injected
- **Action dep.:** none
- **Strongest proof:** **LIVE MODEL** — two real, persisted, correct mission answers in `grace_messages`
- **Weakest unproven seam:** the guardrail against the model's *own training knowledge* of Central Christian Church is prompt-only (ADR-015 states this). One live observation ≠ a boundary.
- **Workshop:** **high** — this is demo leg 1, and it is the strongest thing GRACE has. **Pilot:** high.

## cap-identity-remember — *Recall the right identity fact, caveats intact*
- **Domain / level:** church_identity / REMEMBER · **Evidence:** `chx-remember-legal-tax-status-caveat-preserved`
- **Runtime path:** same as above; caveat preservation is a property of the seeded row text
- **Strongest proof:** **INTEGRATION** (mocked tsvector). Live `tsvector` behaviour is spot-checked, not harness-proven — the eval manifest says so itself.
- **Weakest seam:** retrieval is `to_tsquery` OR over 10 rows. With 10 rows almost everything matches; this has never been proven to *discriminate* at any larger row count.
- **Workshop:** medium. **Pilot:** medium — becomes fragile the moment a second source is seeded.

## cap-people-remember — *Remember what you personally tell me across sessions*
- **Domain / level:** people_households / REMEMBER · **Evidence:** `ph-remember-memory-vs-authoritative-distinction`
- **Runtime path:** `parseRememberDirective` → `saveMemory` **or** post-turn `runExtraction` → `saveMemory`; next turn `retrieveMemories` → `buildMemoryBlock` → prompt block 3
- **Authorization dep.:** none (`permissionKey: null`); scoping is `church_id + user_id` + RLS SELECT-only
- **Epistemic dep.:** subordination to live data — **prompt sentence only**
- **Strongest proof:** **INTEGRATION** (`_chat.test.ts` TD-064/TD-065 regressions)
- **Weakest unproven seam:** **the live one.** `grace_memories` holds **0 rows** on the live project after 48 real `ask-grace` turns. Nothing has ever been remembered in production data. Additionally there is **no correction/supersede mechanism** — `status` never leaves `'active'`, and a corrected fact becomes a second row that the model is merely *asked* to prefer.
- **Workshop:** **high — and currently unsupported.** Demo leg 3 requires a memory written in a prior session; none exists. **Pilot:** high.

## cap-care-remember — *Remember care-related context you tell me*
- **Domain / level:** pastoral_care / REMEMBER · **Evidence:** `pc-remember-care-memory-attribution-preserved`
- **Runtime path / deps:** identical to `cap-people-remember`; attribution is the `[date, you said]` label
- **Strongest proof:** **INTEGRATION**
- **Weakest seam:** same zero-live-rows seam, plus the manifest's own stated gap — prayer *dates* never reach the prompt, so GRACE cannot qualify staleness even when asked
- **Workshop:** medium. **Pilot:** high (pastoral care is the emotive centre of the product).

## cap-comms-send-email — *Send an email to a member*
- **Domain / level:** communications / ACT · **Evidence:** `com-act-send-audited-positive`
- **Runtime path:** model emits `<action>` → `hydrateAction` → `blockOnAmbiguity` → `handlers.send_email` → `POST /api/agentmail/send` → `sendFresh` + `recordAudit`
- **Authorization dep. (claimed):** `communications.send`
- **Authorization dep. (actual):** `requireClerkAuth({allowedRoles:['admin','pastor','staff']})` — **the endpoint does not read the catalog permission**
- **Strongest proof:** **INTEGRATION**
- **Weakest unproven seam:** **a live contradiction.** The capability block tells a staff member without `communications.send` that their access does not authorize it; the endpoint would send anyway. GRACE's stated boundary is stricter than the enforced one. Also: `audited: true` is honest (audit is inside the route), but the *permission* half of the claim is not.
- **Workshop:** low — must **not** be demonstrated. **Pilot:** **blocker** until reconciled.

## cap-comms-send-sms — *Prepare a text; approval always required*
- **Domain / level:** communications / ACT · **Evidence:** `com-act-send-audited-positive`
- **Runtime path:** `handlers.send_sms` → `POST /api/actions/propose` → `requirePermission('communications.send')` → `agent_actions` + `approvals` → `PATCH /api/approvals` (`approvals.decide` only — NO separation of duty: the proposer may decide their own request) → `executeAgentAction` + audit
- **Strongest proof:** **INTEGRATION** — and this is the **best-constructed path in the entire product**: catalog-driven, server-permissioned, approval-gated, audited, with `/execute` explicitly refusing it.
- **Weakest unproven seam:** it has **never run**. `agent_actions` contains no `send_sms` row; `approvals` holds 4 pending / 2 decided rows, all from the agent door.
- **Workshop:** **high — this is the right vehicle for demo leg 4.** **Pilot:** high.

## cap-gov-permission-model — *Respect your role's access boundaries*
- **Domain / level:** governance / KNOW · **Evidence:** `gov-know-consents-rls-confirmed`
- **Runtime path:** `resolveStaffActor` → `loadPermissionKeys` → `buildCapabilityContext` reflects the real set
- **Strongest proof:** **LIVE DB** for the RLS posture (policies verified in `pg_policy`); **UNIT** for the resolver
- **Weakest unproven seam:** the claim *"what I can do is based on your actual verified access"* is true of the **capability block's wording** and of the four server-routed actions — and false of the nine client-dispatched ones, which no server permission check ever sees.
- **Workshop:** high (it is the honesty story). **Pilot:** high.

## cap-gov-action-routing — *Route actions through the right approval path*
- **Domain / level:** governance / ACT · **Evidence:** `gov-act-central-henderson-tenant-scope-cross-check`
- **Runtime path:** catalog `requiresApproval` → `/execute` refuses gated, `/propose` refuses ungated
- **Strongest proof:** **INTEGRATION**, and it is genuinely mutually exclusive by construction
- **Weakest unproven seam:** the routing decision is made **in the browser** — `handlers.ts` chooses `executeServerSide` vs `proposeForApproval` per action type, hardcoded. The server's refusal is a *backstop*, not the router. And routing covers only 4 of 14 catalog actions.
- **Workshop:** high. **Pilot:** high.

---

## Cross-cutting notes on the manifest as a whole

1. **Every entry declares `proofBoundary: 'mock'`** in the eval manifest.
   Not one PROVEN capability rests on live-DB, live-model, or live-UI
   evidence. The manifest is honest about this; readers of the
   *production* copy (`api/_lib/capability-manifest.ts`) will not see it,
   because that field is not duplicated there.
2. **`runtimeAvailable: true` on all 8 entries is currently false in
   production.** The field exists exactly for this case, and the case has
   arrived: `main` carries none of this code. The manifest describes a
   branch Preview, and says so — but the flag itself does not.
3. **The manifest cannot make an action safe.** It gates nothing; it
   supplies wording. Every one of the four ACT-level entries is enforced
   (or not) somewhere else entirely.
4. **Three PROVEN entries have no live evidence at all** and one
   (`cap-comms-send-email`) has a live contradiction. That is not an
   argument for removing them — the evidence they cite is real — but it is
   the honest statement of what "PROVEN" currently buys.
