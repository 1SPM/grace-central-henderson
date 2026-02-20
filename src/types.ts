export type MemberStatus = 'visitor' | 'regular' | 'member' | 'leader' | 'inactive';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: MemberStatus;
  photo?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  birthDate?: string;
  joinDate?: string;
  firstVisit?: string;
  notes?: string;
  tags: string[];
  smallGroups: string[];
  familyId?: string;
}

export interface Interaction {
  id: string;
  personId: string;
  type: 'note' | 'call' | 'email' | 'visit' | 'text' | 'prayer';
  content: string;
  createdAt: string;
  createdBy: string;
  // For distinguishing logged vs actually sent
  sentVia?: 'resend' | 'twilio'; // If set, message was actually sent
  messageId?: string; // External message ID from provider
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export interface Task {
  id: string;
  personId?: string;
  title: string;
  description?: string;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  category: 'follow-up' | 'care' | 'admin' | 'outreach';
  createdAt: string;
  recurrence?: RecurrenceType;
  originalTaskId?: string; // For tracking recurring task instances
}

export interface SmallGroup {
  id: string;
  name: string;
  description?: string;
  leaderId: string;
  meetingDay?: string;
  meetingTime?: string;
  location?: string;
  members: string[];
  isActive: boolean;
}

export interface PrayerRequest {
  id: string;
  personId: string;
  content: string;
  isPrivate: boolean;
  isAnswered: boolean;
  testimony?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  personId: string;
  eventType: 'sunday' | 'wednesday' | 'small-group' | 'special';
  eventName?: string;
  date: string;
  checkedInAt: string;
}

export interface Giving {
  id: string;
  personId?: string;
  amount: number;
  fund: 'tithe' | 'offering' | 'missions' | 'building' | 'benevolence' | 'other';
  date: string;
  method: 'cash' | 'check' | 'card' | 'online' | 'bank';
  isRecurring: boolean;
  note?: string;
}

// Calendar event categories
export type EventCategory =
  | 'service'      // Regular services
  | 'meeting'      // Staff/committee meetings
  | 'event'        // General church events
  | 'small-group'  // Small group meetings
  | 'holiday'      // Church holidays
  | 'wedding'      // Weddings & rehearsals
  | 'funeral'      // Funerals & memorials
  | 'obituary'     // Obituary announcements
  | 'ceremony'     // General ceremonies (ordinations, confirmations, etc.)
  | 'baptism'      // Baptisms
  | 'dedication'   // Baby dedications
  | 'counseling'   // Counseling appointments
  | 'rehearsal'    // Music/drama rehearsals
  | 'outreach'     // Community outreach
  | 'class'        // Classes & training
  | 'other';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  location?: string;
  category: EventCategory;
  attendees?: string[];
  // Recurrence fields
  recurrence?: RecurrenceType;
  recurrenceEndDate?: string;
  seriesId?: string; // Links instances to their parent series
  capacity?: number; // Max registration capacity
  registrationDeadline?: string;
  requiresRegistration?: boolean;
  // Extended fields
  linkedEntityType?: 'wedding' | 'funeral' | 'sermon' | 'ceremony';
  linkedEntityId?: string;
  isPrivate?: boolean;
}

export type View = 'dashboard' | 'feed' | 'people' | 'person' | 'tasks' | 'calendar' | 'groups' | 'prayer' | 'giving' | 'settings' | 'pipeline' | 'attendance' | 'volunteers' | 'tags' | 'reports' | 'birthdays' | 'online-giving' | 'batch-entry' | 'pledges' | 'campaigns' | 'statements' | 'charity-baskets' | 'donation-tracker' | 'member-stats' | 'agents' | 'connect-card' | 'directory' | 'child-checkin' | 'forms' | 'member-portal' | 'member-directory' | 'member-giving' | 'member-events' | 'member-checkin' | 'sunday-prep' | 'families' | 'skills' | 'email-templates' | 'event-registration' | 'reminders' | 'planning-center-import' | 'qr-checkin' | 'follow-up-automation' | 'pastoral-care' | 'life-services' | 'wedding-services' | 'funeral-services' | 'estate-planning' | 'leader-management' | 'analytics';

// Family/Household type for grouping
export interface Family {
  id: string;
  name: string;
  members: Person[];
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  headOfHousehold?: string; // personId
}

