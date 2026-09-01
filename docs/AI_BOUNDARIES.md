# AI boundaries and crisis escalation policy

> Governs GRACE (the member-facing companion, `previews/grace-companion.js`
> and any future AI assistance wired into the Members Portal or Admin
> Dashboard) and every "Sentinel"-style automated review referenced in
> `api/_lib/agentWorkflows.ts` and the care/prayer workflows added in this
> phase. This is a policy document, enforced by the code choices below —
> not aspirational copy.

## What GRACE (or any GRACE-branded AI feature) may do

- Help a member organize a care request — suggest a category, help them
  phrase what they want to share. It fills out a form; it does not decide
  what happens to that form after submission.
- Help a member write or refine a prayer request.
- Recommend approved church resources (service times, groups, existing
  `announcements` rows) — never invented facts.
- Help a member request human contact — e.g. pre-filling "I'd like someone
  to follow up" — but the actual follow-up is always a human action
  (`care_assignments`, assigned by a `care.manage` staff member).

## What GRACE (or any GRACE-branded AI feature) may NOT do

- **Impersonate a pastor or any specific leader.** The existing "leader
  avatar" concept in the portal preview must never be presented as, or
  behave as, a real substitute for that leader's pastoral judgment — see
  the current-state assessment's finding that this was previously a
  purely scripted feature with zero real AI behind it.
- **Diagnose.** No mental-health, medical, spiritual-condition, or
  relationship diagnosis, ever, in any GRACE-authored text.
- **Claim spiritual authority.** GRACE is a navigator, not clergy.
- **Make judgments about a member.** No "this member seems distant,"
  no scoring, no inferred spiritual state — this is also why
  `member_journey_items` (this phase) and the onboarding checklist
  (`api/_lib/portalJourney.ts`, prior phase) are explicitly NOT a score:
  every value is a plain boolean derived from a real signal the member
  chose or an action they took, never an AI inference about them.
- **Independently manage a crisis.** No AI system in this codebase is
  permitted to be the last step in a crisis response. Every crisis path
  in this codebase terminates in a human decision:
  - `detectCrisisLanguage()` (`api/_lib/careSafety.ts`) is a keyword
    match, not a model call — deterministic, auditable, and cheap to
    verify has no false confidence attached to it.
  - A crisis-flagged care request or prayer request sets
    `sentinel_review_status = 'pending'` and/or forces safe visibility
    (`api/portal/_care.ts`, `api/portal/_prayer.ts`). The system does
    **not** set this to `cleared` — only a `care.manage` human can
    (`api/care-requests/_index.ts`), and a request cannot be closed while
    review is pending (a structural 409, not a suggestion).
  - The member-facing response to crisis language is **fixed, pre-
    approved copy** (`CRISIS_RESOURCE_MESSAGE` in `api/portal/_prayer.ts`)
    naming 988 and 911 — never generated per-request, so it can never
    drift into inappropriate or falsely reassuring language.
  - Nothing in this codebase promises an emergency response time or
    outcome. The approved copy says a message is "routed... for human
    follow-up" — never "help is on the way" or similar.

## Sentinel: what "privacy review" means here

"Sentinel" (see `api/_lib/agentWorkflows.ts` `runSentinelComplianceReview`
from the Admin Dashboard WorkOS phase, and `sentinel_review_status` on
`care_requests` from this phase) is a **flagging mechanism**, not a
decision-maker. It:

- reads real rows (crisis-flagged or sensitive-category care requests,
  overdue data-subject requests) and writes a finding;
- never sets a review to `cleared` itself;
- never blocks or approves anything on its own — a human with
  `care.manage` does that.

If a future phase adds an LLM-backed Sentinel, this constraint does not
change: the system's job stops at "flag for a qualified human," full stop.

## Escalation workflow (approved)

1. Crisis language detected (member-portal submission) →
   `crisis_flagged = true`, visibility forced to `private_pastoral_care`,
   `sentinel_review_status = 'pending'`, `priority = 'crisis'`.
2. `care.request.submitted` / `prayer.request.submitted` platform event
   fires — any `care.view` holder sees the flagged item at the top of
   the queue (`ORDER BY crisis_flagged DESC`) immediately.
3. A human with `care.manage` reviews, assigns
   (`api/care-requests/_assign.ts`), and works the case — internal notes
   (`care_request_notes`, `care.manage`-only) record what happened.
4. The request **cannot be closed** until a human explicitly clears the
   Sentinel review (`sentinel_review_status = 'cleared'`).
5. Closure writes an `audit_logs` row (`recordAudit`) with a
   `correlation_id` tying the original submission, the platform event,
   and the closure together — real audit evidence, not a status flip
   with no trail.

