# GRACE Intelligence Stack Map

**Date:** 2026-08-31 · **Branch audited:** `feat/ai-work-cards` @ `981d8e8`
**Scope:** staff Ask GRACE (`api/grace/_chat.ts` + `src/contexts/GraceChatContext.tsx`) and every layer it composes.
**Status:** audit artifact. No code was changed to produce it.

> **Read this first.** The conceptual flow in the checkpoint brief
> (Actor → Tenant → Capability → Evidence → Epistemics → Model → Action →
> Authorization → Execution → Audit) is **not** the implemented flow. The
> real flow forks: authority is server-resolved, but *prompt composition
> starts on the client*, and *action resolution ends on the client*. The
> server owns the middle, not the ends.

---

## 1. The actual request path

```
BROWSER (src/contexts/GraceChatContext.tsx)
 │
 ├─ buildDataContext(data, voiceMode)          ← composes the ENTIRE system prompt:
 │    ├─ buildAdminPersonaHeader(...)             persona, tone rules, financial vocabulary
 │    ├─ TONE EXAMPLES + "ACTIONS —" instructions
 │    ├─ buildChatActionPrompt()                  the action catalog, rendered as prompt text
 │    └─ church data lines (people/giving/attendance/events/tasks/groups/prayers)
 │  + useGraceOpsAggregates(churchId) → opsContext appended
 │
 └─ POST /api/grace/chat { message, conversationId, dataContext }   ← dataContext is a free-text
                                                                      string field, max 40 000 chars
▼
SERVER (api/grace/_chat.ts)
 │
 1. resolveStaffActor(req,res,supabase)                     api/_lib/authz.ts
 │    ├─ isDemoModeActive(req) && !hasBearerToken → demo actor (DEMO_HOSTS only)
 │    └─ requireClerkAuth → verifyToken → churchId from app_metadata.church_id (SIGNED)
 │       → users row lookup (clerk_id + church_id) → account_status → loadPermissionKeys
 │       → optional x-grace-view-as (requires caller's own admin.manage_settings)
 │    ⇒ StaffActor { userId, clerkUserId, churchId, role, permissions:Set, personId }
 │
 2. enforceRateLimit(res, `grace:chat:${actor.userId}`, 30/60s)
 3. readBody(req,res,SCHEMA)                                 api/_lib/validation.ts
 4. getOrCreateConversation(churchId, userId, ...)           grace_conversations
 5. insert user message                                      grace_messages
 │
 6. parseRememberDirective(message)  ── HIT ──▶ saveMemory(source:'user_stated')
 │      (deterministic, no model call)         ─▶ insert assistant reply ─▶ 200, RETURN
 │  MISS
 │  ▼
 7. retrieveChurchKnowledge(supabase,{churchId,query})       grace_knowledge  (RLS SELECT-only)
 │    → always-include category='scope_boundary' + tsquery OR-match, cap 12
 │    → buildKnowledgeBlock(rows)   [+ static GUARDRAIL_FOOTER]
 │
 8. retrieveMemories(supabase,{churchId,userId,query})       grace_memories   (RLS SELECT-only)
 │    → recency(8) ∪ full-text(8) ∪ person_ids overlap(8), dedup, last 15 oldest→newest
 │    → buildMemoryBlock(rows)
 │
 9. history ← last 12 grace_messages for this conversation (church+user filtered)
 │
10. buildCapabilityContext(actor)                            api/_lib/grace-capability.ts
 │    → tenant gate: actor.churchId !== QUALIFIED_CHURCH_ID ⇒ generic "no evidence" block
 │    → per manifest entry: resolveDataCapability(...) ⇒ qualified / approval_required /
 │      permission_required, + KNOWN_CAPABILITY_GAPS + PROHIBITED_CAPABILITIES
 │
11. fetchPeopleForCollisionCheck(supabase, churchId)         SELECT id,first,last FROM people
 │    → detectNameCollisions(...)  → buildEpistemicContext(collisions)
 │       api/_lib/grace-epistemic.ts  (prompt text only — see §3)
 │
12. prompt = [dataContext, knowledgeBlock, memoryBlock, capabilityBlock, epistemicBlock,
 │            history?, "User question: …"].filter(Boolean).join("\n\n")
 │
13. generateStreamed({supabase,churchId,feature:'ask-grace',provider:'claude',model,actorClerkId},
 │                   onChunk → res.write, callClaudeStream({prompt, maxTokens:1200}))
 │    api/_lib/ai/gateway.ts →  checkBudget ✔   moderation ✘ (not requested)   recordUsage ✔
 │
14. res.end()  ← the user already has the answer
15. insert assistant message (error → console.error + security_events 'grace_chat.message_write_failed')
16. update grace_conversations.last_message_at
17. await runExtraction(...) → second Claude call → 0-3 facts → saveMemory(source:'ai_extracted')
▼
BROWSER — action resolution (this is where "Act" actually happens)
 │
18. parseActions(streamedText)                               src/lib/grace-actions.ts
 │    → /<action>([\s\S]*?)<\/action>/g → JSON.parse → validateAction (type ∈ catalog 'chat')
 │
19. hydrateAction(a, {people, tasks, prayers})               ← CLIENT roster, not the server's
 │    → countPersonMatches / countTaskMatches / countPrayerMatches
 │    → personAmbiguous/taskAmbiguous/prayerAmbiguous; ids deliberately LEFT UNSET when ambiguous
 │
20. user clicks Execute → runActionHandler(...)              src/lib/grace-chat/handlers.ts
 │    ├─ blockOnAmbiguity(action, push)  ← FIRST, before approval routing (Prompt 10A closure)
 │    ├─ required-field checks
 │    └─ dispatch, by action type:
 │         • add_person / add_task / add_prayer / add_note / add_event /
 │           mark_task_done / update_task / update_person_status / mark_prayer_answered
 │             → React callbacks → browser Supabase client (RLS-scoped)
 │             → NO server permission check · NO catalog check · NO audit_logs row
 │         • delete_task / delete_prayer
 │             → POST /api/actions/execute  → findAction → refuse if requiresApproval
 │                → requirePermission(definition.permission) → executeAgentAction
 │                → emitPlatformEvent → recordAudit (audit_incomplete surfaced to user)
 │         • delete_person / send_sms
 │             → POST /api/actions/propose → requirePermission → agent_actions + approvals
 │                → decided later in PATCH /api/approvals by an approvals.decide holder
 │                → executeAgentAction + audit (self-approval refused, 403 — C-13 closed)
 │         • send_email
 │             → POST /api/agentmail/send  (or /reply)
 │             → requireClerkAuth({allowedRoles:['admin','pastor','staff']})   ← NOT the catalog
 │                permission · recordAudit inside the route
```

