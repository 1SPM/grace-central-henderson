# Pastor Settings UI Redesign Plan

Replace the current slider-based tone configuration with a rich, form-driven profile system inspired by the Divinity-style counselor platform UI.

---

## Important: Member Portal is Finalized

The **Member Portal** (`src/components/member/`) is the most polished module in the app and must NOT be modified. It includes:
- `MemberPortal.tsx` — main router with 5-tab system
- `MemberLayout.tsx` — bottom nav + header
- `MemberHomePage.tsx` — dashboard with quick actions, service times, contact
- `MemberDirectoryPage.tsx` — searchable alphabetical directory
- `MemberEventsPage.tsx` — events + RSVP with category filters
- `MemberGivingPage.tsx` — 3-step giving form, history, recurring setup
- `MemberCheckInPage.tsx` — QR check-in, today's events, attendance history
- `MemberPortalPreview.tsx` — admin phone-frame preview + QR share

The pastor settings redesign should **match the member portal's quality and patterns**:
- Same Tailwind + dark mode conventions (`dark:bg-dark-800`, `dark:text-gray-400`, etc.)
- Same mobile-first responsive approach
- Same component structure (clean props interfaces, functional components, hooks)
- Same UI patterns (pill badges, gradient avatars, card layouts, multi-step forms)

---

## What We're Replacing

**Current (LeaderManager.tsx on `review-pastoral-care` branch):**
- 4 HTML range sliders (Warmth, Formality, Directness, Faith Level) on a 1-10 scale
- Basic text boundaries input
- System prompt textarea
- Simple leader list with edit/delete

**New approach:**
- Tag/pill-based personality & expertise selection
- Rich leader profile cards with photo, credentials, verified badge
- A self-service registration form for verified leaders
- Dedicated AI agent configuration section
- Tabbed profile view (Areas & Expertise | Spiritual Insights)

---

## New Data Model Changes

### Updated `LeaderProfile` type (`src/types.ts`)

```typescript
export interface LeaderProfile {
  id: string;
  personId?: string;
  displayName: string;
  title: string;               // e.g. "Senior Pastor", "Deaconess", "Prophet"
  bio: string;
  photo?: string;
  expertiseAreas: HelpCategory[];
  credentials: string[];       // NEW — e.g. "Certified Biblical Counselor", "M.Div"
  yearsOfPractice?: number;    // NEW — "25 years of Practice"
  personalityTraits: string[]; // NEW — replaces tone sliders: ["Warm", "Patient", "Empathetic", ...]
  spiritualFocusAreas: string[]; // NEW — e.g. "Mindfulness", "Prayer Ministry", "Deliverance"
  language: string;            // NEW — "English", "Spanish", etc.
  isVerified: boolean;         // NEW — verified badge
  isAvailable: boolean;
  isActive: boolean;
  sessionType?: 'one-time' | 'recurring'; // NEW
  sessionFrequency?: string;   // NEW — "Weekly", "Bi-weekly", "Monthly"
  suitableFor?: string[];      // NEW — "Adults", "Youth", "Couples", etc.
  anchors?: string;            // NEW — guiding scripture/bible verse
  socialMinistryDate?: string; // NEW — ordination/ministry start date
  createdAt: string;
}
```

### Updated `AIPersona` type (`src/types.ts`)

```typescript
export interface AIPersona {
  id: string;
  leaderId: string;
  name: string;
  language: string;            // NEW — AI response language
  personalityDescription: string; // NEW — replaces tone numbers: "Wise and compassionate"
  personalityTraits: string[]; // NEW — mirrors leader traits for AI calibration
  systemPrompt: string;
  boundaries: string[];
  isActive: boolean;
  // REMOVED: tone: { warmth, formality, directness, faithLevel } — replaced by traits
}
```

---

## Component Plan

### 1. `LeaderProfileCard` (new component)

**File:** `src/components/pastoral/LeaderProfileCard.tsx`

Rich profile card replacing the simple list rows. Matches the reference UI.

