# Grace — Next-Level Plan

**Branch:** `next-level` (v1 saved at tag `v1-save-point` and branch `v1-stable`)
**Started:** 2026-04-24
**Status:** Scoping → Phase 1

---

## Thesis

Every church CRM on the market is a glorified database. Planning Center, Breeze, Tithe.ly — they *store* people. Grace's revolutionary bet is that it **knows** people.

A small pastoral staff can genuinely shepherd maybe 80 relationships. Grace's promise: *"You can now pastor 800."*

Positioning shift:
- ❌ "Church management software"
- ✅ "The pastoral co-pilot that remembers every person in your church"

**One rule for every feature:** it either feeds the pastoral nervous system, or it doesn't ship.

---

## What's already shipped (v1 save point — `v1-stable`)

- Ask Grace AI assistant: dock, panel, streaming, write-actions (tasks/prayers/notes/people), ⌘/ shortcut, persistence, warmer tone on faith questions
- Member portal: announcements, events, prayers, discipleship pathways, pastoral stories (leader bubbles)
- Admin side: people, calendar, groups, prayer, tasks, giving, discipleship dashboard
- Tutorial system (5 scenario walkthroughs)
- Types scaffolded for `LeaderProfile` + `AIPersona` (marketplace foundations)

---

## The north star product

**Grace is the pastoral nervous system of the church.** Every conversation, prayer request, attendance event, giving pattern, sermon, and small-group note flows through Grace. Staff doesn't search for information — Grace surfaces what matters, when it matters.

Three capabilities make this real:
1. **Persistent per-person memory** — Grace knows Janet's context the moment you open her name
2. **Proactive weekly brief** — Grace shows up Monday with "who needs you this week, ranked, with draft messages"
3. **Closed-loop discipleship** — sermons connect to small groups connect to personal follow-ups, measured

The leader marketplace (Anchor) is the flagship that demonstrates the vision in one clickable flow.

---

## Phase roadmap

Each phase ships independently. Order is chosen for maximum compounding effect.

### Phase 1 — Anchor: Leader Marketplace + AI Clones (2–3 weeks)

The wedge. A BetterHelp-style section where each verified leader has both a real-person side AND an AI clone.

**Deliverables**
- New member-portal section "Anchor" (section inside Grace, not separate app)
- Supabase tables: `leader_profiles`, `leader_ai_personas`, `anchor_conversations`, `anchor_sessions`
- Quiz intake flow (3 questions: topic, tone, gender preference) → match 3 leaders
- Browse view for returning members with prior matches pinned
- AI clone chat — streaming, discloses warmly ("I'm Pastor Mike's AI companion, trained on his notes")
- Handoff triggers: crisis keywords, explicit "real person" request → booking inquiry form
- Leader onboarding form: 15-min structured intake (theology positions, stock phrases, anchor verses, tone sliders) → becomes system prompt
- Admin panel stub: list leaders, toggle visibility per church, view conversation counts
- Sage-green + cream palette for Anchor section (visually distinct from rest of Grace)

**Done when**
- A pastor in the admin panel can toggle a leader visible
- A member can take the quiz, get matched, chat with an AI clone that feels like the leader, and book a real session
- Admin sees a conversation count per leader

**Open before shipping**
- [ ] LLM provider choice for clones (Gemini / Anthropic / OpenRouter)
- [ ] Consent copy (what members agree to when chatting)
- [ ] Crisis-escalation phone number / fallback

---

### Phase 2 — Per-person memory layer (2–3 weeks)

The compounding moat. Every interaction becomes retrievable context.

**Deliverables**
- Enable `pgvector` in Supabase
- `person_memory` table: `(person_id, content, embedding, source_type, source_id, created_at)`
- Ingestion hooks: every pastoral note, prayer request, Anchor conversation, attendance event, small-group note writes a memory row
- Embedding generation on write (background Edge Function)
- Grace AI gets `recall_about_person` tool: pulls top-k relevant memories before answering anything scoped to a person
- When pastor opens a Person profile: sidebar shows "Grace's read" — 3–5 bullet summary of recent context, emotional arcs, last interaction
- Privacy boundaries: leader clones only see memories the member surfaced to that leader, not other leaders' conversations

**Done when**
- A pastor opens Janet's profile and sees: "Last talked with you 3 weeks ago; her mother had just been diagnosed. Has skipped 2 Sundays since. Last Anchor chat (with Pastor Sarah) was about fear of losing her job."
- Grace answers "what should I know before I call Mark tomorrow?" with actually useful synthesis

**Open before shipping**
- [ ] Member consent model for AI reading their data
- [ ] Retention policy (how long we keep memories, purge on request)
- [ ] Which data types are embed-eligible (exclude giving amounts from embeddings?)

