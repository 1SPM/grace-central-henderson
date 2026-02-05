# Dashboard Component Plan — Pastoral Care Module

Technical implementation details for the AI-Powered Pastoral Care features described in [PRODUCT_VISION.md](./PRODUCT_VISION.md).

---

## Data Models

### New TypeScript Interfaces

These types extend the existing `src/types.ts` and will be added as the pastoral care module is built.

```typescript
// ============================================
// PASTORAL CARE TYPES
// ============================================

export type HelpCategory =
  | 'marriage'
  | 'addiction'
  | 'grief'
  | 'faith-questions'
  | 'crisis'
  | 'financial'
  | 'anxiety-depression'
  | 'parenting'
  | 'general';

export type ConversationStatus =
  | 'active'        // AI or human currently engaged
  | 'waiting'       // Waiting for human escalation
  | 'escalated'     // Handed to a human
  | 'resolved'      // Marked complete
  | 'archived';     // Closed and stored

export type ConversationPriority = 'low' | 'medium' | 'high' | 'crisis';

export type MessageSender = 'user' | 'ai' | 'leader';

export type EscalationReason =
  | 'user-requested'
  | 'crisis-detected'
  | 'ai-uncertain'
  | 'topic-boundary'
  | 'follow-up-needed';

// --- Core Entities ---

export interface LeaderProfile {
  id: string;
  personId: string;              // Links to existing Person in CRM
  displayName: string;
  bio: string;
  photo?: string;
  expertiseAreas: HelpCategory[];
  availability: AvailabilitySchedule;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIPersona {
  id: string;
  leaderId: string;              // Links to LeaderProfile
  name: string;                  // Display name for the persona
  tone: PersonaTone;
  systemPrompt: string;          // Base system prompt for AI
  boundaries: string[];          // Topics AI should not handle alone
  escalationRules: EscalationRule[];
  knowledgeBaseIds: string[];    // References to uploaded knowledge
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaTone {
  warmth: number;      // 1-10: clinical → warm
  formality: number;   // 1-10: casual → formal
  directness: number;  // 1-10: gentle → direct
  humor: number;       // 1-10: serious → lighthearted
  faithLevel: number;  // 1-10: secular counseling → scripture-heavy
  sampleResponses: {   // Calibration samples
    scenario: string;
    response: string;
  }[];
}

export interface EscalationRule {
  trigger: 'keyword' | 'sentiment' | 'topic' | 'duration' | 'user-request';
  condition: string;             // e.g., keyword pattern, topic name, minutes
  action: 'flag' | 'notify' | 'escalate' | 'crisis-protocol';
  notifyLeaderId?: string;
}

export interface AvailabilitySchedule {
  timezone: string;
  slots: {
    dayOfWeek: number;           // 0=Sun, 6=Sat
    startTime: string;           // "09:00"
    endTime: string;             // "17:00"
  }[];
  exceptions: {
    date: string;
    available: boolean;
    note?: string;
  }[];
}

export interface HelpRequest {
  id: string;
  category: HelpCategory;
  description?: string;          // Optional initial message
  isAnonymous: boolean;
  anonymousId?: string;          // Generated anonymous identifier
  personId?: string;             // If identified, links to Person
  assignedLeaderId?: string;
  assignedPersonaId?: string;
  conversationId?: string;
  status: 'pending' | 'active' | 'resolved' | 'cancelled';
  priority: ConversationPriority;
  createdAt: string;
  resolvedAt?: string;
  source: 'web' | 'sms' | 'app' | 'kiosk';
}

export interface Conversation {
  id: string;
  helpRequestId: string;
  personaId?: string;            // AI persona handling this
  leaderId?: string;             // Human leader (if taken over)
  status: ConversationStatus;
  priority: ConversationPriority;
  category: HelpCategory;
  isAnonymous: boolean;
  anonymousId?: string;
  personId?: string;
  messages: ConversationMessage[];
  metadata: ConversationMetadata;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  sender: MessageSender;
  senderName: string;            // "AI (Pastor Mike's Persona)" or "Pastor Mike" or "Anonymous"
  content: string;
  timestamp: string;
  metadata?: {
    aiModel?: string;
    aiConfidence?: number;       // 0-1 confidence score
    flagged?: boolean;
    flagReason?: string;
    editedAt?: string;
    editedBy?: string;
  };
}

export interface ConversationMetadata {
  totalMessages: number;
  aiMessages: number;
  humanMessages: number;
  userMessages: number;
  averageResponseTime: number;   // seconds
  crisisDetected: boolean;
  escalated: boolean;
  escalationReason?: EscalationReason;
  escalatedAt?: string;
  rating?: number;               // 1-5 user rating
  ratingComment?: string;
  tags: string[];
  followUpScheduled?: string;    // ISO date for follow-up
}

export interface KnowledgeBase {
  id: string;
  leaderId: string;
  title: string;
  type: 'document' | 'faq' | 'resource-link' | 'sermon' | 'notes';
  content: string;               // Raw text content
  sourceUrl?: string;
  fileUrl?: string;
  embedding?: number[];          // Vector embedding for similarity search
  createdAt: string;
  updatedAt: string;
}

export interface CrisisProtocol {
  id: string;
  name: string;
  triggerKeywords: string[];
  triggerSentimentThreshold: number;  // 0-1
  immediateResponse: string;         // Message to send immediately
  resources: {
    name: string;
    phone?: string;
    url?: string;
    description: string;
  }[];
  notifyStaff: boolean;
  notifyLeader: boolean;
  escalateImmediately: boolean;
}
```

