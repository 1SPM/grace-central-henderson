# AI Messaging, Content Planning & Day Planner Implementation Plan

## Overview

This document outlines the implementation plan for three major features:
1. **Content Calendar** - Visual scheduling of all outgoing messages
2. **AI Day Planner** - Daily task digest with AI-generated priorities
3. **Reply Handling** - AI-powered inbox for processing responses

---

## Phase 1: Database Schema (Foundation)

### New Tables Required

```sql
-- 1. Scheduled Messages Table
-- Stores all planned/scheduled outgoing messages
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  person_id UUID REFERENCES people(id),

  -- Message content
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed', 'cancelled')),

  -- Source tracking
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('manual', 'drip_campaign', 'birthday', 'anniversary', 'donation', 'follow_up', 'ai_generated')),
  source_agent VARCHAR(50),
  campaign_id UUID,

  -- AI metadata
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,

  -- Tracking
  external_message_id VARCHAR(255),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Message Archive Table
-- Historical record of all sent messages
CREATE TABLE message_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  person_id UUID REFERENCES people(id),
  scheduled_message_id UUID REFERENCES scheduled_messages(id),

  -- Message details
  channel VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- Delivery info
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Provider info
  provider VARCHAR(20) CHECK (provider IN ('resend', 'twilio')),
  external_id VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Inbound Messages Table
-- Stores replies and incoming messages
CREATE TABLE inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  person_id UUID REFERENCES people(id),

  -- Message content
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms')),
  from_address VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- AI classification
  ai_category VARCHAR(30) CHECK (ai_category IN ('question', 'thanks', 'concern', 'prayer_request', 'event_rsvp', 'unsubscribe', 'spam', 'other')),
  ai_sentiment VARCHAR(20) CHECK (ai_sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  ai_suggested_response TEXT,
  ai_confidence DECIMAL(3,2),

  -- Status
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived', 'flagged')),
  replied_at TIMESTAMPTZ,
  replied_by UUID,

  -- Linking
  in_reply_to UUID REFERENCES message_archive(id),

  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Daily Digest Table
-- Stores AI-generated daily summaries
CREATE TABLE daily_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  user_id UUID,

  -- Content
  digest_date DATE NOT NULL,
  priority_tasks JSONB NOT NULL DEFAULT '[]',
  people_to_contact JSONB NOT NULL DEFAULT '[]',
  messages_to_send JSONB NOT NULL DEFAULT '[]',
  birthdays_today JSONB NOT NULL DEFAULT '[]',
  follow_ups_due JSONB NOT NULL DEFAULT '[]',

  -- AI insights
  ai_summary TEXT,
  ai_recommendations JSONB DEFAULT '[]',

  -- Status
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,

  UNIQUE(church_id, user_id, digest_date)
);

-- Indexes for performance
CREATE INDEX idx_scheduled_messages_church_date ON scheduled_messages(church_id, scheduled_for);
CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status) WHERE status = 'scheduled';
CREATE INDEX idx_message_archive_church_person ON message_archive(church_id, person_id);
CREATE INDEX idx_inbound_messages_status ON inbound_messages(status) WHERE status = 'new';
CREATE INDEX idx_daily_digests_lookup ON daily_digests(church_id, user_id, digest_date);
```

### How to Test Schema
```bash
# 1. Create migration file
cp this_content > supabase/migrations/003_ai_messaging_system.sql

# 2. Apply migration locally
npx supabase db reset

# 3. Verify tables exist
npx supabase db dump --local | grep -E "(scheduled_messages|message_archive|inbound_messages|daily_digests)"
```

---

## Phase 2: Content Calendar Component

### File: `src/components/ContentCalendar.tsx`

```typescript
// Key features to implement:
// 1. Monthly calendar view with scheduled messages as events
// 2. Color coding by message type (birthday, drip, manual, etc.)
// 3. Click to view/edit message details
// 4. Drag-and-drop to reschedule
// 5. Quick-add button for new scheduled messages
// 6. Filter by channel (email/sms) and type
```

### Implementation Steps

1. **Create ContentCalendar component** (`src/components/ContentCalendar.tsx`)
   - Use existing CalendarEvent pattern from types.ts as reference
   - Build grid layout with days of month
   - Fetch scheduled_messages for date range

2. **Create ScheduledMessageCard component** (`src/components/ScheduledMessageCard.tsx`)
   - Shows preview of message
   - Edit/delete/send now actions
   - Status badge (scheduled/sent/failed)

3. **Create ScheduleMessageModal component** (`src/components/ScheduleMessageModal.tsx`)
   - Person selector
   - Channel picker (email/sms/both)
   - Date/time picker
   - AI generate button
   - Template selector

4. **Create useScheduledMessages hook** (`src/hooks/useScheduledMessages.ts`)
   - CRUD operations for scheduled_messages
   - Real-time updates via Supabase subscription
   - Filter/sort utilities

### Testing Plan

