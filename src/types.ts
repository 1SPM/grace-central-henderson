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
}

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
  personId: string;
  amount: number;
  fund: 'tithe' | 'offering' | 'missions' | 'building' | 'other';
  date: string;
  method: 'cash' | 'check' | 'card' | 'online';
  isRecurring: boolean;
  note?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  location?: string;
  category: 'service' | 'meeting' | 'event' | 'small-group' | 'other';
  attendees?: string[];
}

export type View = 'dashboard' | 'people' | 'person' | 'tasks' | 'calendar' | 'groups' | 'prayer' | 'giving' | 'settings' | 'pipeline' | 'attendance' | 'volunteers';