### Database Tables (Supabase/PostgreSQL)

```sql
-- Leader profiles (extends existing people table via foreign key)
CREATE TABLE leader_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES people(id) NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  expertise_areas TEXT[] NOT NULL DEFAULT '{}',
  availability JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI personas (one per leader, extensible to many)
CREATE TABLE ai_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES leader_profiles(id) NOT NULL,
  name TEXT NOT NULL,
  tone JSONB NOT NULL DEFAULT '{}',
  system_prompt TEXT NOT NULL,
  boundaries TEXT[] NOT NULL DEFAULT '{}',
  escalation_rules JSONB NOT NULL DEFAULT '[]',
  knowledge_base_ids UUID[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge base entries
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES leader_profiles(id) NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('document', 'faq', 'resource-link', 'sermon', 'notes')),
  content TEXT NOT NULL,
  source_url TEXT,
  file_url TEXT,
  embedding VECTOR(1536),  -- pgvector for similarity search
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Help requests (intake)
CREATE TABLE help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  description TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  anonymous_id TEXT,
  person_id UUID REFERENCES people(id),
  assigned_leader_id UUID REFERENCES leader_profiles(id),
  assigned_persona_id UUID REFERENCES ai_personas(id),
  conversation_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id UUID REFERENCES help_requests(id) NOT NULL,
  persona_id UUID REFERENCES ai_personas(id),
  leader_id UUID REFERENCES leader_profiles(id),
  status TEXT NOT NULL DEFAULT 'active',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  anonymous_id TEXT,
  person_id UUID REFERENCES people(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Messages within conversations
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai', 'leader')),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crisis protocols
CREATE TABLE crisis_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  trigger_sentiment_threshold DECIMAL(3,2) DEFAULT 0.3,
  immediate_response TEXT NOT NULL,
  resources JSONB NOT NULL DEFAULT '[]',
  notify_staff BOOLEAN NOT NULL DEFAULT true,
  notify_leader BOOLEAN NOT NULL DEFAULT true,
  escalate_immediately BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX idx_help_requests_status ON help_requests(status);
CREATE INDEX idx_help_requests_category ON help_requests(category);
CREATE INDEX idx_help_requests_anonymous_id ON help_requests(anonymous_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_persona ON conversations(persona_id);
CREATE INDEX idx_conversations_leader ON conversations(leader_id);
CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON conversation_messages(timestamp);
CREATE INDEX idx_knowledge_base_leader ON knowledge_base(leader_id);

-- Row Level Security
ALTER TABLE leader_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;
```

---

## Component Architecture

### New Views to Add to `types.ts`

```typescript
// Add to the View union type:
| 'pastoral-care'         // Main pastoral care dashboard
| 'help-intake'           // Help request intake form
| 'conversations'         // All conversations list
| 'conversation-detail'   // Single conversation view
| 'leader-profiles'       // Leader profile management
| 'persona-builder'       // AI persona configuration
| 'knowledge-base'        // Knowledge base management
| 'crisis-protocols'      // Crisis protocol configuration
| 'care-analytics'        // Pastoral care analytics
```

### Component Tree

