# Grace CRM - AI-Powered Pastoral Care Platform

## Product Vision

**Mission:** Capture church leaders' expertise and make it available 24/7 through AI personas, so no one who needs help ever falls through the cracks.

**Tagline:** Never lose a soul. Never burn out a leader.

---

## What We're Actually Building

An AI-Powered Pastoral Care Platform where:

- **Church leaders' expertise** is captured and made available 24/7 through AI personas
- **Anyone can ask for help** (anonymous or not) at any time
- **Smart routing** connects people to the right support
- **AI provides immediate support**, humans provide live connection when available
- **Nothing falls through the cracks** — every request is tracked, escalated, and followed up

### The Core Concept

```
REAL PERSON → AI PERSONA → END USER
     │            │            │
     │ expertise  │ 24/7       │ immediate
     │ training   │ access     │ support
     ▼            ▼            ▼
  Reviews      Handles       Gets help
  & steps in   initial       & path to
  live         support       human
```

The AI is **transparent about being AI**, but represents the real person's voice, tone, and expertise. It's not pretending to be the leader — it's acting as their trained assistant, available when they can't be.

---

## Why This Matters

### The Problem

- **Pastors are burning out.** 38% of pastors have considered leaving ministry. They can't be everywhere.
- **People need help at 2am.** Crises don't follow office hours.
- **Stigma keeps people silent.** Many won't ask for help face-to-face, especially for addiction, marriage issues, or mental health.
- **Small churches lack staff.** A church of 200 might have 1 pastor and 3 volunteer leaders. That's not enough coverage.
- **Follow-up falls apart.** Someone asks for prayer on Sunday, and by Tuesday nobody remembers.

### The Solution

AI personas that extend (not replace) human leaders:

1. **Always available** — 2am crisis? The AI persona is there.
2. **Judgment-free entry point** — Anonymous access for sensitive topics.
3. **Trained on the leader's actual approach** — Not generic chatbot answers.
4. **Smart escalation** — Knows when to bring in a human.
5. **Full CRM integration** — Every conversation tracked, nothing lost.

---

## User Personas

| Persona | Role | Core Need | Key Scenario |
|---------|------|-----------|--------------|
| **"Sarah"** | Struggling spouse | Safe, judgment-free way to get help | Husband has addiction; too ashamed to talk to anyone at church. Needs anonymous access at night. |
| **"James"** | 2am crisis | Immediate support that understands addiction | Relapsing at 2am. Can't call anyone. Needs someone who "gets it" right now. |
| **"Maria"** | New believer | Patient guide who won't judge questions | Has "basic" questions she's embarrassed to ask. Wants to learn without feeling stupid. |
| **Pastor Mike** | Church leader | Help more people without burning out | Doing 60-hour weeks. Can't keep up with counseling requests. Needs to multiply himself. |
| **Sarah J.** | Recovery group leader | Reach people who won't come to meetings | Knows there are people struggling who won't walk through the door. Needs a way to reach them. |

---

## User Journeys

### Journey 1: Anonymous Help Seeker ("Sarah")

```
Discovery          Entry              Intake           AI Chat          Escalation       Follow-up
   │                 │                  │                │                 │                │
   ▼                 ▼                  ▼                ▼                 ▼                ▼
Finds link      No login needed    "What kind of    Matched with     "Would you like   Optional:
on church       → enters chat      help are you     Recovery AI      to talk to a      check-in
website or      directly           looking for?"    Persona          real person?"     message
shared link                        (categories)     (Sarah J.)                         in 48hrs
```

**Key Requirements:**
- No authentication required for initial access
- Category-based intake (marriage, addiction, grief, faith questions, crisis, general)
- AI persona matched based on category and leader expertise
- Escalation path always visible but never forced
- Optional follow-up with anonymous identifier (no real name needed)

### Journey 2: Crisis at 2am ("James")

