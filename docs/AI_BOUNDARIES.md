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

## What this phase does NOT claim

- No promise of response time.
- No claim that any AI in this codebase currently detects crisis language
  with anything more sophisticated than keyword matching — that is a
  deliberate, documented choice (see `api/_lib/careSafety.ts`), not a
  limitation to quietly fix later without discussion. A model-based
  detector would trade auditability for recall/precision — that tradeoff
  is a policy decision for a human to make explicitly, not something to
  ship silently.