```
src/components/
├── pastoral/
│   ├── PastoralCareDashboard.tsx    # Main dashboard for pastoral care module
│   ├── HelpIntakeForm.tsx           # Public-facing intake form
│   ├── HelpCategorySelector.tsx     # Category picker with icons
│   │
│   ├── conversations/
│   │   ├── ConversationList.tsx      # Filterable list of all conversations
│   │   ├── ConversationDetail.tsx    # Full conversation view with messages
│   │   ├── ConversationMessage.tsx   # Single message bubble component
│   │   ├── ChatInput.tsx            # Message input with AI/human toggle
│   │   ├── ConversationFilters.tsx  # Status, category, priority filters
│   │   └── ConversationSidebar.tsx  # Context panel (person info, history)
│   │
│   ├── leaders/
│   │   ├── LeaderProfileList.tsx     # Grid/list of leader profiles
│   │   ├── LeaderProfileCard.tsx     # Card component for a leader
│   │   ├── LeaderProfileEditor.tsx   # Create/edit leader profile
│   │   └── LeaderAvailability.tsx    # Availability schedule editor
│   │
│   ├── personas/
│   │   ├── PersonaBuilder.tsx        # Step-by-step persona creation wizard
│   │   ├── PersonaToneCalibrator.tsx # Interactive tone slider component
│   │   ├── PersonaBoundaries.tsx     # Boundary and escalation rule editor
│   │   ├── PersonaTestChat.tsx       # Test conversation with persona
│   │   └── PersonaCard.tsx           # Summary card for a persona
│   │
│   ├── knowledge/
│   │   ├── KnowledgeBaseManager.tsx  # Upload and manage knowledge entries
│   │   ├── KnowledgeEntry.tsx        # Single entry view/editor
│   │   └── KnowledgeUploader.tsx     # File/text upload component
│   │
│   ├── crisis/
│   │   ├── CrisisProtocolEditor.tsx  # Configure crisis detection rules
│   │   ├── CrisisAlert.tsx          # Real-time crisis notification
│   │   └── CrisisResources.tsx      # Resource display component
│   │
│   └── analytics/
│       ├── CareAnalyticsDashboard.tsx # Overview stats and charts
│       ├── ConversationVolumeChart.tsx # Volume over time
│       ├── CategoryBreakdown.tsx      # Pie chart of categories
│       └── ResponseTimeMetrics.tsx    # Response time tracking
```

---

## Component Specifications

### 1. PastoralCareDashboard

