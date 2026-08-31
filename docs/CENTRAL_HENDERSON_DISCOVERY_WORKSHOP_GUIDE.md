# Central Henderson Discovery Workshop — Facilitator's Guide

**Status: DRAFT, internal prep only.** Written to prepare *us* to run a real
session with Central Henderson's leadership — not yet reviewed line-by-line
for tone with them in mind. Revise the framing, examples, and questions
before this goes in front of anyone at the church. Nothing in this document
has been shared with or validated by Central Henderson.

**Source data:** everything in this guide traces back to the Central
Henderson GRACE Qualification Exam (`tools/eval-harness/central-henderson-exam/`)
— specifically its Knowledge Gap Map and pilot-priority ranking
(`tools/eval-harness/.output/central-henderson-gap-map.json`,
`central-henderson-pilot-priority-ranking.json`, regenerate via
`npx tsx tools/eval-harness/central-henderson-exam/run-exam.ts`). This guide
doesn't restate that data wholesale — it turns the ranked gaps into
discussion prompts a human can actually run a session with.

---

## 1. Purpose

The exam told us, with evidence, what GRACE actually knows and safely
understands about Central Henderson today — and where it doesn't. That's
half the picture. The other half only Central Henderson's own staff can
give us: **does the gap actually matter to how they'd use this, and would
they notice or care if we shipped the pilot without closing it?**

This session is not a demo and not a sales pitch. Its job is to:
1. Validate (or correct) our read on which gaps are actually pilot-blocking,
   using their real workflow instead of our guesses.
2. Surface anything the exam structurally couldn't detect — the exam can
   only test what we thought to test; staff will ask things we didn't.
3. Leave with an explicit, mutually-understood scope: what GRACE will and
   won't do on day one of the pilot, and why.

If the session produces "yes, ship it as-is" for a gap we thought was
pilot-blocking, that's a genuinely useful, cost-saving result — not a
failure to find something to fix.

## 2. Before the session

- [ ] Re-run the exam (`npx tsx tools/eval-harness/central-henderson-exam/run-exam.ts`)
      to confirm the gap map/ranking reflect the current codebase — this
      guide's specific claims will drift if the code changes and this
      document doesn't get regenerated alongside it.
- [ ] Identify who from Central Henderson should be in the room. At minimum:
      one person who'd actually use Ask GRACE day-to-day (a pastor or
      admin staff member), and one person who owns pastoral-care/comms
      workflows specifically, since those are where the highest-risk gaps
      concentrate (giving, comms, pastoral care).
- [ ] Decide the format: one 60-90 minute session covering Parts 1-3 below,
      or split across two shorter sessions (Part 1-2 first, Part 3 as a
      follow-up once they've had time to sit with it). Either works; don't
      try to compress Part 1 to save time — the discovery questions are the
      actual point of the session.
- [ ] Have a way to capture their answers as you go (this doc, a shared
      notes doc, whatever) — the "Capture" prompts in Part 1 are there to
      remind you to actually write down what they say, not just nod.

## 3. Session goals — what we walk away with

By the end, we should be able to fill in:
- A **confirmed pilot scope**: which of the 4 "needed for pilot" gaps below
  are genuinely needed, which can wait, and whether anything from
  "valuable after pilot" should actually move up.
- At least one thing Central Henderson raised that the exam **didn't**
  anticipate — if the session produces zero new information, the questions
  were probably too leading or too abstract.
- Their own read on the priority order in Part 3, not just a rubber stamp
  of ours.

## 4. Opening framing (suggested script)

> "We built an evaluation harness that tests, mechanically, what Ask GRACE
> actually knows and can safely do about Central Henderson specifically —
> not what it's supposed to do eventually, what it demonstrably does
> *right now*. We found real gaps, and we're not here to defend them or
> talk you out of caring about them. We want your read on which of these
> would actually get in your way on day one, versus which ones you'd never
> notice or wouldn't mind waiting on. Some of what we found, you'll
> probably disagree with the priority on — that's the point of this
> conversation."

Set the expectation early that "I don't know" and "that doesn't matter to
me" are useful answers, not disappointing ones.

---

## 5. Part 1 — Validate the "needed for pilot" gaps

These four are ranked highest by risk-if-wrong × pilot value in our own
analysis. Confirm or correct each with them directly. For each: state the
finding plainly, ask the question, note what a "this doesn't matter"
answer vs. a "this really matters" answer would sound like, and capture
what they actually say.

### 5.1 — Comms sends have no visibility into what's already been sent or who's opted out

**What we found:** GRACE can be asked to send an email or text to a
member, and it will — audited, permissioned — but with zero visibility
into whether that person already got a similar message recently, or
whether they've opted out of communications entirely.

**Ask them:** "If you asked GRACE to text someone a reminder, and they'd
already gotten three reminders this week from a different system, or
they'd unsubscribed from texts — would GRACE sending it anyway actually
happen in your workflow, and would it be a real problem if it did?"

**Listen for:** Do they already have a separate process/person who checks
this before any send goes out (lowers urgency)? Or is "just ask GRACE to
text them" exactly the kind of shortcut they'd want to take (raises
urgency)?