## Staff Ask GRACE memory (ADR-014)

This document was written for the member-facing companion. ADR-014 (`DECISIONS.md`) extends the same "no judgments about a member" boundary to the staff assistant's new persistent memory:

- Grace's memory (`grace_memories`) may only record facts the **staff user** stated about their own plans, commitments, or context ("my meeting with Bill is Thursday"). It may never record an AI-formed inference, judgment, or score about a church member — the same boundary as above, just applied to a new storage layer instead of a new claim.
- A memory is never presented as church data. It is retrieved and injected into the prompt as "things you told me," explicitly subordinate to live church records — if a memory conflicts with a database fact, the database wins, every time.
- The member-facing portal assistant (`api/portal/_assistant.ts`) remains deliberately non-persistent — this section does not change that. Only the staff-facing Ask GRACE gained memory.

## Church knowledge (ADR-015)

`grace_knowledge` is a second, distinct storage layer from `grace_memories` above — church-scoped, not per-user, and with no runtime write path at all. The same boundaries apply, plus two specific to this table:

- `grace_knowledge` may only contain pre-approved, human-reviewed reference content (identity, mission, strategy, ownership path) — never a live financial figure, attendance count, debt figure, or any other operational metric for a campus. If a workflow ever needs a real Henderson-specific number, it must come from an authorized Henderson-specific source, not be inferred from consolidated organizational data.
- The four-part strategy stored here is navigation/next-step language only. It must never be used as a behavioral score, ranking, or eligibility rule for any person — restated explicitly here because this is a new, distinct claim this document didn't previously need to make.
- Injected as background context, always subordinate to `dataContext` (the live church-data block) in the prompt — same subordination rule as `grace_memories`, applied to a different kind of content.
- Never a source for any individual member's giving history, care history, or spiritual-conversation content, even though the church's mission language touches on spiritual life — that data, where it exists, is permissioned elsewhere.

## Capability self-awareness (ADR-017)

GRACE's answers about her own capability — "what can you do," "can you see X," "are you allowed to Y" — are grounded, not self-assessed:

- Every claim traces to `api/_lib/capability-manifest.ts`'s PROVEN entries (real qualification evidence, cross-checked against the eval-harness's own manifest for drift), never to persona prose, model training knowledge, or generic AI self-description.
- Capability, permission, and approval are three separate questions, resolved server-side (`api/_lib/grace-capability.ts`) from the actor's real, `resolveStaffActor`-verified permissions — never from anything in the client-submitted `dataContext`, never from a claim made in the conversation itself.
- The same personal-judgment ban above is enforced as an absolute, unconditional prohibition at this layer too (`PROHIBITED_CAPABILITIES`): scoring or judging a person's spiritual state, character, or worth is never presented as a capability GRACE has or could gain, regardless of who asks or what evidence, permission, or urgency they claim.
- This manifest's specific proven claims belong to Central Henderson (qualified against its real seeded data) and are tenant-gated accordingly — another church's staff receive an honest "no qualified evidence yet" answer, never Central Henderson's capability description.

## Epistemic confidence & clarification (ADR-018)

GRACE must never fill an important information gap with model confidence:

- A plausible inference must never be phrased as a settled fact ("Mary hasn't attended for six weeks" does not establish "Mary is leaving the church," even once attendance data exists) — the epistemic contract (`api/_lib/grace-epistemic.ts`) requires every inference to be labeled as such in the model's own words. Failing to do this is "inference laundering" and is treated as a safety-critical failure in the qualification suite.
- The personal-judgment ban above is absolute regardless of how much evidence exists or how the request is phrased: a prohibited request (e.g. "rank members by spiritual commitment") is declined outright, never converted into a clarifying question that would help complete it. `PROHIBITED` outranks every other evidence state, including missing information.
- Memory never silently overrides a live authoritative record merely because it's more recent in conversation — the ADR-014 subordination rule is restated and reinforced, not softened, at this layer.
- A source answering a nearby question is never treated as answering the actual question — the consolidated-vs-Henderson-specific distinction (ADR-015) is the canonical example this rule generalizes from.

## What this phase does NOT claim

- No promise of response time.
- No claim that any AI in this codebase currently detects crisis language
  with anything more sophisticated than keyword matching — that is a
  deliberate, documented choice (see `api/_lib/careSafety.ts`), not a
  limitation to quietly fix later without discussion. A model-based
  detector would trade auditability for recall/precision — that tradeoff
  is a policy decision for a human to make explicitly, not something to
  ship silently.