```
┌─────────────────────────────────────────────────┐
│  ┌──────┐                                       │
│  │ PHOTO│  Pastor Marcus Daniels                │
│  │      │  Psycho-Spiritual Counselor           │
│  └──────┘  ✓ Verified                           │
│                                                  │
│  [Faith/Substance] [Grief Clinician] [25 yrs]   │
│                                                  │
│  [Contact Information]  [View Profile]           │
├─────────────────────────────────────────────────┤
│  [Areas & Expertise]  |  [Spiritual Insights]   │
├─────────────────────────────────────────────────┤
│  Education & Credentials                        │
│  Accredited Counselor | Certified by...         │
│                                                  │
│  Areas of Expertise                             │
│  [Marriage] [Addiction] [Faith Questions]        │
│                                                  │
│  AI Agent Info                                  │
│  Language: English                              │
│  Personality: Wise and compassionate            │
│                                                  │
│  System Prompt                                  │
│  "Speaks gently and draws from deep..."         │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │  Ready to begin your spiritual journey? │    │
│  │  [Start Your Session]                   │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Key features:**
- Large profile photo with fallback initials
- Verified badge (green checkmark)
- Credential tags as pills
- Two tabs: "Areas & Expertise" / "Spiritual Insights"
- AI persona info section (language, personality traits, system prompt preview)
- Purple CTA card at bottom to start a session

### 2. `LeaderRegistrationForm` (new component)

**File:** `src/components/pastoral/LeaderRegistrationForm.tsx`

Self-service form that verified leaders fill out to set up their profile and AI persona. Replaces the admin-only slider configuration.

```
┌─────────────────────────────────────────────────┐
│  Leader Profile Setup                           │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ [Photo Upload]                           │   │
│  │ Display Name: __________________________ │   │
│  │ Title:        __________________________ │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Theological Position / Approach                │
│  ┌──────────────────────────────────────────┐   │
│  │ ________________________________________ │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Areas of Expertise (select all that apply)     │
│  [Marriage] [Addiction] [Grief] [Faith]          │
│  [Crisis] [Financial] [Anxiety] [Parenting]     │
│                                                  │
│  Personality Traits (select up to 6)            │
│  [Patient] [Warm] [Curious] [Empathetic]        │
│  [Comforting] [Coaching] [Direct] [Gentle]      │
│  [Humorous] [Scholarly]                         │
│                                                  │
│  Your Spiritual Focus Areas                     │
│  [Prayer Ministry] [Mindfulness] [Deliverance]  │
│  [Worship] [Bible Study] [Missions]             │
│                                                  │
│  Guiding Scripture / Anchor Verse               │
│  ┌──────────────────────────────────────────┐   │
│  │ ________________________________________ │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Suitable For                                   │
│  [Adults] [Youth] [Couples] [Families]          │
│                                                  │
│  ┌─ Session Settings ──────────────────────┐    │
│  │ Session Type: [One-time ▾]              │    │
│  │ Frequency:    [Weekly ▾]                │    │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Education & Credentials                        │
│  ┌──────────────────────────────────────────┐   │
│  │ + Add credential                        │   │
│  │ [M.Div - Seminary] [x]                  │   │
│  │ [Certified Biblical Counselor] [x]      │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [Cancel]                      [Register]       │
└─────────────────────────────────────────────────┘
```

**Key features:**
- Multi-select pill buttons for expertise, traits, focus areas, suitable-for (NOT sliders)
- Personality traits replace the warmth/formality/directness/faithLevel sliders
- Credential tag input (add/remove)
- Session type and frequency dropdowns
- Anchor verse text field
- Photo upload area
- "Register" submits the full profile + generates default AI persona from traits

### 3. `LeaderSettingsPage` (refactored)

**File:** `src/components/pastoral/LeaderSettingsPage.tsx`

Replaces `LeaderManager.tsx`. Combines the profile card view with management controls.

**Views:**
- **List view** — Grid of `LeaderProfileCard` components (admin sees all, leader sees own)
- **Profile view** — Full expanded profile card for a selected leader
- **Registration view** — `LeaderRegistrationForm` for new leaders or editing existing
- **AI Config view** — Persona configuration (personality description, traits, system prompt, boundaries)

### 4. `PersonalityTraitSelector` (new shared component)

**File:** `src/components/pastoral/PersonalityTraitSelector.tsx`

Reusable multi-select pill component that replaces sliders everywhere.

```typescript
interface PersonalityTraitSelectorProps {
  available: string[];      // All available traits
  selected: string[];       // Currently selected
  onChange: (traits: string[]) => void;
  maxSelections?: number;   // e.g. 6
  label?: string;
}
```

**Predefined trait options:**
- Patient, Warm, Curious, Empathetic, Comforting, Coaching
- Direct, Gentle, Humorous, Scholarly, Nurturing, Encouraging
- Faith-driven, Scripture-focused, Practical, Contemplative

### 5. `VerifiedBadge` (new small component)

**File:** `src/components/pastoral/VerifiedBadge.tsx`

Small green verified checkmark badge shown on profiles.

---

## Mapping: Sliders → Traits

The current slider values map to personality traits like this:

| Old Slider | Old Values | New Trait Equivalents |
|------------|-----------|----------------------|
| Warmth 1-10 | Clinical → Warm | Traits: "Warm", "Nurturing", "Comforting" (or absence = clinical) |
| Formality 1-10 | Casual → Formal | Traits: "Scholarly", "Formal" vs "Casual", "Humorous" |
| Directness 1-10 | Gentle → Direct | Traits: "Direct", "Coaching" vs "Gentle", "Patient" |
| Faith Level 1-10 | Secular → Scripture-heavy | Traits: "Scripture-focused", "Faith-driven" vs "Practical", "Contemplative" |

**AI persona generation:** When a leader selects traits, the system auto-generates a `personalityDescription` and calibrates the `systemPrompt` preamble accordingly. For example:
- Traits: [Warm, Patient, Scripture-focused, Gentle]
- Generated description: "Warm and patient, drawing deeply from Scripture with a gentle approach"

---

## Implementation Steps

### Phase 1: Data Model Updates
1. Update `LeaderProfile` interface in `src/types.ts` with new fields
2. Update `AIPersona` interface — remove `tone` object, add `personalityTraits` and `personalityDescription`
3. Update any mock data / state initialization in `App.tsx` or data files

### Phase 2: New Components
4. Create `PersonalityTraitSelector.tsx` — reusable pill selector
5. Create `VerifiedBadge.tsx` — small verified indicator
6. Create `LeaderRegistrationForm.tsx` — full registration form with all fields
7. Create `LeaderProfileCard.tsx` — rich profile card with tabs

### Phase 3: Page Integration
8. Create `LeaderSettingsPage.tsx` — replaces old `LeaderManager.tsx`
9. Wire into `PastoralCareDashboard.tsx` — "Leaders" tab uses new components
10. Add navigation for leader self-registration (e.g. "Become a Leader" flow)

### Phase 4: AI Persona Auto-Config
11. Build trait-to-prompt mapper utility (`src/utils/personaFromTraits.ts`)
12. Auto-generate `personalityDescription` from selected traits
13. Auto-generate system prompt preamble from traits + expertise + anchors

### Phase 5: Polish
14. Dark mode styling for all new components
15. Mobile responsive layout
16. Form validation (required fields, max trait selections)
17. Photo upload placeholder/integration point

---

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/types.ts` | Update LeaderProfile & AIPersona interfaces |
| Create | `src/components/pastoral/PersonalityTraitSelector.tsx` | Reusable pill selector |
| Create | `src/components/pastoral/VerifiedBadge.tsx` | Verified badge component |
| Create | `src/components/pastoral/LeaderProfileCard.tsx` | Rich profile card |
| Create | `src/components/pastoral/LeaderRegistrationForm.tsx` | Leader self-service form |
| Create | `src/components/pastoral/LeaderSettingsPage.tsx` | New settings page (replaces LeaderManager) |
| Create | `src/utils/personaFromTraits.ts` | Trait → AI prompt mapper |
| Modify | `src/components/pastoral/PastoralCareDashboard.tsx` | Wire in new components |
| Modify | `src/App.tsx` (or state file) | Update state shape for new fields |

---

## Design Notes

- **Purple/violet accent** — matches existing Grace CRM theme + reference UI
- **Dark card backgrounds** for the registration form (dark blue/slate) per reference
- **Pill buttons** — selected state: solid violet, unselected: outlined gray
- **Profile photos** — circular with gradient fallback (already exists in CounselorCard)
- **Verified badge** — small green shield/checkmark inline with name
- **CTA card** — purple gradient card at bottom of profile: "Ready to begin your spiritual journey?"
- **Tabs** — "Areas & Expertise" | "Spiritual Insights" on profile cards

---

*Plan created: February 2026*
*Reference: Divinity-style counselor platform UI*
*Companion to: [DASHBOARD_COMPONENT_PLAN.md](./DASHBOARD_COMPONENT_PLAN.md)*
