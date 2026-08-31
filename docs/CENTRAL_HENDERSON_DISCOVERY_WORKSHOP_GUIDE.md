# Central Henderson Discovery Workshop — Facilitator's Guide

**Status: DRAFT, internal prep only.** Written to prepare *us* to run a real
session with Central Henderson's leadership — not yet reviewed line-by-line
for tone with them in mind. Revise the framing, examples, and questions
before this goes in front of anyone at the church. Nothing in this document
has been shared with or validated by Central Henderson.

**Source data:** everything in this guide traces back to the Central
Henderson GRACE Qualification Exam (`tools/eval-harness/central-henderson-exam/`)
and the structured discovery instrument built from it
(`tools/eval-harness/central-henderson-exam/discovery/`). For full technical
traceability — gap IDs, qualification case IDs, access classification,
sensitivity fields — see
`docs/CENTRAL_HENDERSON_DISCOVERY_TECHNICAL_SPEC.md`. This guide doesn't
restate that data wholesale, and deliberately avoids the technical language
that document uses — it turns the findings into plain-language conversation
a facilitator can actually run a session with.

**The question this session is really asking.** Up to this point, we've
been asking "how intelligent is GRACE?" — tested against evidence. This
session asks a different question: **what does GRACE need from Central
Henderson specifically to become genuinely intelligent about their
operation?** We know some real gaps exist. This session finds out where the
missing truth actually lives, who's authorized to give it to us, and how
GRACE should eventually get access to it — not by guessing, by asking.

---

## 1. Purpose

The exam told us, with evidence, what GRACE actually knows and safely
understands about Central Henderson today — and where it doesn't. That's
half the picture. The other half only Central Henderson's own staff can
give us: **does the gap actually matter to how they'd use this, where does
the real answer live, who owns it, and would they notice or care if we
shipped the pilot without closing it?**

This session is not a demo and not a sales pitch. Its job is to:
1. Validate (or correct) our read on which gaps are actually pilot-blocking,
   using their real workflow instead of our guesses.
2. Find out, for each thing GRACE doesn't know, *where the real answer
   lives* — not assume it's in our system already.
3. Understand who's actually allowed to see, change, or approve the
   sensitive things GRACE might eventually touch — giving, care, family
   information, staff matters.
4. Surface anything the exam structurally couldn't detect — the exam can
   only test what we thought to test; staff will ask things we didn't.
5. Leave with an explicit, mutually-understood scope: what GRACE will and
   won't do on day one of the pilot, and why.

If the session produces "yes, ship it as-is" for a gap we thought was
pilot-blocking, that's a genuinely useful, cost-saving result — not a
failure to find something to fix. Same if the answer to "where does this
live" turns out to be "it doesn't exist yet, nobody tracks that" — that's
real information, not a disappointing non-answer.

**One important boundary to hold, silently, as facilitator:** nothing said
in this room changes what GRACE can actually do. A real fix always requires
us building it and re-testing it — this session identifies what to build
and gathers what we need, it doesn't ship anything itself. You don't need
to say this out loud unless someone asks how fast a fix will land.

## 2. Before the session

- [ ] Re-run the exam (`npx tsx tools/eval-harness/central-henderson-exam/run-exam.ts`)
      to confirm the underlying findings still reflect the current codebase
      — this guide's specific claims will drift if the code changes and
      this document doesn't get regenerated alongside it.
- [ ] Identify who from Central Henderson should be in the room. Given the
      pilot-priority items now include a giving/finance question and a
      broader systems-of-record pass, aim for:
      - one person who'd actually use Ask GRACE day-to-day (a pastor or
        admin staff member),
      - one person who owns pastoral-care/prayer workflows,
      - one person who owns giving/finance records, even briefly for the
        relevant section — the highest-stakes open question in this whole
        session concerns giving and care visibility together.
