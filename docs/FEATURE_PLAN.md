# GRACE CRM Feature Implementation Plan

This document outlines the implementation plan for new church management features.

---

## Table of Contents

1. [Font Size in Settings](#1-font-size-in-settings)
2. [Weekly Charity Baskets](#2-weekly-charity-baskets)
3. [Donation Tracker Enhancements](#3-donation-tracker-enhancements)
4. [Agent Dashboard](#4-agent-dashboard)
5. [Sermon Programming](#5-sermon-programming)
6. [Funeral & Final Services](#6-funeral--final-services)
7. [Ceremony Services & Weddings](#7-ceremony-services--weddings)
8. [Estate Planning](#8-estate-planning)
9. [Calendar Enhancements](#9-calendar-enhancements)
10. [Member Portal Merch Page](#10-member-portal-merch-page)

---

## 1. Font Size in Settings

**Priority:** High (Accessibility)
**Complexity:** Low
**Estimated Files:** 2-3

### Description
Add an accessibility section to Settings allowing users to adjust the global font size for better readability.

### Implementation Details

#### Files to Create/Modify
- `src/components/Settings.tsx` - Add Accessibility section
- `src/contexts/AccessibilityContext.tsx` - New context for font size state
- `src/App.tsx` - Wrap app with AccessibilityProvider

#### Data Model
```typescript
interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  highContrast?: boolean;
  reduceMotion?: boolean;
}
```

#### UI Design
```
┌─────────────────────────────────────────────┐
│ 👁 Accessibility                            │
│ Customize display settings                  │
├─────────────────────────────────────────────┤
│ Font Size                                   │
│ ┌───────────────────────────────────────┐   │
│ │  Small   Medium   Large   X-Large     │   │
│ │           [●]                         │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ Preview: The quick brown fox...             │
└─────────────────────────────────────────────┘
```

#### Font Size Values
| Size    | Base  | Headings |
|---------|-------|----------|
| Small   | 14px  | 1.5x     |
| Medium  | 16px  | 1.5x     |
| Large   | 18px  | 1.5x     |
| X-Large | 20px  | 1.5x     |

#### Storage
- Save to `localStorage` for persistence
- Key: `grace-crm-accessibility`

---

## 2. Weekly Charity Baskets

**Priority:** Medium
**Complexity:** Medium
**Estimated Files:** 3-4

### Description
Enhance the existing CharityBaskets feature with weekly scheduling, templates, and automated basket creation.

### Implementation Details

#### Files to Create/Modify
- `src/components/CharityBaskets.tsx` - Add weekly scheduling UI
- `src/components/BasketTemplates.tsx` - New: Reusable basket templates
- `src/components/WeeklyBasketScheduler.tsx` - New: Calendar-based scheduler
- `src/types.ts` - Add new types

#### New Types
```typescript
interface BasketTemplate {
  id: string;
  name: string;
  type: BasketType;
  defaultItems: Omit<BasketItem, 'id' | 'basketId' | 'donatedAt'>[];
  description?: string;
  estimatedValue?: number;
}

interface WeeklyBasketSchedule {
  id: string;
  templateId?: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday = 0
  recipientCriteria?: 'rotation' | 'needs-based' | 'manual';
  isActive: boolean;
  lastGenerated?: string;
  nextGenerated?: string;
}
```

#### Features
1. **Basket Templates**
   - Pre-defined item lists for common basket types
   - Food basket, Holiday basket, Baby shower, etc.
   - One-click basket creation from template

2. **Weekly Scheduler**
   - Set recurring basket creation
   - Auto-assign recipients based on need or rotation
   - Dashboard widget showing upcoming baskets

3. **Inventory Integration**
   - Track available inventory
   - Alert when items are low
   - Suggest substitutions

#### UI Flow
```
Templates → Schedule → Auto-Generate → Review → Distribute
```

---

## 3. Donation Tracker Enhancements

**Priority:** Medium
**Complexity:** Low
**Estimated Files:** 1-2

### Description
The DonationTracker already exists. Enhance with better analytics, goal tracking, and reporting.

### Implementation Details

#### Files to Modify
- `src/components/DonationTracker.tsx` - Add new visualizations
- `src/components/GivingDashboard.tsx` - Add goal widgets

#### New Features
1. **Donation Goals**
   ```typescript
   interface DonationGoal {
     id: string;
     name: string;
     targetAmount: number;
     currentAmount: number;
     startDate: string;
     endDate: string;
     fund?: string;
     isPublic: boolean; // Show on member portal
   }
   ```

2. **Enhanced Analytics**
   - Year-over-year comparison charts
   - Donor retention metrics
   - First-time donor tracking
   - Lapsed donor alerts

3. **Export Features**
   - PDF reports
   - CSV export with filters
   - Giving statements batch generation

---

## 4. Agent Dashboard

**Priority:** High
**Complexity:** Medium
**Estimated Files:** 4-5

### Description
A centralized dashboard for managing AI agents that handle various church operations like follow-ups, sermon prep, and member care.

### Implementation Details

#### Files to Create
- `src/components/AgentDashboard.tsx` - Main dashboard
- `src/components/AgentCard.tsx` - Individual agent display
- `src/components/AgentConfigModal.tsx` - Configure agents
- `src/components/AgentActivityLog.tsx` - View agent actions

#### Data Model
```typescript
type AgentType =
  | 'visitor-followup'
  | 'sermon-prep'
  | 'prayer-response'
  | 'event-coordinator'
  | 'member-care'
  | 'giving-thank-you';

interface Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  isActive: boolean;
  config: AgentConfig;
  lastRun?: string;
  nextRun?: string;
  stats: AgentStats;
}

interface AgentConfig {
  schedule?: 'realtime' | 'hourly' | 'daily' | 'weekly';
  triggers?: string[];
  templates?: string[];
  approvalRequired: boolean;
}

interface AgentStats {
  tasksCompleted: number;
  lastWeekActivity: number;
  successRate: number;
}

interface AgentActivity {
  id: string;
  agentId: string;
  action: string;
  target?: string;
  result: 'success' | 'pending' | 'failed';
  timestamp: string;
  details?: string;
}
```

#### UI Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Agent Dashboard                           [+ Add Agent]     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ 🤖 Follow-up    │ │ 📖 Sermon Prep  │ │ 🙏 Prayer       │ │
│ │ Agent           │ │ Agent           │ │ Response        │ │
│ │                 │ │                 │ │                 │ │
│ │ ● Active        │ │ ○ Paused        │ │ ● Active        │ │
│ │ 12 tasks today  │ │ Next: Sunday    │ │ 3 pending       │ │
│ │ [Configure]     │ │ [Configure]     │ │ [Configure]     │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Recent Activity                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✓ Follow-up Agent sent welcome email to John D.        │ │
│ │ ✓ Prayer Agent created task for Pastor re: Mary S.     │ │
│ │ ⏳ Sermon Prep gathering scripture for next Sunday      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Navigation
- Add to sidebar under a new "AI Tools" section
- Or add as a tab under Dashboard

---

## 5. Sermon Programming

**Priority:** High
**Complexity:** High
**Estimated Files:** 6-8

### Description
A comprehensive sermon planning and preparation tool with AI assistance, series management, and service order templates.

### Implementation Details

#### Files to Create
- `src/components/SermonPlanner.tsx` - Main sermon planning page
- `src/components/SermonEditor.tsx` - Rich text sermon editor
- `src/components/SermonSeries.tsx` - Manage sermon series
- `src/components/ServiceOrder.tsx` - Build service run sheets
- `src/components/SermonArchive.tsx` - Past sermons searchable
- `src/components/SermonAIAssistant.tsx` - AI helper sidebar

#### Data Model
```typescript
interface Sermon {
  id: string;
  title: string;
  date: string;
  speaker: string;
  seriesId?: string;
  scriptures: Scripture[];
  outline: SermonOutline;
  notes?: string;
  status: 'draft' | 'ready' | 'delivered' | 'archived';
  duration?: number; // minutes
  recordingUrl?: string;
  slidesUrl?: string;
  handoutUrl?: string;
  tags: string[];
}

interface Scripture {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  translation: string;
  text?: string;
}

interface SermonOutline {
  introduction: string;
  points: SermonPoint[];
  conclusion: string;
  applications: string[];
}

interface SermonPoint {
  id: string;
  title: string;
  content: string;
  scriptures?: Scripture[];
  illustrations?: string[];
  order: number;
}

interface SermonSeries {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  imageUrl?: string;
  sermonIds: string[];
  isActive: boolean;
}

interface ServiceOrder {
  id: string;
  date: string;
  serviceName: string; // "Sunday AM", "Sunday PM", etc.
  items: ServiceOrderItem[];
  notes?: string;
  sermonId?: string;
}

interface ServiceOrderItem {
  id: string;
  order: number;
  type: 'welcome' | 'song' | 'prayer' | 'scripture' | 'announcement' |
        'sermon' | 'offering' | 'communion' | 'benediction' | 'other';
  title: string;
  leader?: string;
  duration?: number;
  notes?: string;
  songDetails?: {
    title: string;
    artist?: string;
    key?: string;
    ccliNumber?: string;
  };
}
```

#### UI Sections

**1. Sermon Calendar View**
- Monthly/weekly view of upcoming sermons
- Drag-drop to reschedule
- Color-coded by series

**2. Sermon Editor**
```
┌──────────────────────────────────────────────────────────────────┐
│ Sermon: "Faith in Action"          [Save Draft] [Mark Ready]    │
├────────────────────────────────────────┬─────────────────────────┤
│ Date: Feb 9, 2025    Speaker: Pastor J │ AI Assistant            │
│ Series: [James Series        ▼]        │ ┌─────────────────────┐ │
│                                        │ │ 💡 Suggestions      │ │
│ ┌────────────────────────────────────┐ │ │                     │ │
│ │ Scriptures                         │ │ │ • Add illustration  │ │
│ │ + James 2:14-26                    │ │ │   about faith       │ │
│ │ + Hebrews 11:1                     │ │ │ • Cross-reference:  │ │
│ └────────────────────────────────────┘ │ │   Romans 4:3        │ │
│                                        │ │ • Story idea:       │ │
│ ┌────────────────────────────────────┐ │ │   George Mueller    │ │
│ │ Outline                            │ │ │                     │ │
│ │ ┌────────────────────────────────┐ │ │ │ [Generate More]     │ │
│ │ │ Introduction                   │ │ │ └─────────────────────┘ │
│ │ │ What is real faith?            │ │ │                         │
│ │ └────────────────────────────────┘ │ │                         │
│ │ ┌────────────────────────────────┐ │ │                         │
│ │ │ 1. Faith Without Works         │ │ │                         │
│ │ │    is Dead (v.14-17)           │ │ │                         │
│ │ └────────────────────────────────┘ │ │                         │
│ │ ┌────────────────────────────────┐ │ │                         │
│ │ │ 2. Examples of Living Faith    │ │ │                         │
│ │ │    (v.21-25)                   │ │ │                         │
│ │ └────────────────────────────────┘ │ │                         │
│ │ + Add Point                        │ │                         │
│ └────────────────────────────────────┘ │                         │
└────────────────────────────────────────┴─────────────────────────┘
```

**3. Service Order Builder**
- Drag-drop service elements
- Time tracking (total duration)
- Print/export for worship team

---

## 6. Funeral & Final Services

**Priority:** High
**Complexity:** High
**Estimated Files:** 5-6

### Description
Manage funeral services, memorial planning, and bereavement care with sensitivity and organization.

### Implementation Details

#### Files to Create
- `src/components/FuneralServices.tsx` - Main management page
- `src/components/FuneralPlanner.tsx` - Individual funeral planning
- `src/components/MemorialPage.tsx` - Public memorial tribute
- `src/components/BereavementCare.tsx` - Follow-up care tracking
- `src/components/FuneralChecklist.tsx` - Standard checklist

#### Data Model
```typescript
interface FuneralService {
  id: string;
  deceasedId?: string; // Link to Person if member
  deceasedName: string;
  deceasedPhoto?: string;
  dateOfBirth?: string;
  dateOfDeath: string;
  serviceDate?: string;
  serviceTime?: string;
  serviceLocation?: string;
  officiant?: string;
  status: 'planning' | 'scheduled' | 'completed';

  // Service details
  type: 'funeral' | 'memorial' | 'graveside' | 'celebration-of-life';
  hasViewing: boolean;
  viewingDate?: string;
  viewingLocation?: string;
  receptionAfter: boolean;
  receptionLocation?: string;

  // Planning
  familyContactId?: string;
  familyContactName?: string;
  familyContactPhone?: string;
  funeralHome?: string;
  cemetery?: string;

  // Content
  obituary?: string;
  eulogies?: Eulogy[];
  scriptures?: Scripture[];
  songs?: string[];
  serviceOrder?: ServiceOrderItem[];
  specialRequests?: string;

  // Logistics
  flowers?: string;
  catering?: string;
  avNeeds?: string;

  // Follow-up
  bereavementTasks?: Task[];
  memorialFund?: string;

  createdAt: string;
  updatedAt: string;
}

interface Eulogy {
  id: string;
  speakerName: string;
  relationship: string;
  content?: string;
  duration?: number;
  order: number;
}

interface BereavementFollowUp {
  id: string;
  funeralId: string;
  familyMemberId?: string;
  familyMemberName: string;
  scheduledDate: string;
  type: 'call' | 'visit' | 'card' | 'meal';
  assignedTo?: string;
  completed: boolean;
  notes?: string;
}
```

#### UI Sections

**1. Funeral Dashboard**
```
┌─────────────────────────────────────────────────────────────┐
│ Funeral & Memorial Services              [+ New Service]    │
├─────────────────────────────────────────────────────────────┤
│ Upcoming                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🕊 John Smith Memorial                                  │ │
│ │   Feb 15, 2025 at 2:00 PM • Main Sanctuary             │ │
│ │   Status: Planning    [View Details]                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Bereavement Follow-ups Due                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ □ Call Mary Smith (widow) - 1 week follow-up           │ │
│ │ □ Send card to Smith family - 1 month                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**2. Funeral Planner**
- Step-by-step wizard
- Checklist with timeline
- Document generation (program, obituary)
- Integration with calendar

**3. Memorial Tribute Page**
- Public shareable page
- Photo gallery
- Guestbook/condolences
- Donation link to memorial fund

---

## 7. Ceremony Services & Weddings

**Priority:** High
**Complexity:** High
**Estimated Files:** 6-7

### Description
Comprehensive wedding and ceremony management including premarital counseling tracking, ceremony planning, and vendor coordination.

### Implementation Details

#### Files to Create
- `src/components/CeremonyServices.tsx` - Main ceremonies page
- `src/components/WeddingPlanner.tsx` - Wedding planning wizard
- `src/components/PremaritalCounseling.tsx` - Counseling session tracker
- `src/components/CeremonyBuilder.tsx` - Build ceremony script
- `src/components/WeddingChecklist.tsx` - Planning checklist
- `src/components/VendorDirectory.tsx` - Preferred vendors

#### Data Model
```typescript
type CeremonyType = 'wedding' | 'vow-renewal' | 'baby-dedication' |
                    'baptism' | 'confirmation' | 'ordination' | 'other';

interface Ceremony {
  id: string;
  type: CeremonyType;
  title: string;
  date?: string;
  time?: string;
  location?: string;
  officiant?: string;
  status: 'inquiry' | 'planning' | 'scheduled' | 'completed' | 'cancelled';
  participants: CeremonyParticipant[];
  notes?: string;
  createdAt: string;
}

interface CeremonyParticipant {
  id: string;
  personId?: string;
  name: string;
  role: string; // "Bride", "Groom", "Parent", "Child", etc.
  email?: string;
  phone?: string;
}

// Wedding-specific
interface Wedding extends Ceremony {
  type: 'wedding';

  // Couple info
  partner1Id?: string;
  partner1Name: string;
  partner2Id?: string;
  partner2Name: string;

  // Planning
  inquiryDate: string;
  engagementDate?: string;
  weddingDate?: string;
  rehearsalDate?: string;
  rehearsalTime?: string;
  rehearsalLocation?: string;

  // Ceremony details
  ceremonyStyle: 'traditional' | 'contemporary' | 'blended' | 'custom';
  estimatedGuests?: number;
  ceremonyScript?: CeremonyScript;

  // Counseling
  counselingSessions: CounselingSession[];
  counselingComplete: boolean;

  // Wedding party
  weddingParty: WeddingPartyMember[];

  // Logistics
  receptionLocation?: string;
  photographer?: string;
  florist?: string;
  caterer?: string;
  musicProvider?: string;

  // Documents
  marriageLicenseReceived: boolean;
  marriageLicenseDate?: string;
  certificateSigned: boolean;

  // Fees
  facilityFee?: number;
  officiantFee?: number;
  depositPaid: boolean;
  depositAmount?: number;
  balanceDue?: number;
  balancePaid: boolean;
}

interface CounselingSession {
  id: string;
  weddingId: string;
  sessionNumber: number;
  date: string;
  topic: string;
  counselor: string;
  completed: boolean;
  notes?: string;
  homework?: string;
}

interface WeddingPartyMember {
  id: string;
  name: string;
  role: 'best-man' | 'maid-of-honor' | 'groomsman' | 'bridesmaid' |
        'flower-girl' | 'ring-bearer' | 'usher' | 'reader' | 'other';
  email?: string;
  phone?: string;
}

interface CeremonyScript {
  id: string;
  sections: CeremonySection[];
}

interface CeremonySection {
  id: string;
  type: 'processional' | 'welcome' | 'reading' | 'homily' | 'vows' |
        'rings' | 'unity-ceremony' | 'pronouncement' | 'kiss' |
        'presentation' | 'recessional' | 'other';
  title: string;
  content: string;
  speaker?: string;
  duration?: number;
  order: number;
}
```

#### UI Sections

**1. Ceremonies Dashboard**
```
┌─────────────────────────────────────────────────────────────┐
│ Ceremony Services                        [+ New Ceremony]   │
├─────────────────────────────────────────────────────────────┤
│ [All] [Weddings] [Baptisms] [Dedications] [Other]          │
├─────────────────────────────────────────────────────────────┤
│ Upcoming Ceremonies                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💒 Johnson & Smith Wedding                              │ │
│ │   March 15, 2025 at 3:00 PM • Main Sanctuary           │ │
│ │   Counseling: 4/6 sessions complete                     │ │
│ │   [View] [Edit] [Checklist]                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💧 Baby Thompson Dedication                             │ │
│ │   Feb 23, 2025 during Sunday Service                    │ │
│ │   [View] [Edit]                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**2. Wedding Planner Wizard**
- Multi-step form
- Progress tracking
- Document checklist
- Timeline generator

**3. Premarital Counseling Tracker**
- Session scheduling
- Topic curriculum
- Homework tracking
- Completion certificate

---

## 8. Estate Planning

**Priority:** Medium
**Complexity:** Medium
**Estimated Files:** 4-5

### Description
Help members with legacy planning including wills, bequests, and planned giving to the church.

### Implementation Details

#### Files to Create
- `src/components/EstatePlanning.tsx` - Main page
- `src/components/PlannedGiving.tsx` - Bequest tracking
- `src/components/LegacyCircle.tsx` - Donor recognition
- `src/components/EstateResources.tsx` - Educational resources

#### Data Model
```typescript
interface PlannedGift {
  id: string;
  donorId?: string;
  donorName: string;
  type: 'bequest' | 'beneficiary' | 'trust' | 'annuity' |
        'real-estate' | 'stock' | 'life-insurance' | 'other';
  estimatedValue?: number;
  designation?: string; // Where funds should go
  status: 'intention' | 'documented' | 'realized';
  dateNotified?: string;
  dateRealized?: string;
  notes?: string;
  isAnonymous: boolean;
  legacyCircleMember: boolean;
}

interface LegacyCircleMember {
  id: string;
  personId?: string;
  name: string;
  joinDate: string;
  recognitionLevel?: 'bronze' | 'silver' | 'gold' | 'platinum';
  plannedGiftIds: string[];
  testimonial?: string;
  photo?: string;
  isPublic: boolean;
}

interface EstateResource {
  id: string;
  title: string;
  type: 'article' | 'video' | 'document' | 'webinar' | 'link';
  description: string;
  url?: string;
  fileUrl?: string;
  category: 'wills' | 'trusts' | 'beneficiary' | 'tax' | 'general';
}
```

#### Features
1. **Planned Giving Portal**
   - Track bequest intentions
   - Donor communication log
   - Projected future revenue

2. **Legacy Circle**
   - Recognition program for planned givers
   - Public (opt-in) testimonials
   - Annual appreciation events

3. **Resource Library**
   - Educational materials
   - Partner attorney/advisor directory
   - FAQ section

---

## 9. Calendar Enhancements

**Priority:** High
**Complexity:** Medium
**Estimated Files:** 2-3

### Description
Expand calendar event types to include obituaries, weddings, baptisms, and other church milestones.

### Implementation Details

#### Files to Modify
- `src/types.ts` - Expand CalendarEvent category
- `src/components/Calendar.tsx` - Add new event styling
- `src/components/CalendarEventForm.tsx` - Update form

#### Updated Types
```typescript
// Expanded event categories
type EventCategory =
  | 'service'        // Regular services
  | 'meeting'        // Staff/committee meetings
  | 'event'          // General church events
  | 'small-group'    // Small group meetings
  | 'holiday'        // Church holidays
  | 'wedding'        // Weddings & rehearsals (new)
  | 'funeral'        // Funerals & memorials (new)
  | 'baptism'        // Baptisms (new)
  | 'dedication'     // Baby dedications (new)
  | 'counseling'     // Counseling appointments (new)
  | 'rehearsal'      // Music/drama rehearsals (new)
  | 'outreach'       // Community outreach (new)
  | 'class'          // Classes & training (new)
  | 'other';

// Extended CalendarEvent
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  location?: string;
  category: EventCategory;
  attendees?: string[];

  // New fields
  linkedEntityType?: 'wedding' | 'funeral' | 'sermon' | 'ceremony';
  linkedEntityId?: string;
  isPrivate?: boolean;
  color?: string; // Custom color override
  recurrence?: RecurrenceRule;
  reminders?: EventReminder[];
}

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: string;
  endAfterOccurrences?: number;
  daysOfWeek?: number[];
}

interface EventReminder {
  type: 'email' | 'sms' | 'notification';
  minutesBefore: number;
  recipients?: string[];
}
```

#### New Calendar Features
1. **Color-coded categories**
   - Weddings: Pink/Rose
   - Funerals: Gray/Purple
   - Baptisms: Blue
   - Dedications: Yellow

2. **Linked events**
   - Click wedding event → Open wedding planner
   - Click funeral event → Open funeral details

3. **Public/Private visibility**
   - Some events visible to all
   - Counseling sessions private

4. **Recurring events**
   - Weekly services auto-generate
   - Monthly meetings

---

## 10. Member Portal Merch Page

**Priority:** Medium
**Complexity:** Medium
**Estimated Files:** 4-5

### Description
Add a merchandise/store page to the member portal where members can browse and request church merchandise.

### Implementation Details

#### Files to Create
- `src/components/member/MemberMerchPage.tsx` - Main merch page
- `src/components/member/MerchCard.tsx` - Product display card
- `src/components/member/MerchCart.tsx` - Shopping cart
- `src/components/MerchManagement.tsx` - Admin: Manage products

#### Files to Modify
- `src/types.ts` - Add merch types and tab
- `src/components/member/MemberPortal.tsx` - Add merch tab
- `src/components/member/MemberLayout.tsx` - Add navigation

#### Data Model
```typescript
// Add to MemberPortalTab
type MemberPortalTab = 'directory' | 'giving' | 'events' | 'checkin' | 'merch';

interface MerchProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'apparel' | 'books' | 'music' | 'accessories' | 'other';
  images: string[];
  variants?: ProductVariant[];
  inStock: boolean;
  stockQuantity?: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
}

interface ProductVariant {
  id: string;
  name: string; // "Small", "Medium", "Blue", etc.
  type: 'size' | 'color' | 'other';
  priceAdjustment?: number;
  stockQuantity?: number;
  sku?: string;
}

interface MerchOrder {
  id: string;
  memberId?: string;
  memberName: string;
  memberEmail: string;
  items: OrderItem[];
  status: 'pending' | 'paid' | 'processing' | 'ready' | 'picked-up' | 'shipped' | 'cancelled';
  subtotal: number;
  tax?: number;
  total: number;
  paymentMethod?: 'stripe' | 'cash' | 'check';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  fulfillmentType: 'pickup' | 'ship';
  shippingAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
```

#### UI Design

**Member View**
```
┌─────────────────────────────────────────────────────────────┐
│ Church Store                              🛒 Cart (2)       │
├─────────────────────────────────────────────────────────────┤
│ [All] [Apparel] [Books] [Music] [Accessories]              │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│ │ [T-Shirt Img] │ │ [Mug Image]   │ │ [Book Image]  │      │
│ │               │ │               │ │               │      │
│ │ Grace Church  │ │ Grace Mug     │ │ Daily         │      │
│ │ T-Shirt       │ │               │ │ Devotional    │      │
│ │ $25.00        │ │ $15.00        │ │ $12.00        │      │
│ │ [Add to Cart] │ │ [Add to Cart] │ │ [Add to Cart] │      │
│ └───────────────┘ └───────────────┘ └───────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Admin View**
- Product CRUD
- Inventory management
- Order processing
- Sales reports

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 weeks)
1. ✅ Font Size in Settings
2. ✅ Calendar Enhancements (new categories)
3. ✅ Donation Tracker enhancements

### Phase 2: Core Church Functions (3-4 weeks)
4. Sermon Programming
5. Funeral & Final Services
6. Ceremony Services & Weddings

### Phase 3: Extended Features (2-3 weeks)
7. Weekly Charity Baskets enhancements
8. Agent Dashboard
9. Estate Planning

### Phase 4: Member Experience (1-2 weeks)
10. Member Portal Merch Page

---

## Navigation Updates

### Proposed Sidebar Structure
```
Dashboard
Actions
Sunday Prep
People
Groups
Calendar
Giving
  └─ Donation Tracker
  └─ Charity Baskets
  └─ Estate Planning (new)
Services (new section)
  └─ Sermons (new)
  └─ Weddings (new)
  └─ Funerals (new)
AI Agents (new)
Reports
Settings
  └─ Accessibility (new section)
```

---

## Technical Notes

### Shared Components to Create
- `DateRangePicker` - For scheduling
- `RichTextEditor` - For sermon content
- `FileUpload` - For photos/documents
- `PrintLayout` - For programs/certificates
- `Timeline` - For planning wizards

### Database Migrations Needed
- `sermons` table
- `sermon_series` table
- `ceremonies` table
- `weddings` table (extends ceremonies)
- `funerals` table
- `planned_gifts` table
- `merch_products` table
- `merch_orders` table
- Expand `calendar_events` categories

### API Endpoints Needed
- `/api/sermons/*` - Sermon CRUD
- `/api/ceremonies/*` - Ceremony management
- `/api/merch/*` - Product and order management
- `/api/estate/*` - Planned giving

---

## Next Steps

1. Review and approve this plan
2. Prioritize features based on church needs
3. Begin Phase 1 implementation
4. Set up database migrations
5. Create shared components
6. Implement features iteratively