```typescript
// Test file: src/__tests__/ContentCalendar.test.tsx

describe('ContentCalendar', () => {
  it('renders current month with correct days');
  it('displays scheduled messages on correct dates');
  it('allows clicking message to open edit modal');
  it('supports drag-drop to reschedule');
  it('filters by message type');
  it('shows "Send Now" for past scheduled messages');
});

// Manual testing checklist:
// [ ] Navigate between months
// [ ] Create new scheduled message
// [ ] Edit existing scheduled message
// [ ] Delete scheduled message
// [ ] Reschedule via drag-drop
// [ ] Filter by email/sms
// [ ] AI generate message content
// [ ] View message preview
```

---

## Phase 3: AI Day Planner Agent

### File: `src/lib/agents/DayPlannerAgent.ts`

```typescript
/**
 * DayPlannerAgent
 *
 * Generates a prioritized daily digest including:
 * - Today's tasks (sorted by priority)
 * - People to contact (follow-ups due, new visitors)
 * - Messages ready to send
 * - Birthdays & anniversaries today
 * - AI-generated recommendations
 */

export interface DailyDigest {
  date: Date;
  priorityTasks: TaskItem[];
  peopleToContact: ContactItem[];
  scheduledMessages: MessageItem[];
  celebrations: CelebrationItem[];
  aiSummary: string;
  aiRecommendations: string[];
}

export interface DayPlannerConfig extends AgentConfig {
  settings: {
    includeTasksByPriority: boolean;
    lookAheadDays: number;
    maxContactsPerDay: number;
    generateAISummary: boolean;
    sendDigestEmail: boolean;
    digestEmailTime: string; // "07:00"
  };
}
```

### Implementation Steps

1. **Create DayPlannerAgent class** (`src/lib/agents/DayPlannerAgent.ts`)
   - Extends BaseAgent
   - Collects data from tasks, people, scheduled_messages
   - Calls AI for summary and recommendations
   - Returns structured DailyDigest

2. **Create AI prompt functions** (add to `src/lib/services/ai.ts`)
   ```typescript
   export async function generateDailySummary(digest: DailyDigestInput): Promise<AIGenerateResult>;
   export async function generateContactPriorities(contacts: ContactItem[]): Promise<AIGenerateResult>;
   export async function generateTalkingPoints(person: Person, context: string): Promise<AIGenerateResult>;
   ```

3. **Create DailyDigestPanel component** (`src/components/DailyDigestPanel.tsx`)
   - "Good morning" greeting with date
   - Priority task list with checkboxes
   - People to contact with one-click actions
   - Upcoming messages summary
   - AI insights section

4. **Add to Dashboard** - Display digest on main dashboard

### Testing Plan

```typescript
// Test file: src/__tests__/DayPlannerAgent.test.ts

describe('DayPlannerAgent', () => {
  it('collects tasks due today');
  it('identifies people needing follow-up');
  it('includes birthdays for today');
  it('sorts contacts by priority');
  it('generates AI summary when enabled');
  it('respects maxContactsPerDay limit');
});

// Manual testing checklist:
// [ ] Run agent and verify digest content
// [ ] Check AI summary makes sense
// [ ] Verify all birthdays today are included
// [ ] Confirm overdue tasks appear
// [ ] Test "Contact Now" actions work
// [ ] Verify email digest sends at configured time
```

---

## Phase 4: Reply Handling System

### Architecture

```
[Inbound Message] → [Webhook Endpoint] → [AI Classifier] → [Inbox UI]
                                              ↓
                                    [AI Suggested Response]
                                              ↓
                                    [Staff Review/Edit]
                                              ↓
                                    [Send Response]
```

### Implementation Steps

1. **Create Webhook Endpoints**

   ```typescript
   // api/_routes/webhooks/email-reply.ts
   // Receives email replies from Resend webhook

   // api/_routes/webhooks/sms-reply.ts
   // Receives SMS replies from Twilio webhook
   ```

2. **Create AI Classifier Service** (`src/lib/services/messageClassifier.ts`)
   ```typescript
   export async function classifyInboundMessage(message: {
     body: string;
     from: string;
     subject?: string;
   }): Promise<{
     category: 'question' | 'thanks' | 'concern' | 'prayer_request' | 'event_rsvp' | 'unsubscribe' | 'spam' | 'other';
     sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
     suggestedResponse: string;
     confidence: number;
   }>;
   ```

3. **Create MessageInbox component** (`src/components/MessageInbox.tsx`)
   - List of inbound messages with status filters
   - AI classification badges
   - Suggested response preview
   - One-click approve & send
   - Edit response before sending

4. **Create ReplyComposer component** (`src/components/ReplyComposer.tsx`)
   - Shows original message thread
   - AI-suggested response (editable)
   - Regenerate response button
   - Send via email/sms toggle

5. **Create useInbox hook** (`src/hooks/useInbox.ts`)
   - Fetch/filter inbound messages
   - Mark as read/replied/archived
   - Send responses

### AI Prompts for Classification

```typescript
// Add to src/lib/services/ai.ts

export async function classifyMessage(body: string): Promise<AIGenerateResult> {
  return generateAIText({
    prompt: `Classify this incoming message from a church member:

"${body}"