- [ ] Decide the format: one 90-120 minute session covering Parts 1-6 below,
      or split across two sessions (Parts 1-4 first, Parts 5-6 as a
      follow-up once they've had time to sit with it). Splitting is a
      reasonable choice this time — this version of the guide is longer
      than the first draft. Don't compress Part 1 or Part 3 to save time —
      those are the actual point of the session.
- [ ] Have a way to capture their answers as you go (this doc, a shared
      notes doc, whatever) — the "Capture" prompts throughout are there to
      remind you to actually write down what they say, not just nod.

## 3. Session goals — what we walk away with

By the end, we should be able to fill in:
- A **confirmed pilot scope**: which of the 5 "needed for pilot" gaps below
  are genuinely needed, which can wait, and whether anything from
  "valuable after pilot" should actually move up.
- For each system category we asked about (people, care, giving, events,
  communications, and so on): where the real answer lives, who owns it, and
  how it changes.
- A first pass at who's allowed to see, ask about, or approve the sensitive
  things — giving, care, prayer, family information, staff matters,
  communications consent.
- At least one thing Central Henderson raised that the exam **didn't**
  anticipate — if the session produces zero new information, the questions
  were probably too leading or too abstract.
- Their own read on the priority order in Part 5, not just a rubber stamp
  of ours.

## 4. Opening framing (suggested script)

> "We built an evaluation harness that tests, mechanically, what Ask GRACE
> actually knows and can safely do about Central Henderson specifically —
> not what it's supposed to do eventually, what it demonstrably does
> *right now*. We found real gaps, and we're not here to defend them or
> talk you out of caring about them. Today we want two things from you:
> your read on which of these would actually get in your way on day one,
> and — just as important — where the *real* answer to each gap actually
> lives in how you already run things. We're not assuming our system
> already has the answer sitting somewhere unused. Some of what we found,
> you'll probably disagree with the priority on — that's the point of this
> conversation."

Set the expectation early that "I don't know," "that doesn't matter to
me," and "nobody tracks that anywhere" are useful answers, not
disappointing ones.

---

## 5. Part 1 — Validate the "needed for pilot" gaps

These five are ranked highest by risk-if-wrong × pilot value in our own
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

### 5.3 — The giving persona talks fluently about pledges, campaigns, and funds it has no data for

**What we found:** GRACE is coached to speak naturally about benevolence
funds, pledges, capital campaigns — but none of that data actually reaches
it. Today it correctly declines to state a specific figure, but the
temptation built into how it's prompted is a real, standing risk.

**Ask them:** "Do you run pledge drives, campaigns, or designated funds
distinct from general giving? Is that something a pastor or admin would
naturally ask GRACE about, the way they'd ask about month-to-date giving
totals? And if so — where does that information actually live today?"

**Listen for:** If Central Henderson genuinely doesn't run campaigns/
pledges as a distinct workflow, this gap may matter far less than our
ranking assumed. If they do, the follow-up ("where does that live")
determines whether this becomes a quick wiring fix or a bigger project.

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

### 5.5 — GRACE has no authorized source for Henderson-specific financial or attendance figures

**What we found:** The only financial document GRACE has been given
describes the whole organization Central Henderson is part of, not
Henderson specifically. Today, if asked "what was our revenue" or "how's
attendance trending," GRACE correctly says it doesn't have an authorized
Henderson-specific answer — but that also means it currently can't answer
one of the most natural questions a leader would ask it.

**Ask them:** "What's the right source we should be working from for
Henderson-specific numbers — attendance, budget, giving trends — and who's
the right person to sign off on GRACE using it?"

**Listen for:** This is likely the single most foundational question in
this entire session — whether GRACE can ever move past "I don't have an
authorized source for that" on basic operational questions depends
entirely on the answer here.

**Capture:** _____________________________________________

---

## 6. Part 2 — Show us, don't tell us

For the topics below, don't just ask how something works — ask to actually
see it happen, live, on a real screen. What people describe from memory and
what actually happens day-to-day are sometimes different, and that gap is
itself useful information.

For each: note which system was actually shown, who showed it (their role,
not just their name), and whether what you saw matched what was said
earlier in the conversation.

1. **"Show us how a new person enters the system."**
2. **"Show us how a household is represented — how do you show that two
   people belong to the same family?"**
3. **"Show us what happens after someone requests prayer — from the moment
   it comes in to the moment it's marked resolved."**
4. **"Show us how Sunday volunteers are scheduled."**
5. **"Show us where your staff sees what work is outstanding — especially
   anything waiting on a pastor's approval."**
6. **"Show us how an event gets created and where people actually see it."**
7. **"Show us where giving and fund information lives — not the numbers
   themselves, just the system and who has access to it."**
8. **"Show us how a church-wide message gets approved and sent."**

**Capture, per demonstration:** system shown → _______________ owner
→ _______________ matched what was said earlier? ☐ yes ☐ no, noted below
→ _______________

---

## 7. Part 3 — Where does the real answer actually live?

For each area below, we're not assuming our own system already has the
answer sitting somewhere unused — we're asking Central to tell us. Group
these naturally in conversation; you don't need to march through all 16 in
strict order if a demonstration in Part 2 already answered one.

**People & households:** "Where's your official record of a person — a
member, a visitor, whatever term you use? And separately — how do you
group family members together today?"

**Attendance:** "How do you actually track who showed up — a check-in
system, a headcount, something else?"

**Groups & discipleship:** "Where do you track which small groups exist
and who's in them? And how do you track someone's next step or
discipleship progress, if you do at all?"

**Care & prayer:** "Where do pastoral care situations get recorded, and
who has access to that? Separately — where do prayer requests get
submitted, and how do you know when one's resolved?"

**Sunday & volunteers:** "Where do you keep track of who volunteers, in
what role? And where does a Sunday service actually get planned?"

**Events:** "Where does an event get created, and where does it show up
for people?"

**Giving & funds:** "What system actually processes and records giving?
And if you run designated funds or campaigns, where does that live
separately from general giving?"

**Staff work:** "Where does your team track what needs to get done — and
specifically, where do things that need a pastor's sign-off wait?"

**Communications:** "What do you use to send church-wide messages, and how
do you know who's opted out?"

**Policies & permissions:** "Where do your written policies live — for
care, for communications, for data handling? And who decides who's allowed
to see or change what?"

For each answer, capture: **what system** → **who owns it** → **how you'd
actually get to it** → **how often it changes** → **how sensitive it is**
→ **should GRACE ever be allowed to use this, and how**.

---

## 8. Part 4 — Who's allowed to know, change, and decide?

This is the most sensitive part of the session — take it slower, and be
comfortable if the honest answer is "we haven't decided that yet." We are
**not** designing a new permission system in this room — we're finding out
what the rules should be so we can build to them later.

For each area, the same five questions apply. Read the area, then ask all
five before moving on:

- Who's allowed to see this information at all?
- Who's allowed to ask GRACE about it?
- Who's allowed to change it?
- Who's allowed to tell GRACE it's okay to actually do something with it —
  send a message, update a record?
- If GRACE summarized this for someone, or combined it with something from
  a different area (like connecting a giving pattern to a care situation),
  is that okay, or does it need a real person's judgment first?

**Areas to cover, roughly in order of sensitivity:**

1. **Giving** — individual giving history, not just totals.
2. **Pastoral care** — care situations, crisis or conflict conversations.
3. **Prayer requests** — especially ones involving health, marriage, or
   family difficulty.
4. **Spiritual conversations** — anything about someone's faith journey or
   struggle. (Note for facilitator, not to say aloud: GRACE is never
   allowed to judge or score someone's spiritual state — this question is
   about what GRACE may *recall*, not interpret.)
5. **Household/family information** — because family structure can reveal
   things (separation, estrangement) not visible from one person's record
   alone.
6. **Staff matters** — approvals, internal work, anything employment-
   adjacent.
7. **Communications consent** — who opted in or out, and whether that
   status itself should be visible.

**Capture, per area:** who sees → _______________ who asks GRACE →
_______________ who changes → _______________ who authorizes GRACE to act
→ _______________ summarize OK? → _______________ combine across areas OK?
→ _______________

---

## 9. Part 5 — Spot-check the thin domains

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
ask GRACE, since that's the seed of a future test case, not just a vague
"add more data" note.

---

## 10. Part 6 — React to the priority ranking

Show them the three buckets (or read them aloud) without our rationale
first, and ask them to sort/react before you explain our reasoning — you
want their unprimed read, not agreement with our framing.

**Needed for pilot (ours):** comms visibility, ministry demo data, giving
persona mismatch, prayer staleness, Henderson-specific financial data.

**Valuable after pilot (ours):** households, Decision Queue visibility,
events history/campaign linkage.

**Future advanced intelligence (ours):** general certainty/hedging
contract, general clarifying-question contract, Sunday/worship data
pipelines, GRACE proactively noticing things on its own, and — despite
being bucketed here on urgency — the open question of who's allowed to see
giving and care information together, which is actually one of the
highest-stakes items in the whole session even though it's not a quick
fix.

**Ask:** "Looking at these three groups — what would you move, and why?"

**Capture — what they'd move, and their stated reason (not just the
result):** _____________________________________________