**Purpose:** Main entry point for staff/leaders to manage pastoral care.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Pastoral Care Dashboard                    [Settings]  │
├──────────┬──────────┬──────────┬──────────────────────── │
│ Active   │ Waiting  │ Escalated│ Resolved Today         │
│   12     │    3     │    1     │     8                  │
├──────────┴──────────┴──────────┴──────────────────────── │
│                                                          │
│  [Active Conversations]  [Leader Status]  [Analytics]   │
│                                                          │
│  ┌─ Conversation ──────────────────────────────────┐    │
│  │ 🔴 Crisis: Anonymous - Addiction (2min ago)     │    │
│  │ 🟡 Active: Maria S. - Faith Questions (15min)  │    │
│  │ 🟢 Active: Anonymous - Marriage (1hr)           │    │
│  │ ...                                             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ Quick Actions ─────────────────────────────────┐    │
│  │ [New Help Request]  [View All]  [Export]         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface PastoralCareDashboardProps {
  conversations: Conversation[];
  leaderProfiles: LeaderProfile[];
  helpRequests: HelpRequest[];
  onViewConversation: (id: string) => void;
  onCreateHelpRequest: () => void;
  onViewLeaderProfile: (id: string) => void;
  onViewAnalytics: () => void;
}
```

**Tabs:**
- **Active Conversations** — Real-time list, sorted by priority then time
- **Leader Status** — Who's online, who's in conversations
- **Analytics** — Quick stats (today, this week, this month)

### 2. HelpIntakeForm

**Purpose:** Public-facing form for help seekers to start a conversation.

**Layout:**
```
┌─────────────────────────────────────────┐
│         How Can We Help?                │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │ Marriage │  │Addiction│  │  Grief │ │
│  │   💍     │  │   🔗    │  │   🕊️   │ │
│  └─────────┘  └─────────┘  └────────┘ │
│  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │  Faith  │  │ Crisis  │  │ Other  │ │
│  │   📖    │  │   🆘    │  │   💬   │ │
│  └─────────┘  └─────────┘  └────────┘ │
│                                         │
│  Tell us a bit more (optional):         │
│  ┌─────────────────────────────────────┐│
│  │                                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  ☐ I'd like to remain anonymous        │
│                                         │
│  [Start Conversation →]                 │
│                                         │
│  🔒 Private & confidential              │
│  ℹ️  You'll be connected with a trained  │
│     care leader (AI-assisted, 24/7)     │
└─────────────────────────────────────────┘
```

**Props:**
```typescript
interface HelpIntakeFormProps {
  onSubmit: (request: Omit<HelpRequest, 'id' | 'createdAt'>) => void;
  categories: HelpCategory[];
  isEmbedded?: boolean;          // For embedding on church website
  churchName?: string;
  customWelcomeMessage?: string;
}
```

**Behavior:**
- No authentication required
- Category selection is required, description is optional
- Anonymous checkbox generates a random anonymous ID (e.g., "Helper-7X3K")
- Crisis category triggers immediate safety check before AI chat
- Form submits to create HelpRequest → routes to matched AI persona → opens chat

### 3. ConversationDetail

**Purpose:** Full conversation view with chat interface and context panel.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  ← Back    Conversation with Anonymous (Marriage)    [⚙️]    │
├────────────────────────────────┬─────────────────────────────┤
│                                │  Context                    │
│  ┌──────────────────────────┐  │  ┌────────────────────────┐ │
│  │ AI (Pastor Mike's Asst.) │  │  │ Category: Marriage     │ │
│  │ Hi, I'm here to help.   │  │  │ Priority: Medium       │ │
│  │ What's on your mind?     │  │  │ Status: Active (AI)    │ │
│  └──────────────────────────┘  │  │ Started: 2hr ago       │ │
│                                │  │ Messages: 14           │ │
│  ┌──────────────────────────┐  │  └────────────────────────┘ │
│  │ Anonymous                │  │                             │
│  │ My husband has been...   │  │  Persona                   │
│  └──────────────────────────┘  │  ┌────────────────────────┐ │
│                                │  │ Pastor Mike's Asst.    │ │
│  ┌──────────────────────────┐  │  │ Confidence: 0.85       │ │
│  │ AI (Pastor Mike's Asst.) │  │  │ Escalation: None       │ │
│  │ I hear you. That sounds  │  │  └────────────────────────┘ │
│  │ really difficult...      │  │                             │
│  └──────────────────────────┘  │  Actions                   │
│                                │  ┌────────────────────────┐ │
│  ...                           │  │ [🔴 Join Conversation] │ │
│                                │  │ [📋 Add Note]          │ │
│  ┌─────────────────────┐       │  │ [🏷️ Add Tags]          │ │
│  │ Type a message...   │ [→]   │  │ [📅 Schedule Follow-up]│ │
│  └─────────────────────┘       │  │ [⚠️ Flag for Review]   │ │
│                                │  └────────────────────────┘ │
└────────────────────────────────┴─────────────────────────────┘
```

**Props:**
```typescript
interface ConversationDetailProps {
  conversation: Conversation;
  persona?: AIPersona;
  leader?: LeaderProfile;
  onSendMessage: (content: string) => void;
  onJoinConversation: () => void;     // Leader takes over
  onEscalate: (reason: EscalationReason) => void;
  onResolve: () => void;
  onScheduleFollowUp: (date: string) => void;
  onAddTag: (tag: string) => void;
  onFlag: (reason: string) => void;
  isLeaderView: boolean;              // Staff sees more controls
}
```

### 4. PersonaBuilder

**Purpose:** Step-by-step wizard for creating an AI persona from a leader profile.

**Steps:**
1. **Basic Info** — Name, photo, bio excerpt for persona
2. **Tone Calibration** — Interactive sliders + sample scenario responses
3. **Expertise** — Select categories and sub-topics
4. **Boundaries** — Topics the AI should not handle alone
5. **Escalation Rules** — When to bring in a human
6. **Knowledge Base** — Upload/link supporting content
7. **Test & Refine** — Chat with the persona, adjust settings

**Props:**
```typescript
interface PersonaBuilderProps {
  leader: LeaderProfile;
  existingPersona?: AIPersona;        // For editing
  onSave: (persona: Omit<AIPersona, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}
```

### 5. CrisisAlert

**Purpose:** Real-time notification when crisis is detected.