// Member Portal Tab
export type MemberPortalTab = 'home' | 'directory' | 'giving' | 'events' | 'checkin' | 'pastor-signup' | 'shop' | 'legacy' | 'my-ministry' | 'care';

// ============================================
// COLLECTION & DONATION MANAGEMENT TYPES
// ============================================

export type PledgeFrequency = 'one-time' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
export type PledgeStatus = 'active' | 'completed' | 'cancelled';
export type BatchStatus = 'open' | 'closed' | 'reconciled';
export type RecurringStatus = 'active' | 'paused' | 'cancelled';

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  goalAmount?: number;
  startDate: string;
  endDate?: string;
  fund: string;
  isActive: boolean;
  currentAmount?: number; // Calculated from donations
}

export interface Pledge {
  id: string;
  personId?: string;
  campaignId?: string;
  amount: number;
  frequency: PledgeFrequency;
  startDate: string;
  endDate?: string;
  fund: string;
  status: PledgeStatus;
  notes?: string;
  // Calculated fields
  totalPledged?: number;
  totalGiven?: number;
  percentComplete?: number;
}

export interface DonationBatch {
  id: string;
  batchDate: string;
  batchName?: string;
  status: BatchStatus;
  totalCash: number;
  totalChecks: number;
  totalAmount: number;
  checkCount: number;
  notes?: string;
  createdBy?: string;
  closedBy?: string;
  closedAt?: string;
  items?: BatchItem[];
}

export interface BatchItem {
  id: string;
  batchId: string;
  personId?: string;
  amount: number;
  method: 'cash' | 'check';
  fund: string;
  checkNumber?: string;
  memo?: string;
}

export interface RecurringGiving {
  id: string;
  personId?: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  fund: string;
  nextDate: string;
  stripeSubscriptionId?: string;
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  status: RecurringStatus;
}

export interface GivingStatement {
  id: string;
  personId?: string;
  year: number;
  totalAmount: number;
  byFund: Record<string, number>;
  generatedAt: string;
  sentAt?: string;
  sentMethod?: 'email' | 'print';
  pdfUrl?: string;
}

export interface GivingAnalytics {
  totalGiving: number;
  monthlyAverage: number;
  yearOverYearChange: number;
  recurringTotal: number;
  recurringCount: number;
  topFunds: { fund: string; amount: number; percentage: number }[];
  monthlyTrend: { month: string; amount: number }[];
  donorRetention: number;
  averageGiftSize: number;
  newDonorCount: number;
}

// ============================================
// CHARITY BASKETS & DONATION TRACKING TYPES
// ============================================

export type BasketType = 'food' | 'holiday' | 'emergency' | 'school' | 'baby' | 'household' | 'other';
export type BasketStatus = 'collecting' | 'ready' | 'distributed' | 'cancelled';
export type ItemCategory = 'food' | 'clothing' | 'hygiene' | 'household' | 'school' | 'baby' | 'gift' | 'other';

export interface CharityBasket {
  id: string;
  name: string;
  type: BasketType;
  description?: string;
  recipientId?: string; // Person who will receive the basket
  recipientName?: string; // For anonymous/external recipients
  status: BasketStatus;
  targetDate?: string; // When basket should be ready
  distributedDate?: string;
  distributedBy?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  items: BasketItem[];
  totalValue: number;
}

export interface BasketItem {
  id: string;
  basketId: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit?: string; // e.g., 'cans', 'boxes', 'items'
  estimatedValue?: number;
  donorId?: string; // Person who donated this item
  donorName?: string; // For anonymous donors
  donatedAt: string;
  notes?: string;
}

export interface BasketDonation {
  id: string;
  basketId?: string; // Optional - can be general inventory
  donorId?: string;
  donorName?: string;
  type: 'item' | 'cash';
  items?: BasketItem[];
  cashAmount?: number;
  date: string;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit?: string;
  minQuantity?: number; // Alert when below this
  location?: string;
  lastUpdated: string;
}

