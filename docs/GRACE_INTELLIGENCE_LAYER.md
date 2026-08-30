# GRACE — Intelligence Layer

**Status:** Architecture north star (positioning). Not a claim that the live product already works this way.
**Audience:** Sean, product/engineering, CEO-deck and strategy-page use.
**Companion visual:** [`/grace-intelligence.html`](../public/grace-intelligence.html)

---

## 1. Objective

GRACE is the **governed** operational intelligence of the church.

> "Governed," not "trained." GRACE is not fine-tuned on congregant data — the
> mechanism is per-tenant configuration, retrieval, and permission-scoped
> access. Saying "trained" invites the one question with a bad answer
> ("trained on what — our congregants?"), and the real mechanism is the
> stronger story. See the Data Covenant and issue #22.

The CRM, member portal, wallets, agents, APIs, virtual campus, and infrastructure are not the product center. They are the governed operating environment GRACE observes, understands, and — with human approval where required — acts through.

**Central message**

> GRACE — the intelligence layer that understands, oversees, and orchestrates the church’s digital operations.

Four simultaneous capabilities — three describe what it can do, the fourth is why that is safe to allow:

- **Sees** — data, member activity, workflows, authorized financial metrics, programs, communications, permissions, infrastructure, and system state.
- **Understands** — this church’s structure, people, policies, objectives, institutional knowledge, permissions, and operating context.
- **Acts** — through approved tools and specialized agents. Consequential
  actions stop at a named human. One honest exception: a small set of opt-in
  scheduled emails (birthday/anniversary greetings, a new-member drip, giving
  thank-yous) send without a human in the loop once a church enables them
  (`api/cron/_agents.ts` → `api/cron/_send-pending-emails.ts`), including a
  five-message new-member drip. A nightly pass also creates staff follow-up
  tasks and logs contacts (`api/_lib/agents/runner.ts`). Outbound SMS *to
  members* is always human-initiated; the one automated SMS is the crisis alert
  to on-call staff (`crisisNotify.ts`), which is deliberate.
- **Shows its work** — answers are scoped to the asker's authority,
  consequential actions stop at a named human, and every action lands on an
  append-only audit trail (`audit_logs`, `platform_events`, `security_events`,
  all trigger-enforced). Three verbs are a capability claim; this fourth one is
  the trust claim, and it is the verb GRACE has most fully built.

**Boundary that belongs in the pitch, not the footnotes — stated precisely,
because the loose version is false.** GRACE *does* measure engagement and *does*
rank: `api/_lib/healthMetrics.ts` computes a per-member 0–100
`computeEngagementScore()` and a sorted, named `computeAtRiskMembers()` list,
and `GraceChatContext.tsx` feeds the staff assistant a ranked top-10 donor list
plus up to 15 named members who have not attended in 30 days. That is the
operational job a church is buying, and the page should say so plainly rather
than claim a restraint the code does not have.

The real line is **spiritual judgement**, and on that side the enforcement is
genuine: `docs/AI_BOUNDARIES.md` forbids diagnosis, claims of spiritual
authority, and inferred spiritual state ("this member seems distant"); the
crisis gate is a deterministic regex running *before* any model call
(`careSafety.ts`) with fixed pre-approved copy; the member assistant's system
prompt is server-composed and never merges client text (the staff assistant
composes its context in the browser, under RLS); and its 14 tools are narrow and
member-scoped. `healthMetrics.ts` carries its own caveat — "never spiritual
standing" — surfaced in the UI.

**Gap worth closing:** `AI_BOUNDARIES.md` governs the assistants but does not
mention `healthMetrics.ts` at all, so the engagement score's only guardrail is a
disclaimer string. The policy should name it.

People meet that same intelligence through three interfaces:

1. **CRM Workspace** — conventional staff and operational interface
2. **Virtual Campus** — visual spatial view of the church’s operating environment (a lens over the CRM, not a digital twin: no facilities or occupancy data sits behind it)
3. **Ask GRACE** — natural-language command and orchestration interface

These are not three products. They are three doors into one brain.