```
Entry            Safety Check        AI Support        Next Steps         Staff Notification
  │                  │                  │                  │                     │
  ▼                  ▼                  ▼                  ▼                     ▼
Opens chat       "Are you safe     Addiction-trained   "Here are some      Next morning:
at 2:17am        right now?"       AI persona          resources. Can I    staff sees
                 Crisis protocol   provides support,   connect you with    flagged
                 if needed         validates feelings  someone tomorrow?"  conversation
                 (988 hotline)                                             with priority
```

**Key Requirements:**
- Crisis detection keywords trigger safety protocol immediately
- Always surface crisis hotline numbers (988 Suicide & Crisis Lifeline)
- AI trained to de-escalate, not diagnose or treat
- Automatic staff notification for crisis conversations (next business day unless emergency)
- Clear disclaimers: AI is not a substitute for professional help

### Journey 3: Leader Onboarding ("Pastor Mike")

```
Invitation       Profile Setup      AI Persona Setup    Knowledge Base     Test & Refine
    │                │                    │                  │                  │
    ▼                ▼                    ▼                  ▼                  ▼
Receives         Fills in bio,      Defines tone,       Uploads sermons,   Runs test
admin invite     expertise areas,   communication        counseling notes,  conversations,
→ creates        availability       style, boundaries,   FAQ responses,     adjusts
account          schedule           escalation rules     approved resources persona
```

**Key Requirements:**
- Guided onboarding wizard (not a blank form)
- Tone calibration: "How would you respond to someone struggling with X?" (multiple scenarios)
- Boundary setting: Topics the AI should never handle alone
- Knowledge base: Upload documents, paste text, link resources
- Test mode: Leader can chat with their own AI persona to refine it
- Ongoing refinement: Leader reviews AI conversations and provides feedback

### Journey 4: Live Takeover

```
AI Conversation        Leader Available        Handoff              Live Chat
      │                      │                    │                    │
      ▼                      ▼                    ▼                    ▼
User chatting          Leader sees active     "Hi, this is the     Seamless
with AI persona        conversations on       real [Name]. I'm     transition,
→ conversation         dashboard → clicks     here now. How can    full context
flagged or             "Join"                 I help?"             preserved
leader online
```

**Key Requirements:**
- Leader dashboard shows active AI conversations in real-time
- One-click join to take over from AI
- User notified: "The real [Name] has joined the conversation"
- Full conversation history visible to leader (no context lost)
- AI can resume if leader disconnects
- Leader can tag-team with AI (let AI handle routine parts)

---

## Feature Tiers

### Tier 1 — Must Have (MVP)

| Feature | Description |
|---------|-------------|
| **Help Intake Form** | Category-based entry point for help seekers |
| **Help Categories** | Marriage, addiction, grief, faith questions, crisis, general, financial |
| **Leader Profiles** | Bio, expertise areas, availability, photo |
| **Basic AI Chat** | GPT-powered conversations using leader's context |
| **Conversation History** | Full transcript storage with search |
| **Staff Dashboard** | View all conversations, filter by category/status/priority |
| **Crisis Detection** | Keyword-based flagging with safety protocol |
| **Basic Escalation** | "Connect me to a real person" button in every chat |

### Tier 2 — Should Have

| Feature | Description |
|---------|-------------|
| **Anonymous Mode** | No-login access with anonymous identifiers |
| **Live Takeover** | Leader joins AI conversation in real-time |
| **Crisis Protocol** | Automated safety responses, hotline numbers, staff alerts |
| **Appointment Scheduling** | Book time with a leader directly from chat |
| **Follow-up System** | Automated check-in messages after conversations |
| **Conversation Rating** | Help seekers can rate their experience |
| **Smart Routing** | Auto-match to the right AI persona based on topic |
| **Notification System** | Email/SMS alerts to leaders for escalations |

### Tier 3 — Nice to Have

| Feature | Description |
|---------|-------------|
| **AI Persona Builder** | Guided wizard for creating and training personas |
| **Knowledge Base Upload** | Sermons, notes, approved resources as AI context |
| **Analytics Dashboard** | Conversation volumes, categories, outcomes, trends |
| **Conversation Tags** | Staff can tag and organize conversations |
| **Multi-leader Routing** | Route to available leader based on schedule |
| **Feedback Loop** | Leaders review and correct AI responses |
| **Resource Library** | Curated resources the AI can recommend |
| **Intake Customization** | Churches customize their own intake categories |