export interface DonationStats {
  personId: string;
  totalLifetime: number;
  totalThisYear: number;
  totalLastYear: number;
  averageGift: number;
  largestGift: number;
  giftCount: number;
  firstGiftDate?: string;
  lastGiftDate?: string;
  preferredMethod?: string;
  preferredFund?: string;
  yearOverYearChange: number;
  monthlyGiving: { month: string; amount: number }[];
  fundBreakdown: { fund: string; amount: number; percentage: number }[];
  givingStreak: number; // Consecutive months with giving
  basketContributions: number; // Number of basket item donations
}

export interface DonationTrackerFilters {
  dateFrom?: string;
  dateTo?: string;
  personId?: string;
  fund?: string;
  method?: string;
  minAmount?: number;
  maxAmount?: number;
  isRecurring?: boolean;
}

// Donation Goals
export interface DonationGoal {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate?: string;
  fund?: string;
  isPublic: boolean;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
}

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

export type ConversationStatus = 'active' | 'waiting' | 'escalated' | 'resolved' | 'archived';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'crisis';
export type MessageSender = 'user' | 'ai' | 'leader';

export interface LeaderProfile {
  id: string;
  personId?: string;
  displayName: string;
  title: string;
  bio: string;
  photo?: string;
  expertiseAreas: HelpCategory[];
  credentials: string[];
  yearsOfPractice?: number;
  personalityTraits: string[];
  spiritualFocusAreas: string[];
  language: string;
  isVerified: boolean;
  isAvailable: boolean;
  isActive: boolean;
  sessionType?: 'one-time' | 'recurring';
  sessionFrequency?: string;
  suitableFor?: string[];
  anchors?: string;
  socialMinistryDate?: string;
  createdAt: string;
}

export interface AIPersona {
  id: string;
  leaderId: string;
  name: string;
  language: string;
  personalityDescription: string;
  personalityTraits: string[];
  systemPrompt: string;
  boundaries: string[];
  isActive: boolean;
}

export interface HelpRequest {
  id: string;
  category: HelpCategory;
  description?: string;
  isAnonymous: boolean;
  anonymousId?: string;
  personId?: string;
  assignedLeaderId?: string;
  conversationId?: string;
  status: 'pending' | 'active' | 'resolved' | 'cancelled';
  priority: ConversationPriority;
  createdAt: string;
  resolvedAt?: string;
}

