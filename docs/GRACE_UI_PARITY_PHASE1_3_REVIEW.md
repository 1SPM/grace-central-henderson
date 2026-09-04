# Review — `navigation.ts` and `api/grace/_entity-memory.ts`

**Date:** 2026-09-01 · **Status:** pre-landing review of uncommitted work
**Verdict:** **do not land `_entity-memory.ts` as written** (one HIGH finding).
`navigation.ts` is close — two changes and it's fine.

Reviewed against the action catalog, the capability manifest, the epistemic
contract, and the live Central Henderson schema and RBAC tables.

---

## `src/lib/grace-chat/navigation.ts`

### What is right
- Recognizes **only imperative** navigation (`open|show|go to|take me to|navigate to`)
  and deliberately refuses questions — `"What is Impact Card Accounts?"` returns
  null. That is the correct instinct and its own test covers it.
- Resolves against a closed `View` union, so an arbitrary route string cannot be
  injected. This satisfies the brief's "reject arbitrary client-provided URLs"
  by construction.
- Runs before the model call, so "Open X" works even when the AI service is
  down, and the reply can never *describe* navigation that didn't happen.

### N-1 · Bypassed the route guard the palette respects — **CORRECTED, then FIXED**

**My first pass said there was no client-side view gating. That was wrong.**
`src/hooks/useRouteGuard.ts` exists and `GlobalSearch.tsx:113` filters the
palette through it: `NAV_ITEMS.filter(item => canAccess(item.view))`. It is
coarse (a `SETTINGS_VIEWS` set behind `canManageSettings`, a `STAFF_VIEWS` set
behind admin/staff/pastor) and its own comment calls it a UX convenience with
real authorization server-side — but it is real, and the palette honours it.

`resolveWorkspaceNavigation` did not consult it. So a Volunteer saying
*"Open Settings"* would be navigated there by GRACE, to a destination the Cmd+K
palette deliberately does not offer them. Not a data breach — server-side RLS and
`requirePermission` still bound everything inside — but it is the parity promise
running backwards: the chat door doing what the UI control refuses.

**Fixed.** `resolveWorkspaceNavigation(query, canAccess)` now takes the guard,
and `GraceChatProvider` passes `useRouteGuard().canAccess`. An unauthorized
target resolves to `null` and falls through to the model, which answers under
the capability boundary instead of silently moving the user.

### N-2 · Duplicates the catalog rather than extending it — MEDIUM
`WORKSPACE_ROUTES` is a third registry of workspace names, after
`GlobalSearch.NAV_ITEMS` (12 labels, already user-facing) and `VIEW_TO_PATH`.
It will drift. `actionCatalog.ts`'s own header says every surface reads its
vocabulary from the catalog; this doesn't.
**Recommend:** either derive `WORKSPACE_ROUTES` from `NAV_ITEMS`, or add a
`navigate` group to `ACTION_CATALOG` (`consequence: 'low'`,
`requiresApproval: false`, `audited: false`) so it flows through the existing
parse → hydrate → handler path and is covered by `actionCatalogBinding.test.ts`.

### N-3 · Reports success it hasn't verified — LOW
`Opened ${label}.` is written immediately after `data.onNavigate(view)` with no
confirmation the view rendered. If `onNavigate` is undefined the branch is
skipped entirely and the query silently falls through to the model — which will
then answer *about* the workspace, reproducing the original complaint.
**Recommend:** when `navigation` resolves but `data.onNavigate` is missing, say
so rather than falling through.

### N-4 · `&` normalization — FIXED
`Show Growth & Engagement` returned null: the sidebar spells it `&`, the alias
table spells it `and`. Their own test caught it. One-line normalization applied
(`.replace(/&/g, 'and')`); test passes.

---

## `api/grace/_entity-memory.ts`

### What is right
This is better engineered than its client counterpart:
- `resolveStaffActor` — server-resolved actor and tenant, never client-supplied.
- Roster query is `church_id`-scoped.
- **Deterministic reply, no model call** — it cannot fabricate. Given R-17 and
  the calendar finding, that is the right call for profile data.