### Tier 4 — Future / Advanced

| Feature | Description |
|---------|-------------|
| **D-ID Video Personas** | AI persona as a video avatar for more personal feel |
| **Voice Chat** | Voice-based conversations with AI persona |
| **SMS Integration** | Text-based access to AI personas |
| **Multi-language Support** | AI personas in multiple languages |
| **Group Sessions** | AI-facilitated group support sessions |
| **Outcome Tracking** | Long-term tracking of help seeker progress |
| **Church Network** | Share personas/resources across churches |
| **API for Partners** | Third-party integrations |

---

## Long-Term Roadmap

### Phase 0: Planning & Design (1-2 weeks)

- [x] Product vision document (this file)
- [x] Dashboard component plan
- [ ] Database schema design for pastoral care tables
- [ ] UI/UX wireframes for intake flow and chat interface
- [ ] API route planning
- [ ] Security & privacy review (HIPAA-adjacent considerations)

### Phase 1: Foundation (2-3 weeks)

**Goal:** Basic help intake and leader management

- [ ] Database tables: help_requests, help_categories, leader_profiles, conversations
- [ ] Help intake form component (category selection, optional details)
- [ ] Leader profile CRUD (create, read, update, delete)
- [ ] Staff dashboard view for help requests
- [ ] Basic routing: help request → assigned leader
- [ ] Notification: leader receives email/SMS when assigned

### Phase 2: AI Chat with Personas (3-4 weeks)

**Goal:** Working AI conversations using leader context

- [ ] AI persona configuration (tone, style, boundaries, knowledge)
- [ ] Chat interface component (real-time, persistent)
- [ ] Conversation storage and retrieval
- [ ] Context injection: leader's profile + knowledge base → AI prompt
- [ ] Crisis detection system (keyword matching + AI classification)
- [ ] Safety protocol responses (hotline numbers, disclaimers)
- [ ] Basic escalation flow ("talk to a real person")

### Phase 3: Live Experience (2-3 weeks)

**Goal:** Real-time human-AI collaboration

- [ ] Real-time conversation updates (WebSocket or polling)
- [ ] Leader dashboard: active conversations view
- [ ] Live takeover: leader joins AI conversation
- [ ] Seamless handoff UI (user sees transition)
- [ ] Appointment scheduling from chat
- [ ] Follow-up system: automated check-in messages

### Phase 4: Polish & Scale (2-3 weeks)

**Goal:** Anonymous access, analytics, refinement

- [ ] Anonymous mode: no-login access with anonymous IDs
- [ ] Analytics dashboard: volumes, categories, outcomes, response times
- [ ] Conversation rating and feedback
- [ ] AI persona refinement tools (leader reviews and corrects)
- [ ] Knowledge base management (upload, organize, search)
- [ ] Multi-leader routing based on availability
- [ ] Mobile-optimized experience

### Phase 5: Advanced Features (Ongoing)

**Goal:** Next-generation capabilities

- [ ] D-ID video avatar integration for AI personas
- [ ] Voice chat support
- [ ] SMS-based access to AI personas (Twilio integration)
- [ ] Multi-language support
- [ ] Group session facilitation
- [ ] Church network features (shared resources)
- [ ] Outcome tracking and reporting

---

## Competitive Analysis

### Why This is Blue Ocean

No church software currently offers AI-powered pastoral care. Existing solutions:

| Product | What It Does | What It Lacks |
|---------|-------------|---------------|
| **Planning Center** | Church management, scheduling, giving | No AI, no pastoral care, no anonymous access |
| **Breeze ChMS** | Simple church management | No AI, no care workflows |
| **Tithe.ly** | Giving, church app, website | No pastoral care features |
| **Church Community Builder** | Groups, events, giving | No AI, limited care tracking |
| **Subsplash** | Church app, giving, media | No CRM, no care management |
| **Generic AI chatbots** | Customer service bots | No faith context, no leader personas, no CRM integration |