**Behavior:**
- Appears as a modal overlay on the pastoral care dashboard
- Audio alert (optional, configurable)
- Shows conversation excerpt that triggered the alert
- Actions: View Conversation, Join Now, Acknowledge
- Auto-notifies assigned leader via email/SMS

**Props:**
```typescript
interface CrisisAlertProps {
  conversation: Conversation;
  triggerMessage: ConversationMessage;
  protocol: CrisisProtocol;
  onViewConversation: () => void;
  onJoinNow: () => void;
  onAcknowledge: () => void;
  onDismiss: () => void;
}
```

---

## API Routes

### New API Endpoints

```
POST   /api/help-requests              # Create a help request (public)
GET    /api/help-requests              # List help requests (staff)
GET    /api/help-requests/:id          # Get single help request
PATCH  /api/help-requests/:id          # Update help request
DELETE /api/help-requests/:id          # Cancel help request

POST   /api/conversations              # Start a conversation
GET    /api/conversations              # List conversations (filtered)
GET    /api/conversations/:id          # Get conversation with messages
PATCH  /api/conversations/:id          # Update status/metadata
POST   /api/conversations/:id/messages # Send a message
POST   /api/conversations/:id/join     # Leader joins conversation
POST   /api/conversations/:id/resolve  # Mark resolved
POST   /api/conversations/:id/escalate # Escalate to human

GET    /api/leaders                    # List leader profiles
POST   /api/leaders                    # Create leader profile
GET    /api/leaders/:id                # Get leader profile
PATCH  /api/leaders/:id                # Update leader profile
DELETE /api/leaders/:id                # Deactivate leader profile

POST   /api/personas                   # Create AI persona
GET    /api/personas                   # List personas
GET    /api/personas/:id               # Get persona with config
PATCH  /api/personas/:id               # Update persona
POST   /api/personas/:id/test          # Test persona with a message
DELETE /api/personas/:id               # Deactivate persona

POST   /api/knowledge-base             # Upload knowledge entry
GET    /api/knowledge-base             # List entries (by leader)
GET    /api/knowledge-base/:id         # Get single entry
PATCH  /api/knowledge-base/:id         # Update entry
DELETE /api/knowledge-base/:id         # Delete entry

GET    /api/crisis-protocols           # List protocols
POST   /api/crisis-protocols           # Create protocol
PATCH  /api/crisis-protocols/:id       # Update protocol

GET    /api/care-analytics             # Dashboard analytics
GET    /api/care-analytics/trends      # Trend data over time
GET    /api/care-analytics/categories  # Category breakdown
```

### AI Chat Endpoint Flow

```
POST /api/conversations/:id/messages
  Body: { content: "User's message" }

  Server flow:
  1. Save user message to conversation_messages
  2. Load conversation context (all messages, help request, persona config)
  3. Load leader's knowledge base (relevant entries via embedding similarity)
  4. Build AI prompt:
     - System: persona.systemPrompt + tone config + boundaries
     - Context: knowledge base excerpts + conversation history
     - User: latest message
  5. Run crisis detection on user message
     - If crisis detected → trigger crisis protocol, add safety resources
  6. Call AI model (Google GenAI / configurable)
  7. Check AI confidence score
     - Below threshold → flag for review
  8. Save AI response to conversation_messages
  9. Return AI response + metadata
```

---

## Integration with Existing CRM

### Dashboard Widget

Add a "Pastoral Care" summary widget to the existing `Dashboard.tsx`:

```typescript
// New widget for the main dashboard
interface PastoralCareWidgetProps {
  activeConversations: number;
  waitingEscalations: number;
  crisisAlerts: number;
  resolvedToday: number;
  onViewAll: () => void;
}
```

**Placement:** Below the existing stat cards, alongside Birthday and Giving widgets.

### Navigation

Add to sidebar:
```
📋 Pastoral Care
  ├── Dashboard
  ├── Conversations
  ├── Leaders & Personas
  ├── Knowledge Base
  └── Analytics
```

### Task Integration

When a conversation is escalated or a follow-up is scheduled, automatically create a Task:

```typescript
// Auto-created task from pastoral care
const followUpTask: Task = {
  id: generateId(),
  personId: conversation.personId,       // If known
  title: `Follow up: ${conversation.category} conversation`,
  description: `Escalated conversation. Reason: ${metadata.escalationReason}`,
  dueDate: metadata.followUpScheduled || tomorrow(),
  completed: false,
  priority: conversation.priority === 'crisis' ? 'high' : 'medium',
  assignedTo: conversation.leaderId,
  category: 'care',
  createdAt: new Date().toISOString(),
};
```