- Households are *separately* gated and **not queried at all** without
  `households.view` — genuinely good discipline, not just filtered after the fact.
- Care, prayer, giving and KYC tables are never touched.
- Both PostgREST embeds (`small_groups`, `people`) resolve without error against
  the live schema — verified, no silent-empty bug.

### E-1 · `tags` disclose donor status under a coarse permission — **HIGH**
The response ends with:

> *"This summary excludes private pastoral, health, financial, and prayer details."*

It emits `- Tags: …` gated only on `people.view`. Live Central Henderson tags
include **`major-donor`**, plus `homebound`, `single-parent`, `senior`.

`people.view` is held by **11 roles** — including Analyst, Communications,
Volunteer Coordinator and Ministry Leader. Giving is gated separately by
`giving_financial.view` precisely because it is confidential. So a Volunteer
Coordinator asking *"what do you remember about X"* learns X is a major donor,
from a response that explicitly promises it excludes financial details.

Amounts are not disclosed — classification is. For a church that is the
sensitive part, and the false assurance makes it worse than silence.

This is the concrete instance of the gap flagged in the Phase 0 audit §5:
`permissions.sensitivity` is seeded but read by no runtime path, and ministry
scope is not an enforcement dimension. A free-form tag array crosses every role
boundary under one coarse key.

**Fix before landing.** Cheapest correct option: drop `tags` from the summary.
If tags are wanted, they need an allowlist or a sensitivity classification —
which is a discovery decision, not an implementation detail.

### E-2 · Tasks gated on the wrong permission — MEDIUM
```ts
actor.permissions.has('work_orders.view') ? supabase.from('tasks')… : []
```
Measured against the live RBAC tables:

| permission | roles holding it |
|---|---|
| `tasks.view` | **9** — Analyst, Auditor, Executive Leadership, Member Services, Ministry Leader, Pastoral Care, Senior Pastor, System Administrator, Volunteer Coordinator |
| `work_orders.view` | **2** — Senior Pastor, System Administrator |

Seven roles that *are* authorized to see tasks silently get none — while the
reply still says *"Here is the current, authorized record."* It **fails closed**,
so this is a correctness and truthfulness bug rather than a disclosure one, but
the summary claims a completeness it doesn't have. Same class as the `send_email`
catalog/endpoint mismatch (C-04). **Use `tasks.view`.**

### E-3 · The ambiguity branch is almost unreachable — MEDIUM
`exactMatches` requires a full-name match, so `matches.length > 1` fires only for
two people with *identical* full names. The common case — a bare first name —
yields **zero** matches and returns:

> *"I couldn't find a current record for Sarah."*

Central Henderson has **two Sarahs** (and 9 colliding first names). That is a
false negative, and it contradicts both the shipped `blockOnAmbiguity` behavior
(*"Which Sarah — Sarah Mitchell or Sarah Chen?"*, live-proven) and the epistemic
contract's `AMBIGUOUS → ASK` rule. The brief's own acceptance row says
*"never guesses"* — but "not found" is not the same as asking.
**Recommend:** reuse `countPersonMatches`/`detectNameCollisions` rather than a
second matching implementation, and return `ambiguous` for first-name hits.

### E-4 · Contradicts the capability manifest — **FIXED (capability withdrawn)**
`api/_lib/capability-manifest.ts` declares:
- `cap-household` — `unavailable`: *"I can see individual people, but I don't
  currently have household/family groupings available."*
- `cap-people-remember` — *"I don't currently have access to household/family
  groupings — only individual person records."*

The route returned household relationships. That block is injected into
**every** Ask GRACE prompt, so a user could be told "I don't have households"
in one turn and shown household members in the next.

**Resolved by withdrawing the capability, not by promoting the manifest.**
ADR-017 is explicit that adding a manifest entry "is EXACTLY as consequential as
a Capability Baseline change — do it only alongside real qualification evidence,
never speculatively", and the live tenant has **0 household rows**, so the
capability cannot be qualified against real data at all. A mock-only fixture
would have reproduced the `proofBoundary: 'mock'` weakness the architecture
checkpoint criticised. Removing it costs nothing today.

