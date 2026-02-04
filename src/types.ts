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

export type View = 'dashboard' | 'feed' | 'people' | 'person' | 'tasks' | 'calendar' | 'groups' | 'prayer' | 'giving' | 'settings' | 'pipeline' | 'attendance' | 'volunteers' | 'tags' | 'reports' | 'birthdays' | 'online-giving' | 'batch-entry' | 'pledges' | 'campaigns' | 'statements' | 'charity-baskets' | 'donation-tracker' | 'member-stats' | 'agents' | 'connect-card' | 'directory' | 'child-checkin' | 'forms' | 'member-portal' | 'member-directory' | 'member-giving' | 'member-events' | 'member-checkin' | 'sunday-prep' | 'families' | 'skills' | 'email-templates' | 'event-registration' | 'reminders' | 'planning-center-import' | 'qr-checkin' | 'follow-up-automation';

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
export type MemberPortalTab = 'home' | 'directory' | 'giving' | 'events' | 'checkin';

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