---

## 2. Where the real flow diverges from the conceptual flow

| Conceptual step | Reality |
|---|---|
| Capability boundary sits *before* evidence retrieval | It sits *after* — `buildCapabilityContext` is block #4 of 5, composed after knowledge and memory, and it gates **nothing**; it is prompt text. |
| Epistemic decision precedes model reasoning | There is no epistemic *decision* at runtime. `buildEpistemicContext` emits a contract for the model to follow. `resolveActionReadiness` — ADR-018's "single function that decides whether ACT is reachable at all" — has **zero production call sites** (§3). |
| Model → Action Resolution → Authorization → Execution | Model → **browser** parse/hydrate/ambiguity-block → *then* server authorization, and only for 4 of 14 action types. The other 10 never reach a server catalog check. |
| Audit follows execution | True for `delete_task`/`delete_prayer`/`delete_person`/`send_sms`/`send_email`. False for the 9 create/update actions (catalog honestly records `audited: false`). |
| One prompt composed server-side | The first and largest prompt block — persona, tone, action instructions, church data — is composed in the browser and accepted verbatim (TD-062). |

---

## 3. Runtime-live vs. architecturally-present

Verified by exhaustive call-site search across `api/`, `src/`, `tools/`.

| Symbol | Production call sites | Status |
|---|---|---|
| `buildCapabilityContext` | `api/grace/_chat.ts` | **LIVE** (prompt text) |
| `resolveDataCapability` | inside `buildCapabilityContext` | **LIVE** (prompt text) |
| `buildEpistemicContext` | `api/grace/_chat.ts` | **LIVE** (prompt text) |
| `fetchPeopleForCollisionCheck` / `detectNameCollisions` | `api/grace/_chat.ts` | **LIVE** (prompt text) |
| `resolveActionReadiness` | **none** | tests + eval-harness only |
| `resolveActionCapability` | only via `resolveActionReadiness` | **DEAD at runtime** |
| `resolvePrecedence` | **none** | tests + eval-harness only |
| `modeForEvidenceState` | **none** | tests only |
| `safeExplanationFor` | **none** | tests only |
| `isCapabilityMetaQuestion` | **none** (ADR-017 says it adds a prompt emphasis line — it does not) | tests only |
| `hydrateAction` / `blockOnAmbiguity` | `GraceChatContext.tsx` / `handlers.ts` | **LIVE** (structural) |