The route now carries the `households.view`-gated query commented out with an
explicit re-entry condition: import household data → add a fixture covering
authorized retrieval, `households.view` denial and cross-tenant denial → promote
`cap-household` in **both** manifests → restore the block. A test asserts the
reply never mentions a household in the meantime.

### E-5 · Turn escapes the governed chat path — **FIXED (history restored; metering deliberately not added)**
The client short-circuits before `sendGraceTurn`, so this turn:
- is **not persisted** to `grace_messages` — it vanishes from history and from
  the next turn's context, so a follow-up ("what about her household?") has no
  referent;
- never reaches `api/_lib/ai/gateway.ts` — no budget accounting, no usage row;
- never sees the capability or epistemic blocks (E-4 follows from this).

**Fixed.** `getOrCreateConversation` moved out of `api/grace/_chat.ts` into a
shared `api/_lib/grace-conversation.ts` (one implementation — the
`church_id AND user_id` ownership check is exactly the thing that must never
drift between callers), joined by `persistTurn`. The entity-memory route now
takes the client's `conversationId` and writes **both sides** of the turn —
including the `not_found` and `ambiguous` replies, so a follow-up has a
referent either way — and returns `X-Conversation-Id` so the client keeps the
thread. Persistence never blocks the answer; a failed write is logged, matching
`_chat.ts`'s TD-065 loud-but-not-fatal precedent.

**Metering deliberately not added.** There is no model call on this path, so a
`token_usage` row would record cost that was never incurred. The capability and
epistemic blocks likewise remain absent by design: the reply is deterministic
and cannot fabricate, which is the stronger guarantee. E-4 is what actually
followed from their absence, and it is closed above.

### E-6 · No rate limit, no audit — **FIXED**
**Fixed, three parts.** Rate limit 20/60s per user (same `enforceRateLimit`
shape as `_chat.ts`). Access logged to `security_events` as
`grace.person_record_viewed` (severity `info`) with the person id and never the
summary — `security_events` rather than `audit_logs` deliberately, matching the
`authz.view_as` precedent, because `audit_logs` is the mutation trail and filing
reads there would dilute the "who changed what" query. And the roster query is
now a candidate filter that is a strict superset of all three `countPersonMatches`
tiers, verified against the live tenant (61 rows) rather than asserted in a
mock — including the cross-field substring case (`"rah Mit"` → Sarah Mitchell).

### E-7 · Client intent detection doesn't cover the brief's own gap — **FIXED**
**Fixed, and gap #4 is now closed.** The matcher covers "brief me on", "tell me
about", "catch me up on", "who is", "what do you know about" and
"the background/context/history on", and strips honorifics including stacked
ones (*"Pastor Dr. James Wilson"* → *"James Wilson"*).

The risk in broadening a client-side matcher — *"Tell me about our giving this
month"* being captured and answered *"I couldn't find a current record for our
giving this month"* — is closed **structurally, not by tightening the regex**:
a `not_found` result no longer short-circuits. The route returns the status
without persisting anything and the client continues to the model. A false
positive costs one indexed query returning zero rows, never a worse answer.

---

## Landing recommendation

| | |
|---|---|
| `navigation.ts` | **Land after N-2** (derive from one registry) — N-3 optional, N-4 done. |
| `_entity-memory.ts` | **Cleared.** E-1 through E-7 are all closed. |

E-1 was the only finding that disclosed anything. Everything else was
correctness, coherence, or auditability.

**All seven closed** across `24b5081` (E-1..E-5) and `7bccee6` (E-6, E-7).
One limitation worth carrying forward: the route's tests run against a mocked
Supabase whose `.or()`/`.ilike()` are no-ops, so they prove the route's logic
and nothing about the PostgREST filter or RLS. The filter was therefore checked
against the live database directly.