---

## 2. Decision

This document is the **architecture north star**.

- [PRODUCT_VISION.md](../PRODUCT_VISION.md) remains true: pastoral care, leader avatars, and “never lose a soul” are a governed capability GRACE understands and routes — not the product center, and not retired.
- [AGENTS.md](../AGENTS.md) locked beta decisions still hold: i2C sandbox, Impact Card in demo/simulated mode, member portal as role-gated routes in this repo, pilot readiness over speculative expansion.
- This pass ships **positioning only** (this doc + the flagship visual). It does not rebuild CRM information architecture, default home, or Ask Grace behavior.

---

## 3. Current status

GRACE today is a staff CRM with AI and WorkOS bolted on. The three interfaces exist as disconnected features. There is no shared GRACE brain.

| Surface | Today |
|---|---|
| **CRM Workspace** | Live. Default staff home `#/dashboard`. This is the real product. |
| **Ask GRACE (staff)** | Live floating dock. Gemini chat. CRM write-actions wait for human Execute. Does **not** invoke WorkOS agents or the Decision Queue. |
| **Ask GRACE (member)** | Separate portal assistant with its own tool runtime. |
| **Ask GRACE (static previews)** | Separate HTML companion. Not the same backend. |
| **Virtual Campus** | Thin 2D campus map. Deep-links into existing CRM/WorkOS rooms. Mounted as a WorkOS tab and inside Ask Grace. Does not invent capabilities. |
| **Specialized agents** | 16 registered; 5 implemented (Cadence, Shepherd, Steward, Sentinel, Verity). Implemented agents are scanners, not LLM orchestrators. The scanner formerly displayed as “Grace” is now **Cadence** — see section 8. |
| **Governance** | Decision Queue, Approval Centre, audit timeline, and RBAC exist on WorkOS routes. Ask GRACE does not route through them. Legacy CRM routes are still on older auth. |
| **Member portal** | Split: React `/portal` plus static HTML still used as demo URLs. |
| **Impact Card** | Demo / simulated. Mock i2C adapter. Locked for beta. |
| **Hardware / VWS / VR** | Long-term. Must not distract from pilot. |

---

## 4. Sees / Understands / Acts — now vs missing

### Sees

**Now.** Staff CRM reads people, tasks, care, giving summaries, mail, attendance, Work Orders, Decision Queue counts, campus room bindings. Member portal reads the member’s own account. Campus map is a spatial lens over that same state.

**Missing.** One observation layer. Admin chat, member assistant, and agents do not share a system-state model. Authorized financial metrics are partial (Impact Card is simulated). Infrastructure and system health are not a first-class GRACE view.

### Understands

**Now.** Tenant config, church settings, RBAC roles, ministry areas, and Ask Grace system prompts carry some church-specific context. Campus bindings encode “this room maps to this GRACE surface.”

**Missing.** One church context object — structure, people, policies, objectives, institutional knowledge, permissions — shared by every interface. Three assistant stacks means three partial understandings.

### Acts

**Now.** Ask GRACE can propose CRM writes (task, person, prayer, email/SMS) and wait for Execute. WorkOS agents record findings. Humans decide in the Decision Queue and Approval Centre. Implemented agents do not auto-mutate.

**Missing.** Ask GRACE does not orchestrate agents or approvals. Acting is split across chat Execute, WorkOS scanners, and staff clicks. That is the gap that most prevents “one intelligence.”

---

## 5. Three interfaces, one intelligence

| Interface | Today | Target |
|---|---|---|
| CRM Workspace | The product. Sidebar modules. | Conventional operational surface onto the same intelligence. |
| Virtual Campus | WorkOS tab + Ask Grace window. Navigational map. | First-class spatial view of the same state. Not a second system of record. |
| Ask GRACE | Three stacks. Staff chat does not drive WorkOS. | Natural-language command surface that proposes; governance executes. |

Target: shared church context + shared action bus. Chat, campus, and workspace read and write the same operational intelligence.

---

## 6. Outer ring — live / partial / later

