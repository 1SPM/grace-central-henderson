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
export type UserRole = 'admin' | 'staff' | 'volunteer';

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
    };
  };
}
