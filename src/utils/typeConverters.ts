/**
 * Type conversion utilities for converting between database and legacy component types
 */

import type { Person as LegacyPerson, Task as LegacyTask, Interaction as LegacyInteraction } from '../types';

// Database person type
export interface DbPerson {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
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
}

// Database task type
export interface DbTask {
  id: string;
  person_id: string | null;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  priority: string;
  category: string;
  assigned_to: string | null;
  created_at: string;
}

// Database interaction type
export interface DbInteraction {
  id: string;
  person_id: string;
  type: string;
  content: string;
  created_by_name: string | null;
  created_at: string;
}

// Database group type
export interface DbGroup {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  location: string | null;
  is_active: boolean;
  members: string[];
}

// Database prayer type
export interface DbPrayer {
  id: string;
  person_id: string;
  content: string;
  is_private: boolean;
  is_answered: boolean;
  testimony: string | null;
  created_at: string;
  updated_at: string;
}

// Database event type
export interface DbEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  location: string | null;
  category: string;
}

// Database giving type
export interface DbGiving {
  id: string;
  person_id: string | null;
  amount: number;
  fund: string;
  date: string;
  method: string;
  is_recurring: boolean;
  note: string | null;
}

// Convert database person to legacy format
export function toPersonLegacy(p: DbPerson): LegacyPerson {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email || '',
    phone: p.phone || '',
    status: p.status as LegacyPerson['status'],
    photo: p.photo_url || undefined,
    address: p.address || undefined,
    city: p.city || undefined,
    state: p.state || undefined,
    zip: p.zip || undefined,
    birthDate: p.birth_date || undefined,
    joinDate: p.join_date || undefined,
    firstVisit: p.first_visit || undefined,
    notes: p.notes || undefined,
    tags: p.tags,
    smallGroups: [], // Will be populated separately
    familyId: p.family_id || undefined,
  };
}

// Convert database task to legacy format
export function toTaskLegacy(t: DbTask): LegacyTask {
  return {
    id: t.id,
    personId: t.person_id || undefined,
    title: t.title,
    description: t.description || undefined,
    dueDate: t.due_date,
    completed: t.completed,
    priority: t.priority as LegacyTask['priority'],
    category: t.category as LegacyTask['category'],
    assignedTo: t.assigned_to || undefined,
    createdAt: t.created_at,
  };
}

// Convert database interaction to legacy format
export function toInteractionLegacy(i: DbInteraction): LegacyInteraction {
  return {
    id: i.id,
    personId: i.person_id,
    type: i.type as LegacyInteraction['type'],
    content: i.content,
    createdBy: i.created_by_name || 'Unknown',
    createdAt: i.created_at,
  };
}

// Convert database group to legacy format
export function toGroupLegacy(g: DbGroup) {
  return {
    id: g.id,
    name: g.name,
    description: g.description || undefined,
    leaderId: g.leader_id || '',
    meetingDay: g.meeting_day || undefined,
    meetingTime: g.meeting_time || undefined,
    location: g.location || undefined,
    members: g.members,
    isActive: g.is_active,
  };
}

// Convert database prayer to legacy format
export function toPrayerLegacy(p: DbPrayer) {
  return {
    id: p.id,
    personId: p.person_id,
    content: p.content,
    isPrivate: p.is_private,
    isAnswered: p.is_answered,
    testimony: p.testimony || undefined,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

// Convert database event to legacy format
export function toEventLegacy(e: DbEvent) {
  return {
    id: e.id,
    title: e.title,
    description: e.description || undefined,
    startDate: e.start_date,
    endDate: e.end_date || undefined,
    allDay: e.all_day,
    location: e.location || undefined,
    category: e.category as 'service' | 'event' | 'meeting' | 'holiday',
  };
}

// Convert database giving to legacy format
export function toGivingLegacy(g: DbGiving) {
  return {
    id: g.id,
    personId: g.person_id || undefined,
    amount: g.amount,
    fund: g.fund as 'tithe' | 'offering' | 'missions' | 'building' | 'benevolence' | 'other',
    date: g.date,
    method: g.method as 'cash' | 'check' | 'online' | 'bank',
    isRecurring: g.is_recurring,
    note: g.note || undefined,
  };
}