### Our Differentiators

1. **Church-native context** — Understands faith language, church culture, biblical counseling approaches
2. **Leader personas** — Not a generic AI; represents a real person's voice and expertise
3. **Hybrid model** — AI provides 24/7 availability; humans provide authentic connection
4. **Full CRM integration** — Every conversation ties back to the people database
5. **Anonymous access** — Removes barriers for sensitive topics
6. **Crisis-aware** — Built-in safety protocols, not an afterthought
7. **Multiplier effect** — One leader's expertise serves hundreds through their AI persona

---

## Privacy & Safety Considerations

### Privacy Principles

1. **Minimal data collection** — Only collect what's needed for care
2. **Anonymous by default** — Help seekers don't need to identify themselves
3. **Encrypted storage** — All conversations encrypted at rest
4. **Leader access controls** — Leaders only see their assigned conversations
5. **Data retention policy** — Clear policies on how long data is kept
6. **Export/delete** — Users can request their data or deletion

### Safety Requirements

1. **Crisis protocol is non-negotiable** — Every deployment must have crisis detection active
2. **AI transparency** — Users always know they're talking to AI
3. **Professional boundaries** — AI never diagnoses, prescribes, or acts as a therapist
4. **Escalation always available** — "Talk to a real person" button in every conversation
5. **Mandatory disclaimers** — AI provides support, not professional counseling
6. **Staff oversight** — All conversations reviewable by authorized staff
7. **Hotline integration** — 988 Suicide & Crisis Lifeline, domestic violence hotline, etc. always surfaced when relevant

---

## Success Metrics

### Leading Indicators

- Number of conversations initiated per week
- Percentage of anonymous vs. identified conversations
- Average response time (AI: instant, human escalation: < 4 hours)
- Crisis detection accuracy (false positive/negative rates)
- Leader onboarding completion rate

### Lagging Indicators

- Help seeker return rate (people coming back for more support)
- Escalation-to-resolution rate (escalated conversations that reach a human)
- Conversation satisfaction ratings
- Leader time saved (estimated hours reclaimed per week)
- People connected to groups/programs through AI conversations

### North Star Metric

**People helped who otherwise wouldn't have asked** — measured by anonymous conversation volume and first-time help seekers.

---

## Technical Integration Points

### Existing Grace CRM Systems to Leverage

| System | Integration |
|--------|-------------|
| **People database** | Link conversations to known members (when identified) |
| **Task system** | Create follow-up tasks from escalated conversations |
| **Prayer requests** | Convert chat prayer needs to prayer request entries |
| **Groups** | Recommend relevant small groups based on conversation topics |
| **Calendar** | Schedule appointments with leaders |
| **Email/SMS** | Send follow-up messages and notifications |
| **AI service** | Extend existing Google GenAI integration for persona conversations |
| **Agent system** | Create care-specific agents (follow-up, escalation, routing) |

### New Systems Required

| System | Purpose |
|--------|---------|
| **Conversation engine** | Real-time chat with AI + human handoff |
| **Persona builder** | Configure AI behavior per leader |
| **Knowledge base** | Store and retrieve leader-specific context |
| **Crisis detection** | Real-time keyword and sentiment analysis |
| **Anonymous identity** | Generate and manage anonymous user sessions |
| **Scheduling service** | Leader availability and appointment booking |

---

## Open Questions

1. **Liability** — What disclaimers and terms of service are needed for AI-based pastoral support?
2. **Training data** — How much initial content does a leader need to provide for a useful persona?
3. **Denominational differences** — How do we handle varying theological positions across churches?
4. **Mandated reporting** — If someone discloses abuse, what are the legal obligations?
5. **AI model selection** — Google GenAI (current) vs. OpenAI vs. Anthropic for persona conversations?
6. **Pricing model** — Per-church? Per-conversation? Tiered by features?
7. **Pilot church** — Who is the first church to test this with?

---

*Document created: February 2026*
*Last updated: February 2026*
*Status: Phase 0 — Planning & Design*