---

## 11. Part 7 — Decisions to walk away with

Fill this in live, in the room if possible, so there's no ambiguity about
what was agreed:

- **Confirmed pilot scope (in):** _____________________________________________
- **Explicitly deferred (out, with their sign-off):** _____________________________________________
- **New gap(s) they raised that the exam didn't cover:** _____________________________________________
- **Anything they explicitly said doesn't matter, that we'd assumed did:** _____________________________________________
- **Systems of record confirmed** (which system owns which category — see
  Part 3): _____________________________________________
- **Authority decisions confirmed, and which ones are still open** (see
  Part 4): _____________________________________________

## 12. After the session

- Fold anything new they raised into the Knowledge Gap Map
  (`tools/eval-harness/central-henderson-exam/knowledge-gap-map.ts`) and the
  discovery items
  (`tools/eval-harness/central-henderson-exam/discovery/discovery-items.ts`)
  as real entries, not just meeting notes — if it's worth remembering, it's
  worth a traceable line in the same place everything else lives.
- If the session reprioritizes anything, update `pilot-priority-ranking.ts`
  to match and note *why* it moved (their stated reason, not just "per
  discussion") — the same discipline the ranking file already asks of
  itself.
- Fill in the systems-of-record and authority answers into
  `systems-of-record.ts`, `authority-sensitivity-map.ts`, and
  `source-register.ts` — these become the first real version of Central's
  GRACE data map.
- **One rule that doesn't bend:** nothing said in this session moves any
  capability from "not yet proven" to "proven" by itself. A workshop answer
  tells us what to build and where to get authorized data from. Only a
  qualification test we actually re-run, and that actually passes, moves
  anything in the Capability Baseline. If someone asks "so is this fixed
  now," the honest answer right after the workshop is always "we now know
  what to build" — never "yes."
- Anything confirmed as "needed for pilot" is a real prioritization
  decision, not something this guide or the exam makes unilaterally — that
  implementation work is its own next step, not part of this document.