Respond with JSON only:
{
  "category": "question|thanks|concern|prayer_request|event_rsvp|unsubscribe|other",
  "sentiment": "positive|neutral|negative|urgent",
  "summary": "One sentence summary",
  "suggestedAction": "Brief suggested response approach"
}`,
    maxTokens: 200,
  });
}

export async function generateReplyDraft(
  originalMessage: string,
  category: string,
  personName: string,
  churchName: string
): Promise<AIGenerateResult> {
  return generateAIText({
    prompt: `Write a warm, helpful reply to this ${category} from ${personName}:

"${originalMessage}"

Reply on behalf of ${churchName}. Keep it under 100 words, friendly, and actionable if needed.`,
    maxTokens: 256,
  });
}
```

### Testing Plan

```typescript
// Test file: src/__tests__/messageClassifier.test.ts

describe('Message Classifier', () => {
  it('classifies "thank you" messages correctly');
  it('identifies prayer requests');
  it('detects urgent/negative sentiment');
  it('recognizes event RSVPs');
  it('handles unsubscribe requests');
  it('generates appropriate response drafts');
});

// Webhook tests: src/__tests__/webhooks.test.ts
describe('Inbound Webhooks', () => {
  it('processes Resend email webhook payload');
  it('processes Twilio SMS webhook payload');
  it('creates inbound_message record');
  it('triggers AI classification');
  it('matches reply to original message');
});

// Manual testing checklist:
// [ ] Send test email, verify it appears in inbox
// [ ] Send test SMS, verify it appears in inbox
// [ ] Check AI classification accuracy
// [ ] Review and edit suggested response
// [ ] Send response via email
// [ ] Send response via SMS
// [ ] Archive processed messages
// [ ] Filter by category/status
```

---

## Phase 5: Integration & Polish

### Connect Everything

1. **Update AgentDashboard** to include new agents
2. **Add Content Calendar to navigation** (View type: 'content-calendar')
3. **Add Message Inbox to navigation** (View type: 'inbox')
4. **Update Dashboard** with Daily Digest widget
5. **Configure webhooks** in Resend and Twilio dashboards

### Environment Variables Needed

```env
# Webhooks (for reply handling)
RESEND_WEBHOOK_SECRET=whsec_xxx
TWILIO_AUTH_TOKEN=xxx  # For webhook validation

# Optional: Analytics
ENABLE_MESSAGE_ANALYTICS=true
```

---

## Testing Strategy Summary

### Unit Tests
| Component | Test File | Key Tests |
|-----------|-----------|-----------|
| ContentCalendar | `ContentCalendar.test.tsx` | Render, navigation, CRUD |
| DayPlannerAgent | `DayPlannerAgent.test.ts` | Data collection, AI calls |
| MessageClassifier | `messageClassifier.test.ts` | Classification accuracy |
| ScheduledMessages | `useScheduledMessages.test.ts` | Hook operations |

### Integration Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- ContentCalendar

# Run with coverage
npm test -- --coverage
```

### Manual Testing Checklist

#### Content Calendar
- [ ] View calendar with existing scheduled messages
- [ ] Create new scheduled message
- [ ] Edit scheduled message
- [ ] Delete scheduled message
- [ ] Reschedule via drag-drop
- [ ] Filter by type/channel
- [ ] AI generate message content

#### Day Planner
- [ ] View daily digest on dashboard
- [ ] Verify all sections populated
- [ ] Click task to mark complete
- [ ] Click contact to open person page
- [ ] AI summary is relevant
- [ ] Email digest arrives on time

#### Reply Handling
- [ ] Receive email reply in inbox
- [ ] Receive SMS reply in inbox
- [ ] AI classification is accurate
- [ ] Edit suggested response
- [ ] Send response
- [ ] View conversation thread
- [ ] Archive processed messages

---

## Recommended Implementation Order

1. **Week 1: Database + Basic Calendar**
   - Create migration file
   - Apply schema
   - Build ContentCalendar component
   - Build useScheduledMessages hook

2. **Week 2: Day Planner**
   - Build DayPlannerAgent
   - Add AI summary functions
   - Build DailyDigestPanel
   - Add to dashboard

3. **Week 3: Reply Handling**
   - Set up webhook endpoints
   - Build message classifier
   - Build MessageInbox component
   - Build ReplyComposer

4. **Week 4: Polish & Testing**
   - Write unit tests
   - Manual testing
   - Bug fixes
   - Documentation

---

## Quick Start Commands

```bash
# 1. Create the migration
cat > supabase/migrations/003_ai_messaging_system.sql << 'EOF'
-- Paste schema from Phase 1
EOF

# 2. Apply migration
npx supabase db reset

# 3. Generate types
npx supabase gen types typescript --local > src/lib/database.types.ts

# 4. Run dev server
npm run dev

# 5. Run tests
npm test
```

---

## Questions Before Starting

1. **Webhook hosting**: Where will webhooks be hosted? (Vercel, AWS, etc.)
2. **Resend plan**: Does current plan support inbound email webhooks?
3. **Twilio setup**: Is Twilio already configured for two-way SMS?
4. **Priority**: Which feature is most important to start with?
