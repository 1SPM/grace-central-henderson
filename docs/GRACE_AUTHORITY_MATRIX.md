# GRACE Authority Matrix

**Date:** 2026-08-31 · **Branch:** `feat/ai-work-cards` @ `981d8e8`
Every source that can influence what GRACE says or does, what it is and is
not authoritative for, and who controls it.

Legend — **Ctrl**: C = client-controlled, M = model-controlled, S = server-resolved.
**→ANSWER**: can it change the words GRACE says. **→ACT**: can it change whether
a mutation happens.

---

## 1. The matrix

| # | Source | Authoritative for | NOT authoritative for | Tenant scope | User scope | Provenance | Freshness | Ctrl | →ANSWER | →ACT |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Authenticated actor** (`resolveStaffActor`, `api/_lib/authz.ts`) | identity, `churchId`, `userId`, `accountStatus` | anything about content | from signed JWT `app_metadata.church_id` | self (or `x-grace-view-as` target, gated on caller's `admin.manage_settings`) | Clerk `verifyToken` + `users` row | per request | **S** | indirect | **YES — root of all authorization** |
| 2 | **Permissions** (`loadPermissionKeys`) | what this actor may do server-side | what has been *qualified* | per church | per user | RBAC tables (migration 032) | per request | **S** | via capability block | **YES** (`requirePermission`) |
| 3 | **Client `dataContext`** (`buildDataContext`) | *nothing, by right* — in practice: persona, tone, action instructions, and all live church data in the prompt | authority of any kind | claimed only | claimed only | **none** | unknown to the server | **C** | **YES — first and largest prompt block** | **Indirect** (it is the text that teaches the model the action vocabulary) |
| 4 | **`grace_knowledge`** (ADR-015) | Central Henderson identity / mission / strategy / ownership path; **scope boundaries** | any Henderson-specific $ / attendance / debt figure; any live operational data | `church_id`, RLS SELECT-only, no write path | shared across staff | `source_label` per row; migration-only | static (no versioning / "as-of") | **S** | **YES** | no |
| 5 | **`grace_memories`** (ADR-014) | what *this* staff member told GRACE | any church record; any judgment about a member | `church_id` | `user_id`, never shared | `source ∈ {user_stated, ai_extracted}`, CHECK-constrained, `source_message_id` | `created_at` shown; **no supersede mechanism** | **S** (written server-side; content originates with the user) | **YES (subordinate — prompt-enforced only)** | no |
| 6 | **Conversation history** (`grace_messages`, last 12) | pronoun/referent resolution | facts | `church_id` | `user_id` + conversation | DB rows | per turn | **S** | **YES** | no |
| 7 | **Capability Manifest** (`api/_lib/capability-manifest.ts`) | what has been *qualified*, and the allowed/prohibited claim wording | whether an executor will actually permit it | tenant-gated to `QUALIFIED_CHURCH_ID` | via `actor.permissions` | ADR-017; drift-checked against the eval manifest | hand-maintained; edited with evidence | **S** | **YES** | **no — it gates nothing** |
| 8 | **Action catalog** (`src/lib/actionCatalog.ts`) | the action vocabulary; `permission` / `requiresApproval` / `audited` / `consequence` | whether a given endpoint honours them | global (not per church) | n/a | code + `actionCatalogBinding.test.ts` | per deploy | **S** | via the prompt text it generates | **YES** for `/api/actions/execute` and `/propose`; **NO** for the 9 client-dispatched actions and for `send_email` |
| 9 | **Epistemic resolver** (`api/_lib/grace-epistemic.ts`) | *by design*: whether ACT is reachable. *In practice*: the contract text + the name-collision list | anything, at runtime — `resolveActionReadiness` is never called | collisions are church-scoped (server query) | n/a | code | roster read per turn | **S** | **YES (as instructions)** | **NO** |
| 10 | **Model output** (Claude Haiku 4.5) | phrasing; which action blocks to emit; every semantic judgment | facts, capability status, permission, tenant | inherits the prompt's | inherits | none | n/a | **M** | **YES** | **YES — it selects the action and its target** |
| 11 | **Client roster** (`data.people/tasks/prayers` in `hydrateAction`) | which record an action resolves to; whether it is ambiguous | nothing server-side | client-loaded | client-loaded | none | as stale as the tab | **C** | no | **YES — this is what actually blocks or permits an action** |
| 12 | **Approvals** (`PATCH /api/approvals`) | final go/no-go on gated actions | which actions are gated (catalog decides) | per church | `approvals.decide` + requester ≠ approver for favourable decisions (C-13 closed 2026-09-04) | `approvals` + `audit_logs` | per decision | **S** | no | **YES** |
| 13 | **RLS** (migrations 062/075/076 et al.) | row visibility for browser-client reads | anything reached with the service-role key | `get_church_id()` | `get_app_user_id()` | Postgres policies | live | **S** | bounds source 3 | **YES** for browser-client writes |
| 14 | **`RedesignAskGrace` localStorage memory** (`grace-ai-memory-v1`) | nothing | everything | **none** | **none** (per-browser) | **none** — model-written summary of prior chats | unbounded | **C+M** | **YES on `#/redesign`** | indirect |
| 15 | **`getDemoCommunityDataForCRM()`** | nothing | group activity stats it currently supplies | **zero-arg — structurally cannot vary by church** | n/a | hardcoded demo fixture | static | **C** | **YES (in production)** | no |

