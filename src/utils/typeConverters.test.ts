import { describe, it, expect } from 'vitest';
import {
  toPersonLegacy,
  toTaskLegacy,
  toInteractionLegacy,
  toGroupLegacy,
  toPrayerLegacy,
  toEventLegacy,
  toGivingLegacy,
  DbPerson,
  DbTask,
  DbInteraction,
  DbGroup,
  DbPrayer,
  DbEvent,
  DbGiving,
} from './typeConverters';

describe('typeConverters', () => {
  describe('toPersonLegacy', () => {
    it('converts a complete database person to legacy format', () => {
      const dbPerson: DbPerson = {
        id: '123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        status: 'member',
        photo_url: 'https://example.com/photo.jpg',
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        birth_date: '1990-01-15',
        join_date: '2020-06-01',
        first_visit: '2020-05-15',
        notes: 'Active member',
        tags: ['volunteer', 'choir'],
        family_id: 'family-1',
      };

      const result = toPersonLegacy(dbPerson);

      expect(result).toEqual({
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        status: 'member',
        photo: 'https://example.com/photo.jpg',
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        birthDate: '1990-01-15',
        joinDate: '2020-06-01',
        firstVisit: '2020-05-15',
        notes: 'Active member',
        tags: ['volunteer', 'choir'],
        smallGroups: [],
        familyId: 'family-1',
      });
    });

    it('handles null values with defaults', () => {
      const dbPerson: DbPerson = {
        id: '456',
        first_name: 'Jane',
        last_name: 'Smith',
        email: null,
        phone: null,
        status: 'visitor',
        photo_url: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        birth_date: null,
        join_date: null,
        first_visit: null,
        notes: null,
        tags: [],
        family_id: null,
      };

      const result = toPersonLegacy(dbPerson);

      expect(result.email).toBe('');
      expect(result.phone).toBe('');
      expect(result.photo).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.city).toBeUndefined();
      expect(result.state).toBeUndefined();
      expect(result.zip).toBeUndefined();
      expect(result.birthDate).toBeUndefined();
      expect(result.joinDate).toBeUndefined();
      expect(result.firstVisit).toBeUndefined();
      expect(result.notes).toBeUndefined();
      expect(result.familyId).toBeUndefined();
    });
  });

  describe('toTaskLegacy', () => {
    it('converts a complete database task to legacy format', () => {
      const dbTask: DbTask = {
        id: 'task-1',
        person_id: 'person-1',
        title: 'Follow up call',
        description: 'Call about small group',
        due_date: '2024-02-01',
        completed: false,
        priority: 'high',
        category: 'follow-up',
        assigned_to: 'staff-1',
        created_at: '2024-01-15T10:00:00Z',
      };

      const result = toTaskLegacy(dbTask);

      expect(result).toEqual({
        id: 'task-1',
        personId: 'person-1',
        title: 'Follow up call',
        description: 'Call about small group',
        dueDate: '2024-02-01',
        completed: false,
        priority: 'high',
        category: 'follow-up',
        assignedTo: 'staff-1',
        createdAt: '2024-01-15T10:00:00Z',
      });
    });

    it('handles null person_id and assigned_to', () => {
      const dbTask: DbTask = {
        id: 'task-2',
        person_id: null,
        title: 'General task',
        description: null,
        due_date: '2024-02-15',
        completed: true,
        priority: 'low',
        category: 'admin',
        assigned_to: null,
        created_at: '2024-01-20T08:00:00Z',
      };

      const result = toTaskLegacy(dbTask);

      expect(result.personId).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.assignedTo).toBeUndefined();
    });
  });

  describe('toInteractionLegacy', () => {
    it('converts a database interaction to legacy format', () => {
      const dbInteraction: DbInteraction = {
        id: 'int-1',
        person_id: 'person-1',
        type: 'call',
        content: 'Discussed upcoming event',
        created_by_name: 'Pastor John',
        created_at: '2024-01-25T14:30:00Z',
      };

      const result = toInteractionLegacy(dbInteraction);

      expect(result).toEqual({
        id: 'int-1',
        personId: 'person-1',
        type: 'call',
        content: 'Discussed upcoming event',
        createdBy: 'Pastor John',
        createdAt: '2024-01-25T14:30:00Z',
      });
    });

    it('defaults createdBy to Unknown when null', () => {
      const dbInteraction: DbInteraction = {
        id: 'int-2',
        person_id: 'person-2',
        type: 'note',
        content: 'Added note',
        created_by_name: null,
        created_at: '2024-01-26T09:00:00Z',
      };

      const result = toInteractionLegacy(dbInteraction);

      expect(result.createdBy).toBe('Unknown');
    });
  });

  describe('toGroupLegacy', () => {
    it('converts a complete database group to legacy format', () => {
      const dbGroup: DbGroup = {
        id: 'group-1',
        name: 'Young Adults',
        description: 'For ages 18-30',
        leader_id: 'leader-1',
        meeting_day: 'Wednesday',
        meeting_time: '7:00 PM',
        location: 'Room 201',
        is_active: true,
        members: ['member-1', 'member-2', 'member-3'],
      };

      const result = toGroupLegacy(dbGroup);

      expect(result).toEqual({
        id: 'group-1',
        name: 'Young Adults',
        description: 'For ages 18-30',
        leaderId: 'leader-1',
        meetingDay: 'Wednesday',
        meetingTime: '7:00 PM',
        location: 'Room 201',
        members: ['member-1', 'member-2', 'member-3'],
        isActive: true,
      });
    });

    it('handles null values', () => {
      const dbGroup: DbGroup = {
        id: 'group-2',
        name: 'New Group',
        description: null,
        leader_id: null,
        meeting_day: null,
        meeting_time: null,
        location: null,
        is_active: false,
        members: [],
      };

      const result = toGroupLegacy(dbGroup);

      expect(result.description).toBeUndefined();
      expect(result.leaderId).toBe('');
      expect(result.meetingDay).toBeUndefined();
      expect(result.meetingTime).toBeUndefined();
      expect(result.location).toBeUndefined();
    });
  });

  describe('toPrayerLegacy', () => {
    it('converts a complete database prayer to legacy format', () => {
      const dbPrayer: DbPrayer = {
        id: 'prayer-1',
        person_id: 'person-1',
        content: 'Prayer for healing',
        is_private: false,
        is_answered: true,
        testimony: 'God answered!',
        created_at: '2024-01-10T12:00:00Z',
        updated_at: '2024-01-20T15:00:00Z',
      };

      const result = toPrayerLegacy(dbPrayer);

      expect(result).toEqual({
        id: 'prayer-1',
        personId: 'person-1',
        content: 'Prayer for healing',
        isPrivate: false,
        isAnswered: true,
        testimony: 'God answered!',
        createdAt: '2024-01-10T12:00:00Z',
        updatedAt: '2024-01-20T15:00:00Z',
      });
    });

    it('handles null testimony', () => {
      const dbPrayer: DbPrayer = {
        id: 'prayer-2',
        person_id: 'person-2',
        content: 'Prayer for guidance',
        is_private: true,
        is_answered: false,
        testimony: null,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      };

      const result = toPrayerLegacy(dbPrayer);

      expect(result.testimony).toBeUndefined();
    });
  });

  describe('toEventLegacy', () => {
    it('converts a complete database event to legacy format', () => {
      const dbEvent: DbEvent = {
        id: 'event-1',
        title: 'Sunday Service',
        description: 'Weekly worship service',
        start_date: '2024-02-04T10:00:00Z',
        end_date: '2024-02-04T12:00:00Z',
        all_day: false,
        location: 'Main Sanctuary',
        category: 'service',
      };

      const result = toEventLegacy(dbEvent);

      expect(result).toEqual({
        id: 'event-1',
        title: 'Sunday Service',
        description: 'Weekly worship service',
        startDate: '2024-02-04T10:00:00Z',
        endDate: '2024-02-04T12:00:00Z',
        allDay: false,
        location: 'Main Sanctuary',
        category: 'service',
      });
    });

    it('handles null values and all-day events', () => {
      const dbEvent: DbEvent = {
        id: 'event-2',
        title: 'Church Holiday',
        description: null,
        start_date: '2024-12-25',
        end_date: null,
        all_day: true,
        location: null,
        category: 'holiday',
      };

      const result = toEventLegacy(dbEvent);

      expect(result.description).toBeUndefined();
      expect(result.endDate).toBeUndefined();
      expect(result.location).toBeUndefined();
      expect(result.allDay).toBe(true);
    });
  });

  describe('toGivingLegacy', () => {
    it('converts a complete database giving to legacy format', () => {
      const dbGiving: DbGiving = {
        id: 'giving-1',
        person_id: 'person-1',
        amount: 100.5,
        fund: 'tithe',
        date: '2024-01-28',
        method: 'online',
        is_recurring: true,
        note: 'Monthly tithe',
      };

      const result = toGivingLegacy(dbGiving);

      expect(result).toEqual({
        id: 'giving-1',
        personId: 'person-1',
        amount: 100.5,
        fund: 'tithe',
        date: '2024-01-28',
        method: 'online',
        isRecurring: true,
        note: 'Monthly tithe',
      });
    });

    it('handles null person_id and note', () => {
      const dbGiving: DbGiving = {
        id: 'giving-2',
        person_id: null,
        amount: 50,
        fund: 'offering',
        date: '2024-01-21',
        method: 'cash',
        is_recurring: false,
        note: null,
      };

      const result = toGivingLegacy(dbGiving);

      expect(result.personId).toBeUndefined();
      expect(result.note).toBeUndefined();
    });
  });
});