**Capture:** _____________________________________________

### 5.2 — Ministry/discipleship activity numbers are hardcoded demo data

**What we found:** If you ask GRACE about small-group engagement — posts
this week, who's inactive — the numbers it gives you are not real. They're
the same fixed demo data regardless of which group or which church is
asking, and nothing in how GRACE presents them signals that.

**Ask them:** "Would anyone on your team actually ask GRACE about group
engagement or activity levels? If GRACE gave you a specific, confident-
sounding number that turned out to be made up, what would that do to how
much you trust it for anything else?"

**Listen for:** This is as much a trust question as a feature question —
their answer tells us how much tolerance they have for GRACE being wrong
confidently, which matters far beyond this one domain.

**Capture:** _____________________________________________

### 5.3 — The giving/finance persona talks fluently about pledges, campaigns, and funds it has no data for

**What we found:** GRACE is coached to speak naturally about benevolence
funds, pledges, capital campaigns — but none of that data actually reaches
it. Today it correctly declines to state a specific figure, but the
temptation built into how it's prompted is a real, standing risk.

**Ask them:** "Do you run pledge drives, campaigns, or designated funds
distinct from general giving? Is that something a pastor or admin would
naturally ask GRACE about, the way they'd ask about MTD giving totals?"

**Listen for:** If Central Henderson genuinely doesn't run campaigns/
pledges as a distinct workflow, this gap may matter far less than our
ranking assumed — a good example of where their answer could legitimately
downgrade something we flagged as high-risk.

**Capture:** _____________________________________________

### 5.4 — Prayer requests have no date/staleness signal

**What we found:** A prayer request from yesterday and one from seven
months ago look identical to GRACE — same weight, no age marker.

**Ask them:** "How often does a prayer request stay 'active' for months
without being marked answered? Would it bother you if GRACE brought up an
old, possibly-resolved concern as if it were current?"

**Listen for:** Their actual prayer-request hygiene (do requests get
closed out promptly, or do they pile up) directly determines how often
this gap would actually surface in practice.

**Capture:** _____________________________________________

---

## 6. Part 2 — Spot-check the thin domains

Ministry/discipleship and Sunday/worship currently have close to zero
capability — not partial, close to nothing. Rather than walking through
every finding, ask a broader question for each:

**Ministry/discipleship:** "If GRACE could only answer questions about
people, tasks, giving, events, and prayer requests on day one — nothing
about small groups or discipleship steps — would that feel like a
meaningful gap in the pilot, or would it just not come up?"

**Sunday/worship:** "Same question for service planning and volunteer
scheduling — right now GRACE only knows your service times, nothing about
who's serving or what's planned. Does that matter for what you'd actually
use it for in a pilot?"

**Capture (ministry):** _____________________________________________
**Capture (worship):** _____________________________________________

If either answer is "yes, that matters," that's new information the exam
itself couldn't produce — write down *specifically* what they'd want to
ask GRACE, since that's the seed of a future fixture, not just a vague
"add more data" note.

---

## 7. Part 3 — React to the priority ranking

Show them the three buckets (or read them aloud) without our rationale
first, and ask them to sort/react before you explain our reasoning — you
want their unprimed read, not agreement with our framing.

**Needed for pilot (ours):** comms visibility, ministry demo data, giving
persona mismatch, prayer staleness.

**Valuable after pilot (ours):** households, Decision Queue visibility,
permission-sensitivity labeling.

**Future advanced intelligence (ours):** general certainty/hedging
contract, general clarifying-question contract, Sunday/worship data
pipelines, ANTICIPATE.

**Ask:** "Looking at these three groups — what would you move, and why?"

**Capture — what they'd move, and their stated reason (not just the
result):** _____________________________________________

---

## 8. Part 4 — Decisions to walk away with

Fill this in live, in the room if possible, so there's no ambiguity about
what was agreed:

- **Confirmed pilot scope (in):** _____________________________________________
- **Explicitly deferred (out, with their sign-off):** _____________________________________________
- **New gap(s) they raised that the exam didn't cover:** _____________________________________________
- **Anything they explicitly said doesn't matter, that we'd assumed did:** _____________________________________________

## 9. After the session

- Fold anything new they raised into the Knowledge Gap Map
  (`tools/eval-harness/central-henderson-exam/knowledge-gap-map.ts`) as a
  real entry, not just meeting notes — if it's worth remembering, it's
  worth a `relatedCaseIds`-traceable line in the same place everything
  else lives.
- If the session reprioritizes anything, update
  `pilot-priority-ranking.ts` to match and note *why* it moved (their
  stated reason, not just "per discussion") — the same discipline the
  ranking file already asks of itself.
- Anything confirmed as "needed for pilot" is a real prioritization
  decision, not something this guide or the exam makes unilaterally —
  that implementation work is its own next step, not part of this
  document.