**Consequence.** The Capability layer and the Epistemic layer are *context
producers*, not *decision enforcers*. The only structurally enforced
intelligence-layer control in the whole stack is the Prompt 10A ambiguity
block — and it runs in the browser, against the browser's roster.

---

## 4. The second, unmapped Ask GRACE

`src/components/redesign/RedesignAskGrace.tsx`, mounted at `#/redesign`
(`View 'home'`, `src/App.tsx:601`, real church-scoped data per `App.tsx:239`).
An authenticated staff member can reach it by URL. It is a **complete
parallel stack** that predates and bypasses ADR-014 → ADR-018:

| Layer | `#/grace` (audited stack) | `#/redesign` (RedesignAskGrace) |
|---|---|---|
| Transport | `POST /api/grace/chat` | `POST /api/ai/generate` |
| Gateway | budget + usage (no moderation) | budget only |
| Memory | `grace_memories`, church+user scoped, provenance, RLS | `localStorage['grace-ai-memory-v1']` — an AI-written rolling summary, per-browser, no church/user scope, no provenance |
| Church knowledge | `grace_knowledge` + scope boundaries | none |
| Capability block | yes | none |
| Epistemic block | yes | none |
| Action vocabulary | `ACTION_CATALOG` (14 types) | its own: `add_event`, `log_interaction`, `add_prayer`, `check_in` — `log_interaction`/`check_in` **are not in the catalog at all** |
| Action parser | `src/lib/grace-actions.ts` | its own `parseActions` (XML attributes, not JSON) |
| Ambiguity | `countPersonMatches` + `blockOnAmbiguity` | `resolvePerson` — **silent first-match-wins**, no ambiguity signal |
| Private prayers | handler hardcodes `isPrivate:false` | honours `private="true"` |

`src/lib/actionCatalog.ts`'s header claims "Every surface — the chat
assistant, the agents, and any future command palette — reads its
vocabulary from here rather than declaring its own." That claim is false
for this surface.

---

## 5. Deployment reality

Verified with `git cat-file` against `main`:

| Artifact | on `main` | on `feat/ai-work-cards` |
|---|---|---|
| `api/grace/_chat.ts` (+ route entry `'grace/chat'`) | ✘ | ✔ |
| `api/_lib/grace-memory.ts` / `-knowledge` / `-capability` / `-epistemic` | ✘ | ✔ |
| `api/_lib/capability-manifest.ts` | ✘ | ✔ |
| `src/lib/actionCatalog.ts` (catalog source of truth) | ✘ | ✔ |
| migrations `075_grace_memory.sql`, `076_grace_knowledge.sql` | ✘ | ✔ |

**The entire ADR-014 → ADR-018 intelligence stack exists only on a feature
branch.** `main` — and therefore production — has no Ask GRACE turn
endpoint, no memory, no church knowledge, no capability layer, no epistemic
layer. Migrations 075/076 *are* applied to the single live Supabase
project (`grace_knowledge` holds 10 Central Henderson rows), so the
database is ahead of `main` while the code is behind the branch.