---

## 2. Duplicated / competing authority — every case

**A. Two sources claim "what GRACE can do."**
`ACTION_CATALOG` (source 8) and `PILOT_CAPABILITY_MANIFEST` (source 7)
both describe capability, with different granularity and different
truth conditions. `grace-capability.test.ts` cross-checks the manifest
against the *eval* manifest, not against the catalog. Where they
disagree, the catalog governs execution and the manifest governs speech.
→ see Contradiction Register **C-03**.

**B. Two sources claim "what the church's data says."**
`dataContext` (source 3, client) and `grace_knowledge` (source 4,
server) both describe the church. Precedence is asserted in prose
("live data outranks static knowledge") and enforced nowhere — both are
plain text in one prompt, and the client-composed one is *first*.
→ **C-01**.

**C. Two sources claim "who is ambiguous."**
`detectNameCollisions` (source 9, server, full roster) produces the
prompt's collision list. `countPersonMatches` (source 11, client,
loaded roster) produces the signal that actually blocks execution. They
read different data and only the weaker one enforces. If the client
roster is partial or stale, the server can warn about a collision the
client will not block on. → **C-05**.

**D. Two sources claim "who may send an email."**
Catalog + manifest say `communications.send`. `api/agentmail/_send.ts`
and `_reply.ts` check `allowedRoles: ['admin','pastor','staff']`. The
executor is strictly more permissive than the boundary GRACE describes.
→ **C-04**.

**E. Two sources claim "what GRACE remembers."**
`grace_memories` (source 5) on `#/grace`; `localStorage['grace-ai-memory-v1']`
(source 14) on `#/redesign`. The second has none of ADR-014's scoping,
provenance, or subordination guarantees, and is exactly the mechanism
ADR-014 states it retired. → **C-06**.

**F. Two sources claim "attendance."**
The capability block states attendance is `unavailable` — *"I don't
currently have a qualified way to answer attendance questions."*
`buildDataContext` supplies `Check-ins last 30d: N` and a named
`Inactive members/regulars:` list in the same prompt. → **C-02**.

---

## 3. The real authority hierarchy (as implemented)

```
1. Clerk-signed JWT  →  churchId, userId          (unforgeable)
2. RBAC permission set                            (server-loaded)
3. Server endpoints: requirePermission / approvals.decide / RLS
        ── everything above this line is structurally enforced ──
4. Action catalog                                 (enforced only where an endpoint reads it)
5. Client hydrateAction + blockOnAmbiguity        (enforced, but in the browser)
        ── everything below this line is text in a prompt ──
6. Capability block · Epistemic block             (server-composed, model-honoured)
7. grace_knowledge · grace_memories · history
8. Client dataContext — persona, tone, action instructions, church data
9. Model judgment
```

Note the inversion: **the least trustworthy source (8) occupies the most
privileged position in the prompt**, and the two layers built to
constrain the model (6) sit below the knowledge and memory they are meant
to govern, with no enforcement of their own.
