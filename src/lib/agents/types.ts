/**
 * Agent System Types
 *
 * Core type definitions for the Grace CRM agent system.
 * Agents automate tasks like sending birthday greetings, donation receipts,
 * and new member onboarding sequences.
 */

export type AgentStatus = 'active' | 'paused' | 'disabled';
export type AgentActionType = 'email' | 'sms' | 'task' | 'notification' | 'status_change';
export type TriggerType = 'schedule' | 'event' | 'webhook' | 'manual';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  category: 'engagement' | 'finance' | 'pastoral' | 'administration';
  status: AgentStatus;
  enabled: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTrigger {
  type: TriggerType;
  schedule?: string; // Cron expression for scheduled triggers
  event?: string; // Event name for event-based triggers
  conditions?: Record<string, unknown>;
}

export interface AgentAction {
  id: string;
  agentId: string;
  type: AgentActionType;
  template?: string;
  templateData?: Record<string, string>;
  targetPersonId?: string;
  metadata?: Record<string, unknown>;
  executedAt: string;
  success: boolean;
  error?: string;
}

export interface AgentLog {
  id: string;
  agentId: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentStats {
  agentId: string;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  lastRunAt?: string;
  nextRunAt?: string;
}

// Life Event Recognition Agent Types
export interface LifeEventConfig extends AgentConfig {
  settings: {
    enableBirthdays: boolean;
    enableAnniversaries: boolean;
    enableMembershipAnniversaries: boolean;
    sendEmail: boolean;
    sendSMS: boolean;
    daysInAdvance: number; // For reminders to staff
    autoSend: boolean; // Auto-send greetings or just notify staff
    churchName: string;
    useAIMessages?: boolean; // Use AI to generate personalized messages
  };
}

export interface LifeEvent {
  type: 'birthday' | 'anniversary' | 'membership_anniversary';
  personId: string;
  personName: string;
  email?: string;
  phone?: string;
  date: string;
  yearsCount?: number; // For anniversaries
}

// Donation Processing Agent Types
export interface DonationProcessingConfig extends AgentConfig {
  settings: {
    autoSendReceipts: boolean;
    receiptMethod: 'email' | 'sms' | 'both';
    sendThankYouMessage: boolean;
    thankYouDelay: number; // Minutes after donation to send thank you
    trackFirstTimeGivers: boolean;
    alertOnLargeGifts: boolean;
    largeGiftThreshold: number;
    churchName: string;
    taxId: string;
    useAIMessages?: boolean; // Use AI to generate personalized thank-you messages
  };
}

export interface DonationEvent {
  donationId: string;
  personId?: string;
  personName?: string;
  email?: string;
  phone?: string;
  amount: number;
  fund: string;
  method: string;
  date: string;
  isFirstGift: boolean;
  isRecurring: boolean;
}

// New Member Integration Agent Types
export interface NewMemberConfig extends AgentConfig {
  settings: {
    enableWelcomeSequence: boolean;
    enableDripCampaign: boolean;
    dripCampaignDays: number[]; // Days after joining to send messages
    assignFollowUpTask: boolean;
    assignToStaffId?: string;
    inviteToSmallGroup: boolean;
    sendWelcomePacket: boolean;
    churchName: string;
    pastorName: string;
    useAIMessages?: boolean; // Use AI to generate personalized welcome messages
  };
}

export interface NewMemberEvent {
  personId: string;
  personName: string;
  email?: string;
  phone?: string;
  previousStatus: string;
  newStatus: string;
  joinDate: string;
}

export interface DripMessage {
  day: number;
  subject: string;
  emailTemplate: string;
  smsTemplate: string;
}

// Sermon Programming Agent Types
export interface SermonProgrammingConfig extends AgentConfig {
  settings: {
    enableSermonOutlines: boolean;
    enableSeriesPlanning: boolean;
    enableIllustrations: boolean;
    defaultSermonLength: number; // Minutes
    includeScriptureReferences: boolean;
    includeApplicationPoints: boolean;
    includeDiscussionQuestions: boolean;
    preferredStyle: 'expository' | 'topical' | 'narrative' | 'devotional';
    targetAudience: 'general' | 'youth' | 'seniors' | 'new-believers';
    churchName: string;
    pastorName: string;
  };
}

export interface SermonOutline {
  id: string;
  title: string;
  scripture: string;
  theme: string;
  mainPoints: {
    point: string;
    subPoints: string[];
    illustration?: string;
    application?: string;
  }[];
  introduction: string;
  conclusion: string;
  discussionQuestions?: string[];
  estimatedLength: number;
  createdAt: string;
  status: 'draft' | 'ready' | 'delivered';
}

export interface SermonSeries {
  id: string;
  title: string;
  description: string;
  theme: string;
  numberOfWeeks: number;
  sermons: {
    week: number;
    title: string;
    scripture: string;
    keyVerse: string;
    mainIdea: string;
  }[];
  startDate?: string;
  status: 'planning' | 'active' | 'completed';
}

// Agent execution context
export interface AgentContext {
  churchId: string;
  churchName: string;
  currentDate: Date;
  dryRun?: boolean; // If true, don't actually send messages
}

// Agent result
export interface AgentResult {
  success: boolean;
  actionsExecuted: number;
  actionsFailed: number;
  logs: AgentLog[];
  errors?: string[];
}
