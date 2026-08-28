# GRACE — Intelligence Layer

**Status:** Architecture north star (positioning). Not a claim that the live product already works this way.
**Audience:** Sean, product/engineering, CEO-deck and strategy-page use.
**Companion visual:** [`/grace-intelligence.html`](../public/grace-intelligence.html)

---

## 1. Objective

GRACE is the trained operational intelligence of the church.

The CRM, member portal, wallets, agents, APIs, digital twin, and infrastructure are not the product center. They are the governed operating environment GRACE observes, understands, and — with human approval where required — acts through.

**Central message**

> GRACE — the intelligence layer that understands, oversees, and orchestrates the church’s digital operations.

Three simultaneous capabilities:

- **Sees** — data, member activity, workflows, authorized financial metrics, programs, communications, permissions, infrastructure, and system state.
- **Understands** — this church’s structure, people, policies, objectives, institutional knowledge, permissions, and operating context.
- **Acts** — through approved tools and specialized agents, with visible human approval and accountability wherever required.

People meet that same intelligence through three interfaces:

1. **CRM Workspace** — conventional staff and operational interface
2. **Digital Twin** — visual spatial view of the church’s operating environment
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
| **Digital Twin** | Thin 2D campus map. Deep-links into existing CRM/WorkOS rooms. Mounted as a WorkOS tab and inside Ask Grace. Does not invent capabilities. |
| **Specialized agents** | 16 registered; 5 implemented (Grace, Shepherd, Steward, Sentinel, Verity). Implemented agents are scanners, not LLM orchestrators. The registry entry named “Grace” is a WorkOS scanner, not the product nucleus. |
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
| Digital Twin | WorkOS tab + Ask Grace window. Navigational map. | First-class spatial view of the same state. Not a second system of record. |
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
| Local and cloud infrastructure | **Live** (Vercel + Supabase) |
| Specialized agents | **Partial** — 5 of 16 implemented; scanners only |
| Church hierarchy, programs, and workflows | **Partial** — Work Orders, tasks, ministry areas; ministry-scoped RBAC modeled, not fully enforced |
| Digital twin / virtual campus | **Partial** — thin campus map, Faithful-oriented demo model |
| Impact Card and wallet | **Later for live rails** — demo/simulated for beta |
| Future physical systems and hardware | **Later** |

---

## 7. Path to the vision

Pilot readiness still wins. Execution stays separate from the picture.

1. **Positioning (this pass).** Visual + this doc. Product IA unchanged.
2. **Unify “acts” (next product slice).** Ask GRACE proposes; Decision Queue / approvals execute; WorkOS agents become tools GRACE can invoke, not a parallel brain. Smallest move that makes the triad true.
3. **Unify “understands”.** One church context object shared by admin chat, member assistant, and agents. Retire the three-stack split over time.
4. **Elevate Digital Twin.** Keep it a spatial lens over the same state. Promote it from a WorkOS tab to a first-class interface only after (2).
5. **Do not do now.** VR/VWS, physical hardware, live i2C issuance, rewriting PRODUCT_VISION.md as if pastoral care is retired, or re-centering live app chrome around a nucleus graphic.

---

## 8. Naming trap

**GRACE (product nucleus)** is the intelligence layer in the visual.

**Grace (WorkOS agent)** is a registered scanner that reviews Work Orders, tasks, and approvals.

Until slice 2, they stay distinct. Do not present the registry entry as the intelligence layer.

---

## 9. Pilot guardrail

No in-app information-architecture change until an explicit product pass. Central Henderson pilot work is not blocked by this document.