The perimeter is GRACE’s governed operating environment and roadmap. Not a claim that every node is live.

| Capability | Status |
|---|---|
| CRM and staff workspace | **Live** |
| Member portal and member accounts | **Partial** — React portal live; static HTML still the demo path |
| Communications | **Live** (staff mail, announcements). Herald agent not implemented |
| Databases and APIs | **Live** |
| Cloud infrastructure | **Live** (Vercel + Supabase). No self-hosted/local inference exists — "Hermes" in `aiProviders.ts` is an unset remote OpenAI-compatible URL, not a local model. Owned hardware is committed direction, not operating infrastructure |
| Specialized agents | **Partial** — one label over two different things: 5 of 16 registry agents are implemented as human-triggered, read-only scanners, *and* 6 separate cron agents (`api/_lib/agents/`) mutate real `tasks`/`interactions` nightly. They have no registry card of their own, though their findings do surface in the Agents tab |
| Church hierarchy, programs, and workflows | **Partial** — Work Orders, tasks, ministry areas; ministry-scoped RBAC modeled, not fully enforced |
| Virtual campus | **Partial** — real 2D canvas with real bindings and real agent statuses, but a spatial lens over the CRM, not a twin: no sensor, occupancy, booking, or facilities data sits behind any room — `CampusRoom` in `campus/campusMap.ts` has no capacity, schedule, or occupancy field. It does bind live Decision Queue counts, open Work Order counts, the ministry's next calendar event, and the accountable human |
| Impact Card and wallet | **Later for live rails** — demo/simulated for beta. All 8 methods of `i2c/live-adapter.ts` throw; production runs the mock. Needs a card agreement before it is real, which the UI should say and currently does not (it says "sandbox") |
| Future physical systems and hardware | **Later** |

---

## 7. Path to the vision

Pilot readiness still wins. Execution stays separate from the picture.

1. **Positioning (this pass).** Visual + this doc. Product IA unchanged.
2. **Unify “acts” (next product slice).** Ask GRACE proposes; Decision Queue / approvals execute; WorkOS agents become tools GRACE can invoke, not a parallel brain. Smallest move that makes the triad true.
3. **Unify “understands”.** One church context object shared by admin chat, member assistant, and agents. Retire the three-stack split over time.
4. **Elevate the Virtual Campus.** Keep it a spatial lens over the same state. Promote it from a WorkOS tab to a first-class interface only after (2).
5. **Do not do now.** VR/VWS, physical hardware, live i2C issuance, rewriting PRODUCT_VISION.md as if pastoral care is retired, or re-centering live app chrome around a nucleus graphic.

---

## 8. Naming trap

**GRACE (product nucleus)** is the intelligence layer in the visual.

**Cadence (WorkOS agent)** is a registered scanner that reviews Work Orders,
tasks, and approvals for anything overdue, blocked, or stale.

**✅ Resolved 2026-08-28.** This section previously recorded the trap as *already
broken in shipped code*: the registry entry was named "Grace," and
`CampusRenderer.ts` drew it with the nucleus's own visual language
(`isOrb: a.key === 'grace'`), so the campus showed an orb labelled Grace while
the architecture page showed an orb labelled GRACE. Both are fixed — the agent
displays as **Cadence · Operations Scanner**, and the `isOrb` special case (and
the now-dead `drawOrb`) are gone, so it is drawn as an ordinary sprite.

**The stored key remains `grace`, deliberately.** It is never rendered — only
`name` and `role` reach a user — and it is the join key for live history:
`agent_runs`, `agent_configs`, `agent_findings.agent_id`, and the
agent-prefixed `agent_findings.dedup_key`. At the time of the rename production
held 31 rows under that key (28 findings, 2 runs, 1 saved config). Renaming the
column value would have orphaned that history and silently broken finding dedup
— a data migration on a live tenant bought nothing a user could see. If the key
is ever renamed, it needs a migration covering all four locations, including
string surgery on `dedup_key`.

---

## 9. Pilot guardrail

No in-app information-architecture change until an explicit product pass. Central Henderson pilot work is not blocked by this document.