### Agent Integration

Create a new `PastoralCareAgent` extending the existing `BaseAgent`:

```typescript
class PastoralCareAgent extends BaseAgent {
  // Monitors conversations for:
  // - Unanswered escalations (notify leader again after X minutes)
  // - Scheduled follow-ups due today
  // - Conversation quality (low ratings trigger review)
  // - Weekly summary generation for leaders
}
```

---

## Styling & UX Notes

### Design Principles

1. **Calming palette** — Soft blues, greens, warm neutrals. No harsh reds except crisis.
2. **Minimal chrome** — The chat interface should feel personal, not clinical.
3. **Accessibility** — WCAG 2.1 AA minimum. Large touch targets for mobile.
4. **Dark mode** — Full support via existing Tailwind dark mode system.
5. **Mobile-first** — Chat interface must work well on phones (most users will be on mobile).

### Priority Color Coding

| Priority | Color | Tailwind Class |
|----------|-------|----------------|
| Crisis | Red | `bg-red-500 text-white` |
| High | Orange | `bg-orange-500 text-white` |
| Medium | Blue | `bg-blue-500 text-white` |
| Low | Gray | `bg-gray-400 text-white` |

### Status Indicators

| Status | Icon | Color |
|--------|------|-------|
| Active (AI) | `Bot` | Green |
| Active (Human) | `User` | Blue |
| Waiting | `Clock` | Yellow |
| Escalated | `AlertTriangle` | Orange |
| Crisis | `AlertCircle` | Red (pulsing) |
| Resolved | `CheckCircle` | Gray |

---

## Security Considerations

### Authentication & Authorization

- **Help intake form:** No auth required (anonymous access)
- **Chat interface:** Session-based (anonymous ID or authenticated)
- **Staff dashboard:** Requires Clerk auth + staff/leader role
- **Leader profiles:** Requires Clerk auth + admin role to create, leader role to edit own
- **Analytics:** Requires Clerk auth + admin role
- **Crisis protocols:** Requires Clerk auth + admin role

### Data Protection

- All messages encrypted at rest (Supabase default + column-level encryption for sensitive content)
- Row Level Security (RLS) policies on all pastoral care tables
- Leaders can only access conversations assigned to them (unless admin)
- Anonymous conversations cannot be linked to identified users without explicit consent
- Audit log for all staff actions on conversations
- Data retention policy: configurable per church (default 2 years, then archive)

### Content Safety

- AI responses filtered for harmful content before delivery
- Crisis keywords maintained and updated regularly
- AI never provides medical, legal, or psychiatric advice
- Clear disclaimers in every conversation footer
- Mandatory staff review for flagged conversations within 24 hours

---

## Implementation Priority

### Sprint 1: Data Layer

- [ ] Add new types to `src/types.ts`
- [ ] Create Supabase migration for pastoral care tables
- [ ] Set up RLS policies
- [ ] Create API routes for CRUD operations
- [ ] Add pastoral care views to `View` type

### Sprint 2: Help Intake

- [ ] `HelpIntakeForm` component
- [ ] `HelpCategorySelector` component
- [ ] Anonymous ID generation utility
- [ ] Help request creation and routing logic
- [ ] Basic notification (email) when help request created

### Sprint 3: AI Chat

- [ ] `ConversationDetail` component
- [ ] `ConversationMessage` component
- [ ] `ChatInput` component
- [ ] AI persona prompt building service
- [ ] Conversation storage and retrieval
- [ ] Basic crisis keyword detection

### Sprint 4: Leader Management

- [ ] `LeaderProfileEditor` component
- [ ] `PersonaBuilder` wizard (all 7 steps)
- [ ] `PersonaToneCalibrator` component
- [ ] `PersonaTestChat` component
- [ ] Knowledge base upload

### Sprint 5: Dashboard & Live Features

- [ ] `PastoralCareDashboard` component
- [ ] `ConversationList` with filters
- [ ] Live takeover functionality
- [ ] `CrisisAlert` component
- [ ] Pastoral care widget on main dashboard
- [ ] `PastoralCareAgent` for automation

---

*Document created: February 2026*
*Companion to: [PRODUCT_VISION.md](./PRODUCT_VISION.md)*
