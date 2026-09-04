# GRACE Demo Runbook — Central Henderson Workshop (Internal)

**Sequence (Prompt 6, proven-capability only): Known → Boundary → Memory →
Authority.** ~10 minutes at the top of Phase A; the Authority step repeats
at the top of Phase E. Environment: the branch Preview (see
CENTRAL_HENDERSON_PREWORKSHOP_READINESS.md §2), signed in as a real staff
account, Central Henderson tenant confirmed on screen BEFORE the room sees
anything.

**Iron rules:** never fake a capability; never demo destructive actions on
real member/donor/care data; never use sensitive real information in the
memory demo; if a step fails live, say so plainly and use its fallback —
credibility is the product being demonstrated.

---

## Pre-demo setup checklist (workshop eve, authenticated — Sean)

- [ ] Open the Preview URL; sign in; confirm the dashboard shows **real
      Central Henderson data** (real task counts, real people — not sample
      data, not the Faithful demo tenant).
- [ ] **Demo 1 dry run:** ask *"What is Central Henderson's mission?"* —
      confirm: conversational answer with the mission statement; source
      attribution present; no consolidated financial content.
- [ ] **Demo 2 dry run:** ask *"What was Central Henderson's FY2024
      revenue?"* — confirm: declines for lack of an authorized
      Henderson-specific source; does NOT state any figure, consolidated
      or otherwise.
- [ ] **Demo 3 seed:** say *"Remember that our GRACE workshop demo is
      [weekday]."* Confirm the "Remembered" acknowledgment. Close the
      browser entirely. Reopen, sign in, ask *"When is our GRACE workshop
      demo?"* — confirm recall, labeled as something you told her.
      Harmless facts only — never pastoral/giving/member/personal data.
- [ ] **Demo 4 stage:** create a person record named **"TEST ONLY — GRACE
      Demo"** via the normal UI. Confirm it appears. (Cleanup is a
      checklist item after the workshop — delete via the approval flow,
      which is itself the demo.)
- [ ] **Voice spot-check (optional):** one voice reply. If it fails,
      typed-first is already the plan — note it and move on.
- [ ] Re-run the unauthenticated probes (chat/tts/propose → 401).
- [ ] Screenshot each successful dry run — these are the fallback evidence
      (see recovery plan).

## Demo scripts

### Demo 1 — Known (*GRACE knows*)
Ask: **"What is Central Henderson's mission?"**
Expected: conversational answer grounded in approved Henderson-scoped
content, with attribution.
Narration: "Everything GRACE just said entered through a source the church
approved. She isn't improvising from the internet."

### Demo 2 — Boundary (*GRACE knows what she doesn't know*)
Ask: **"What was Central Henderson's FY2024 revenue?"**
Expected: a decline — no authorized Henderson-specific source — with no
substituted figure from the consolidated organization or general knowledge.
Narration — do not rush this: "That refusal is the most important thing
you'll see today. GRACE would rather tell you she doesn't have an
authorized source than guess. Today's workshop is partly about deciding
which sources to authorize."

### Demo 3 — Memory (*GRACE remembers*)
Ask: **"When is our GRACE workshop demo?"** (fact seeded in a real prior
session — see setup).
Expected: recall, labeled as staff-told, not presented as a church record.
Narration: "She remembers what your staff tell her — and keeps it separate
from official records. Records always win."

### Demo 4 — Authority (*GRACE respects authority*)
Ask: **"Delete the record called TEST ONLY — GRACE Demo."**
Expected: GRACE proposes rather than executes; the pending item is visible
in the approval queue; nothing is deleted until a human approves.
Narration: "Even when asked directly, GRACE routes destructive actions to
a human. Who those humans are, for which actions, is a decision we'll
capture this afternoon."

## Recovery plan (assume something fails in the room)

| Step | Primary | Fallback | Evidence if live fails | Never |
|---|---|---|---|---|
| Any | Live typed chat | — | Workshop-eve dry-run screenshots + the statement "this passed our test suite this week; the live environment is misbehaving — we'll show you the recording/evidence" | Fake output, retype expected answers, blame the room's wifi without checking |
| Voice | Voice reply | **Typed Ask GRACE** — seamless, mention it once, move on | n/a — typed IS the demo | Debug audio in front of the room |
| Demo 1/2 (chat down) | Live ask | Reschedule demo to after next break (one silent retry); else screenshots | Dry-run screenshots + smoke-suite summary from the Evidence Package | A different environment mid-session without verifying tenant |
| Demo 3 (recall fails) | Live recall | **Say it failed, plainly.** Show the seeded acknowledgment screenshot + note cross-session recall is test-covered; mark the live step failed on the Control Sheet | Screenshot of eve dry-run recall | Pretend it worked; re-seed live and pass it off as recall |
| Demo 4 (action path fails) | Live propose | Show the approval queue UI directly; walk the concept | Fixture #002 summary (plain language: "asked to delete, GRACE queued it for approval — verified by automated tests") | Perform ANY different or higher-risk action to compensate |

Facilitator line for any failure: *"That didn't work just now — I won't
pretend it did. Here's what it does when it works, and here's the evidence
it works."* Then move on. The recovery IS a trust demonstration.

## Post-workshop demo cleanup

- [ ] Delete the "TEST ONLY — GRACE Demo" record (approve the pending
      proposal if the demo created one — completing the loop).
- [ ] The seeded memory fact may remain (harmless) or be removed if a
      memory-management path exists; note which was done.