export interface PastoralConversation {
  id: string;
  helpRequestId: string;
  personaId?: string;
  leaderId?: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  category: HelpCategory;
  isAnonymous: boolean;
  personId?: string;
  messages: PastoralMessage[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface PastoralMessage {
  id: string;
  conversationId: string;
  sender: MessageSender;
  senderName: string;
  content: string;
  timestamp: string;
  aiConfidence?: number;
}

// ============================================
// LIFE SERVICES TYPES
// ============================================

export type ServiceRequestStatus = 'inquiry' | 'consultation' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type ServiceType = 'wedding' | 'funeral' | 'baptism' | 'dedication' | 'counseling' | 'other';

export interface ServiceRequest {
  id: string;
  type: ServiceType;
  status: ServiceRequestStatus;
  title: string;
  description?: string;
  primaryContactId?: string; // Link to Person
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  requestedDate?: string; // Preferred date for service
  scheduledDate?: string; // Confirmed date
  location?: string;
  assignedStaffId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WeddingRequest extends ServiceRequest {
  type: 'wedding';
  // Couple info
  partner1Name: string;
  partner1Id?: string;
  partner2Name: string;
  partner2Id?: string;
  // Wedding details
  ceremonyType: 'traditional' | 'contemporary' | 'outdoor' | 'destination' | 'other';
  expectedGuests?: number;
  rehearsalDate?: string;
  rehearsalTime?: string;
  ceremonyTime?: string;
  receptionLocation?: string;
  // Pre-marital counseling
  counselingRequired: boolean;
  counselingSessionsCompleted: number;
  counselingSessionsTotal: number;
  // Checklist progress
  checklistItems: WeddingChecklistItem[];
  // Vendors
  vendors: WeddingVendor[];
}

export interface WeddingChecklistItem {
  id: string;
  task: string;
  category: 'documents' | 'counseling' | 'ceremony' | 'music' | 'logistics' | 'rehearsal';
  completed: boolean;
  dueDate?: string;
  completedAt?: string;
  notes?: string;
}

export interface WeddingVendor {
  id: string;
  role: 'florist' | 'photographer' | 'videographer' | 'caterer' | 'musician' | 'decorator' | 'other';
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  confirmed: boolean;
  notes?: string;
}

export interface FuneralRequest extends ServiceRequest {
  type: 'funeral';
  // Deceased info
  deceasedName: string;
  deceasedId?: string; // If they were a member
  dateOfBirth?: string;
  dateOfDeath: string;
  // Service details
  serviceType: 'funeral' | 'memorial' | 'graveside' | 'celebration-of-life';
  viewingDate?: string;
  viewingTime?: string;
  serviceTime?: string;
  burialLocation?: string;
  receptionAfter: boolean;
  receptionLocation?: string;
  // Family
  familyMembers: FuneralFamilyMember[];
  // Service elements
  obituary?: string;
  selectedHymns: string[];
  selectedScriptures: string[];
  eulogySpeakers: string[];
  specialRequests?: string;
  // Checklist
  checklistItems: FuneralChecklistItem[];
}

export interface FuneralFamilyMember {
  id: string;
  personId?: string;
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  isPrimaryContact: boolean;
}

export interface FuneralChecklistItem {
  id: string;
  task: string;
  category: 'planning' | 'documents' | 'service' | 'logistics' | 'follow-up';
  completed: boolean;
  dueDate?: string;
  completedAt?: string;
  assignedTo?: string;
}

export interface BaptismRequest extends ServiceRequest {
  type: 'baptism';
  // Candidate info
  candidateName: string;
  candidateId?: string;
  candidateAge?: number;
  isBelieverssBaptism: boolean; // vs infant baptism
  // For infant baptism
  parentNames?: string;
  parentIds?: string[];
  godparents?: string[];
  // Testimony
  testimony?: string;
  // Class
  baptismClassCompleted: boolean;
  baptismClassDate?: string;
}

export interface DedicationRequest extends ServiceRequest {
  type: 'dedication';
  // Child info
  childName: string;
  childDateOfBirth: string;
  // Parents
  parentNames: string;
  parentIds?: string[];
  // Ceremony
  dedicationVerse?: string;
  specialPrayer?: string;
}

export interface CounselingRequest extends ServiceRequest {
  type: 'counseling';
  counselingType: 'pre-marital' | 'grief' | 'family' | 'individual' | 'crisis' | 'other';
  linkedServiceId?: string; // Link to wedding/funeral if applicable
  sessionsScheduled: number;
  sessionsCompleted: number;
  sessionNotes: CounselingSession[];
}

export interface CounselingSession {
  id: string;
  date: string;
  duration: number; // minutes
  topics: string[];
  notes?: string;
  nextSteps?: string;
}

// Default checklists
export const DEFAULT_WEDDING_CHECKLIST: Omit<WeddingChecklistItem, 'id'>[] = [
  { task: 'Marriage license obtained', category: 'documents', completed: false },
  { task: 'Pre-marital counseling session 1', category: 'counseling', completed: false },
  { task: 'Pre-marital counseling session 2', category: 'counseling', completed: false },
  { task: 'Pre-marital counseling session 3', category: 'counseling', completed: false },
  { task: 'Pre-marital counseling session 4', category: 'counseling', completed: false },
  { task: 'Select ceremony readings', category: 'ceremony', completed: false },
  { task: 'Write/select vows', category: 'ceremony', completed: false },
  { task: 'Choose ceremony music', category: 'music', completed: false },
  { task: 'Book musicians/DJ', category: 'music', completed: false },
  { task: 'Confirm officiant availability', category: 'ceremony', completed: false },
  { task: 'Submit facility reservation', category: 'logistics', completed: false },
  { task: 'Coordinate with florist', category: 'logistics', completed: false },
  { task: 'Coordinate with photographer', category: 'logistics', completed: false },
  { task: 'Schedule rehearsal', category: 'rehearsal', completed: false },
  { task: 'Confirm rehearsal dinner plans', category: 'rehearsal', completed: false },
  { task: 'Final walkthrough of venue', category: 'logistics', completed: false },
];

export const DEFAULT_FUNERAL_CHECKLIST: Omit<FuneralChecklistItem, 'id'>[] = [
  { task: 'Obtain death certificate', category: 'documents', completed: false },
  { task: 'Contact funeral home', category: 'planning', completed: false },
  { task: 'Set service date and time', category: 'planning', completed: false },
  { task: 'Reserve sanctuary/chapel', category: 'logistics', completed: false },
  { task: 'Gather obituary information', category: 'documents', completed: false },
  { task: 'Submit obituary to newspaper', category: 'documents', completed: false },
  { task: 'Select hymns and scriptures', category: 'service', completed: false },
  { task: 'Confirm eulogy speakers', category: 'service', completed: false },
  { task: 'Coordinate with musicians', category: 'service', completed: false },
  { task: 'Arrange for flowers', category: 'logistics', completed: false },
  { task: 'Prepare memorial slideshow', category: 'service', completed: false },
  { task: 'Confirm pallbearers', category: 'logistics', completed: false },
  { task: 'Coordinate reception/meal', category: 'logistics', completed: false },
  { task: 'Send follow-up card to family', category: 'follow-up', completed: false },
  { task: 'Schedule grief support check-in', category: 'follow-up', completed: false },
];

// ============================================
// LEADER ONBOARDING & SESSION TYPES
// ============================================

export type LeaderApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'interview'
  | 'training'
  | 'approved'
  | 'active'
  | 'suspended'
  | 'rejected';

export type BackgroundCheckStatus = 'not_started' | 'in_progress' | 'passed' | 'failed' | 'waived';

export interface LeaderReference {
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface LeaderApplication {
  id: string;
  personId?: string;
  displayName: string;
  title: string;
  bio?: string;
  photo?: string;
  email?: string;
  phone?: string;
  expertiseAreas: HelpCategory[];
  credentials: string[];
  yearsOfPractice?: number;
  personalityTraits: string[];
  spiritualFocusAreas: string[];
  suitableFor: string[];
  language: string;
  anchorVerse?: string;
  sessionType: 'one-time' | 'recurring';
  sessionFrequency?: string;
  status: LeaderApplicationStatus;
  statusNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  backgroundCheckStatus: BackgroundCheckStatus;
  backgroundCheckDate?: string;
  trainingCompleted: boolean;
  trainingCompletedDate?: string;
  trainingModulesDone: string[];
  references: LeaderReference[];
  createdAt: string;
  updatedAt: string;
}

export type PastoralSessionType = 'chat' | 'video' | 'phone' | 'in-person';
export type PastoralSessionStatus = 'scheduled' | 'active' | 'completed' | 'cancelled' | 'no-show';

export interface PastoralSession {
  id: string;
  leaderId: string;
  personId?: string;
  helpRequestId?: string;
  category: HelpCategory;
  sessionType: PastoralSessionType;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  status: PastoralSessionStatus;
  notes?: string;
  followUpNeeded: boolean;
  followUpDate?: string;
  rating?: number;
  feedback?: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface LeaderStats {
  leaderId: string;
  leaderName: string;
  leaderTitle: string;
  totalSessions: number;
  completedSessions: number;
  activeSessions: number;
  cancelledSessions: number;
  noShowSessions: number;
  totalHours: number;
  averageSessionMinutes: number;
  averageRating: number;
  totalRatings: number;
  categoryBreakdown: { category: HelpCategory; count: number; percentage: number }[];
  monthlyActivity: { month: string; sessions: number; hours: number }[];
  responseRate: number;
  followUpRate: number;
  isVerified: boolean;
  isAvailable: boolean;
  lastSessionDate?: string;
}

export const LEADER_APPLICATION_STEPS = [
  { key: 'personal', label: 'Personal Info', description: 'Basic profile details' },
  { key: 'expertise', label: 'Expertise & Traits', description: 'Areas of ministry focus' },
  { key: 'credentials', label: 'Credentials', description: 'Education & experience' },
  { key: 'references', label: 'References', description: 'Character references' },
  { key: 'review', label: 'Review & Submit', description: 'Confirm your application' },
] as const;

export type OnboardingStep = typeof LEADER_APPLICATION_STEPS[number]['key'];

export const TRAINING_MODULES = [
  'Pastoral Ethics & Boundaries',
  'Crisis Intervention Basics',
  'Active Listening Skills',
  'Confidentiality & Privacy',
  'Mandatory Reporting Guidelines',
  'Cultural Sensitivity',
  'Suicide Prevention Awareness',
  'Referral Network Overview',
] as const;
