// Supabase Database Types for GRACE CRM
// These types match the database schema

export type MemberStatus = 'visitor' | 'regular' | 'member' | 'leader' | 'inactive';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskCategory = 'follow-up' | 'care' | 'admin' | 'outreach';
export type InteractionType = 'note' | 'call' | 'email' | 'visit' | 'text' | 'prayer';
export type EventCategory =
  | 'service'
  | 'meeting'
  | 'event'
  | 'small-group'
  | 'holiday'
  | 'wedding'
  | 'funeral'
  | 'obituary'
  | 'ceremony'
  | 'baptism'
  | 'dedication'
  | 'counseling'
  | 'rehearsal'
  | 'outreach'
  | 'class'
  | 'other';
export type AttendanceType = 'sunday' | 'wednesday' | 'small-group' | 'special';
export type GivingFund = 'tithe' | 'offering' | 'missions' | 'building' | 'benevolence' | 'other';
export type GivingMethod = 'cash' | 'check' | 'card' | 'online' | 'bank';
export type UserRole = 'admin' | 'pastor' | 'staff' | 'volunteer' | 'member';
export type MemberInvitationStatus = 'pending' | 'sent' | 'accepted' | 'revoked' | 'expired';

// Row types (what you get from the database)
export interface Church {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  logo_url: string | null;
  timezone: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  church_id: string | null;
  clerk_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  church_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
  photo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  birth_date: string | null;
  join_date: string | null;
  first_visit: string | null;
  notes: string | null;
  tags: string[];
  family_id: string | null;
  clerk_user_id: string | null;
  portal_enabled: boolean;
  portal_last_seen_at: string | null;
  directory_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberInvitation {
  id: string;
  church_id: string;
  person_id: string;
  email: string;
  token: string;
  status: MemberInvitationStatus;
  invited_by_user_id: string | null;
  clerk_invitation_id: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface SmallGroup {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMembership {
  id: string;
  group_id: string;
  person_id: string;
  joined_at: string;
}

export interface Interaction {
  id: string;
  church_id: string;
  person_id: string;
  type: InteractionType;
  content: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  church_id: string;
  person_id: string | null;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  priority: TaskPriority;
  category: TaskCategory;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrayerRequest {
  id: string;
  church_id: string;
  person_id: string;
  content: string;
  is_private: boolean;
  is_answered: boolean;
  testimony: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  location: string | null;
  category: EventCategory;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  church_id: string;
  person_id: string;
  event_id: string | null;
  event_type: AttendanceType;
  event_name: string | null;
  date: string;
  checked_in_at: string;
}

export interface Giving {
  id: string;
  church_id: string;
  person_id: string | null;
  amount: number;
  fund: GivingFund;
  date: string;
  method: GivingMethod;
  is_recurring: boolean;
  stripe_payment_id: string | null;
  note: string | null;
  created_at: string;
}

export type MemberActivityEventType =
  | 'login' | 'rsvp' | 'checkin' | 'gift' | 'prayer' | 'care_message'
  | 'help_request' | 'directory_view' | 'announcement_view'
  | 'kyc_submitted' | 'card_issued' | 'card_frozen' | 'card_txn'
  | 'community_post' | 'community_react' | 'community_comment'
  | 'connection_request' | 'connection_accept' | 'group_post' | 'group_join'
  | 'community_view' | 'watch_join' | 'watch_chat'
  // My Journey portal tab events
  | 'journey_view' | 'milestone_achieved' | 'milestone_step_request'
  // Reflection & study events (Journal / Bible Study tabs)
  | 'journal_entry' | 'bible_study' | 'mood_check';

// Discipleship milestone row (discipleship_milestones table)
export type MilestoneTypeDb =
  | 'first_visit' | 'attended_class' | 'baptized'
  | 'joined_group' | 'serving' | 'leading';

export interface DiscipleshipMilestoneRow {
  id: string;
  church_id: string;
  person_id: string;
  milestone_type: MilestoneTypeDb;
  completed_at: string;
  notes: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchSermonRow {
  id: string;
  church_id: string;
  title: string;
  series_title: string | null;
  part_label: string | null;
  speaker: string | null;
  preached_at: string | null;
  duration_seconds: number | null;
  view_count: number;
  thumbnail_url: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchChatMessageRow {
  id: string;
  church_id: string;
  person_id: string | null;
  author_name: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
}

export type CommunityPostDbType =
  | 'prayer' | 'blessing' | 'praise' | 'milestone' | 'event' | 'group_activity' | 'scripture';

export interface CommunityPostRow {
  id: string;
  church_id: string;
  author_person_id: string;
  post_type: CommunityPostDbType;
  body: string;
  visibility: 'church' | 'connections' | 'group';
  group_id: string | null;
  metadata: Record<string, unknown>;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityReactionRow {
  id: string;
  church_id: string;
  post_id: string;
  person_id: string;
  reaction_type: 'pray' | 'amen' | 'share';
  created_at: string;
}

export interface CommunityCommentRow {
  id: string;
  church_id: string;
  post_id: string;
  author_person_id: string;
  body: string;
  created_at: string;
}

export interface MemberConnectionRow {
  id: string;
  church_id: string;
  person_a_id: string;
  person_b_id: string;
  created_at: string;
}

export interface MemberConnectionRequestRow {
  id: string;
  church_id: string;
  from_person_id: string;
  to_person_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
}

export interface MemberActivityEvent {
  id: string;
  church_id: string;
  person_id: string | null;
  event_type: MemberActivityEventType;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type AnnouncementDbCategory = 'general' | 'event' | 'urgent' | 'update' | 'celebration';

export interface AnnouncementRow {
  id: string;
  church_id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  category: AnnouncementDbCategory;
  pinned: boolean;
  published_at: string;
  expires_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRsvp {
  id: string;
  church_id: string;
  event_id: string;
  person_id: string;
  status: 'yes' | 'no' | 'maybe';
  guest_count: number;
  source: 'portal' | 'admin';
  created_at: string;
  updated_at: string;
}

// Insert types (for creating new records)
export interface PersonInsert {
  church_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  status?: MemberStatus;
  photo_url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  birth_date?: string | null;
  join_date?: string | null;
  first_visit?: string | null;
  notes?: string | null;
  tags?: string[];
  family_id?: string | null;
}

export interface TaskInsert {
  church_id: string;
  title: string;
  due_date: string;
  person_id?: string | null;
  description?: string | null;
  completed?: boolean;
  priority?: TaskPriority;
  category?: TaskCategory;
  assigned_to?: string | null;
}

export interface InteractionInsert {
  church_id: string;
  person_id: string;
  type: InteractionType;
  content: string;
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface PrayerRequestInsert {
  church_id: string;
  person_id: string;
  content: string;
  is_private?: boolean;
  is_answered?: boolean;
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      churches: {
        Row: Church;
        Insert: Partial<Church> & { name: string; slug: string };
        Update: Partial<Church>;
      };
      users: {
        Row: User;
        Insert: Partial<User> & { email: string };
        Update: Partial<User>;
      };
      people: {
        Row: Person;
        Insert: PersonInsert;
        Update: Partial<Person>;
      };
      member_invitations: {
        Row: MemberInvitation;
        Insert: Partial<MemberInvitation> & { church_id: string; person_id: string; email: string; token: string };
        Update: Partial<MemberInvitation>;
      };
      small_groups: {
        Row: SmallGroup;
        Insert: Partial<SmallGroup> & { church_id: string; name: string };
        Update: Partial<SmallGroup>;
      };
      group_memberships: {
        Row: GroupMembership;
        Insert: { group_id: string; person_id: string };
        Update: Partial<GroupMembership>;
      };
      interactions: {
        Row: Interaction;
        Insert: InteractionInsert;
        Update: Partial<Interaction>;
      };
      tasks: {
        Row: Task;
        Insert: TaskInsert;
        Update: Partial<Task>;
      };
      prayer_requests: {
        Row: PrayerRequest;
        Insert: PrayerRequestInsert;
        Update: Partial<PrayerRequest>;
      };
      calendar_events: {
        Row: CalendarEvent;
        Insert: Partial<CalendarEvent> & { church_id: string; title: string; start_date: string };
        Update: Partial<CalendarEvent>;
      };
      attendance: {
        Row: Attendance;
        Insert: Partial<Attendance> & { church_id: string; person_id: string; event_type: AttendanceType; date: string };
        Update: Partial<Attendance>;
      };
      giving: {
        Row: Giving;
        Insert: Partial<Giving> & { church_id: string; amount: number; date: string };
        Update: Partial<Giving>;
      };
      member_activity_events: {
        Row: MemberActivityEvent;
        Insert: Partial<MemberActivityEvent> & { church_id: string; event_type: MemberActivityEventType };
        Update: never;
      };
      announcements: {
        Row: AnnouncementRow;
        Insert: Partial<AnnouncementRow> & { church_id: string; title: string };
        Update: Partial<AnnouncementRow>;
      };
      event_rsvps: {
        Row: EventRsvp;
        Insert: Partial<EventRsvp> & { church_id: string; event_id: string; person_id: string; status: 'yes' | 'no' | 'maybe' };
        Update: Partial<EventRsvp>;
      };
      community_posts: {
        Row: CommunityPostRow;
        Insert: Partial<CommunityPostRow> & { church_id: string; author_person_id: string; post_type: CommunityPostDbType; body: string };
        Update: Partial<CommunityPostRow>;
      };
      community_reactions: {
        Row: CommunityReactionRow;
        Insert: Partial<CommunityReactionRow> & { church_id: string; post_id: string; person_id: string; reaction_type: 'pray' | 'amen' | 'share' };
        Update: never;
      };
      community_comments: {
        Row: CommunityCommentRow;
        Insert: Partial<CommunityCommentRow> & { church_id: string; post_id: string; author_person_id: string; body: string };
        Update: never;
      };
      member_connections: {
        Row: MemberConnectionRow;
        Insert: Partial<MemberConnectionRow> & { church_id: string; person_a_id: string; person_b_id: string };
        Update: never;
      };
      member_connection_requests: {
        Row: MemberConnectionRequestRow;
        Insert: Partial<MemberConnectionRequestRow> & { church_id: string; from_person_id: string; to_person_id: string };
        Update: Partial<MemberConnectionRequestRow>;
      };
      watch_sermons: {
        Row: WatchSermonRow;
        Insert: Partial<WatchSermonRow> & { church_id: string; title: string };
        Update: Partial<WatchSermonRow>;
      };
      watch_chat_messages: {
        Row: WatchChatMessageRow;
        Insert: Partial<WatchChatMessageRow> & { church_id: string; author_name: string; body: string };
        Update: Partial<WatchChatMessageRow>;
      };
      discipleship_milestones: {
        Row: DiscipleshipMilestoneRow;
        Insert: Partial<DiscipleshipMilestoneRow> & {
          church_id: string;
          person_id: string;
          milestone_type: MilestoneTypeDb;
        };
        Update: Partial<Pick<DiscipleshipMilestoneRow, 'completed_at' | 'notes' | 'verified_by'>>;
      };
    };
  };
}