---

### Phase 3 — Monday Morning Brief (1–2 weeks)

The demo-killer feature. The one that makes a pastor pay $500/mo on the spot.

**Deliverables**
- Weekly digest generator (pg_cron + Edge Function, runs Sunday night)
- Scoring model per person: attendance gap + giving pattern shift + discipleship stall + celebration moments + recent prayer urgency + conversation sentiment
- Ranked list: ~10–15 people who need attention this week, each with reason + draft message
- Delivery: email Monday 7am + in-app "This Week" view on admin dashboard
- One-click actions per row: call (copies phone + opens notes), message (opens draft), schedule visit, mark "already handled"
- "Grace learned from your actions" — tracks which suggestions pastors take vs dismiss, refines ranking

**Done when**
- A senior pastor opens their inbox Monday, reads one Grace email, and knows their week
- Clicking "call" drops them into a Person view with full context pre-loaded

**Open before shipping**
- [ ] Who receives it (senior pastor only, or configurable per role)
- [ ] Opt-out per member (some people don't want to be algorithmically surfaced)
- [ ] What to do when Grace is wrong — flag/feedback UI

---

### Phase 4 — Sermon-to-individual loop (2–3 weeks)

Closes the loop between the 35-minute sermon and the 10,000 micro-moments in a member's week.

**Deliverables**
- Sermon upload (audio file or paste transcript) on admin side
- Transcription pipeline (Whisper API or similar)
- Theme extraction (Gemini: main points, scripture references, applications)
- Small-group question generator (5–7 discussion questions)
- Personalized follow-up generator: takes sermon themes + known member context (from Phase 2 memory) → drafts short messages
- Member-side: opt-in to "Sermon follow-ups" in settings, receives via email or member-portal push
- Leader review step: pastor sees drafted follow-ups before any go out

**Done when**
- Pastor uploads Sunday's sermon Monday morning, Grace has drafted personalized follow-ups for 30 members by lunch, pastor approves, sent Tuesday
- Small-group leaders open their group page and see fresh discussion questions pre-populated

**Open before shipping**
- [ ] Cost per sermon (Whisper + Gemini generation for N members)
- [ ] Tone calibration (follow-ups must feel like the pastor, not corporate email)
- [ ] Frequency cap (max 1 follow-up per member per week regardless of sermons)

---

### Phase 5 — Measurement loop (1 week)

Prove Grace moves the needle. This is what justifies the price and drives retention.

**Deliverables**
- Outcome tracking: inactive member reactivations (someone who had 3+ week gap came back after Grace surfaced them), discipleship step progressions (moved through pathway), care conversations surfaced (Grace flagged, pastor acted)
- "Grace Impact" dashboard for senior pastor: this month's numbers
- Auto-generated monthly summary email: "Grace surfaced 47 people for attention; 31 were contacted; 19 returned; 4 discipleship milestones advanced"

**Done when**
- A senior pastor can look at last month's Grace Impact and say "worth every penny"

---

## Architecture additions across phases

- **pgvector** extension in Supabase (Phase 2)
- **Edge Functions** new: `clone-chat-stream`, `generate-weekly-digest`, `transcribe-sermon`, `generate-sermon-followups`, `embed-memory`
- **Tables** new: `leader_profiles`, `leader_ai_personas`, `anchor_conversations`, `anchor_sessions`, `person_memory`, `weekly_digests`, `sermons`, `sermon_followups`
- **Feature flag** `next_level_enabled` per church (Supabase `churches.settings.features.next_level`) — lets us dogfood without breaking existing churches
- **Separate entry points** for new features so they can be toggled off cleanly

---

## Working conventions for this branch

- Every PR touches ONE phase. No mixing.
- Feature-flag everything member-facing so v1 churches see no change.
- Sage-green palette is ONLY for Anchor; rest of Grace stays slate/indigo.
- Keep v1-stable deployable — if we need to ship a bug fix to production churches, we cherry-pick from next-level back to v1-stable or fix directly on v1-stable.
- Memory/embeddings work respects a hard privacy rule: member consent is required before their data flows into embeddings. Default off for existing members, on for new.

---

## Immediate next actions

1. Commit this plan to `next-level` branch
2. Phase 1 Task 1: design Anchor database schema (leader_profiles, leader_ai_personas, anchor_conversations, anchor_sessions) — Supabase migration file
3. Phase 1 Task 2: build Leader Onboarding structured-intake form (the thing that trains each clone)
4. Phase 1 Task 3: build member quiz intake flow
5. Phase 1 Task 4: build browse view + AI clone chat

Rollback at any point: `git checkout v1-stable` and redeploy.
