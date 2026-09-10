import { describe, it, expect } from 'vitest';
import type { CalendarEvent, Person, PrayerRequest, Task } from '../types';
import { deriveFollowUps, deriveNewPeople, deriveSundayReadiness } from './mobileAttention';

const NOW = new Date('2026-08-31T12:00:00'); // a Monday

function person(overrides: Partial<Person>): Person {
  return {
    id: 'p1',
    firstName: 'Test',
    lastName: 'Person',
    email: '',
    phone: '',
    status: 'member',
    tags: [],
    smallGroups: [],
    ...overrides,
  };
}

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'A task',
    dueDate: '2026-09-01',
    completed: false,
    priority: 'medium',
    category: 'admin',
    createdAt: '2026-08-29T10:00:00',
    ...overrides,
  };
}

function prayer(overrides: Partial<PrayerRequest>): PrayerRequest {
  return {
    id: 'pr1',
    personId: 'p1',
    content: 'Please pray',
    isPrivate: false,
    isAnswered: false,
    createdAt: '2026-08-29T10:00:00',
    updatedAt: '2026-08-29T10:00:00',
    ...overrides,
  };
}

function serviceEvent(id: string, startDate: string): CalendarEvent {
  return { id, title: 'Sunday Service', startDate, allDay: false, category: 'service' };
}

describe('deriveFollowUps', () => {
  it('joins open follow-up tasks to their person', () => {
    const sarah = person({ id: 'sarah', firstName: 'Sarah', lastName: 'Mitchell' });
    const items = deriveFollowUps(
      [sarah],
      [task({ id: 't1', personId: 'sarah', category: 'follow-up', title: 'Prayer request' })],
      [],
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0].person.id).toBe('sarah');
    expect(items[0].reason).toBe('Prayer request');
    expect(items[0].ageDays).toBe(2);
  });

  it('includes active non-private prayers but never private ones', () => {
    const p = person({ id: 'p1' });
    const items = deriveFollowUps(
      [p],
      [],
      [prayer({ id: 'a', personId: 'p1' }), prayer({ id: 'b', personId: 'p1', isPrivate: true })],
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('prayer');
  });

  it('dedupes per person — the follow-up task wins over the prayer', () => {
    const p = person({ id: 'p1' });
    const items = deriveFollowUps(
      [p],
      [task({ personId: 'p1', category: 'follow-up' })],
      [prayer({ personId: 'p1' })],
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('task');
  });

  it('ignores completed tasks, answered prayers, and unknown people', () => {
    const items = deriveFollowUps(
      [person({ id: 'p1' })],
      [
        task({ id: 't1', personId: 'p1', category: 'follow-up', completed: true }),
        task({ id: 't2', personId: 'ghost', category: 'follow-up' }),
      ],
      [prayer({ personId: 'p1', isAnswered: true })],
      NOW,
    );
    expect(items).toHaveLength(0);
  });
});

describe('deriveNewPeople', () => {
  it('groups recent visitors sharing a familyId into a named family', () => {
    const dad = person({ id: 'd', firstName: 'Jim', lastName: 'Johnson', status: 'visitor', firstVisit: '2026-08-29', familyId: 'fam1' });
    const mom = person({ id: 'm', firstName: 'Ann', lastName: 'Johnson', status: 'visitor', firstVisit: '2026-08-29', familyId: 'fam1' });
    const result = deriveNewPeople([dad, mom], [], NOW);
    expect(result.families).toHaveLength(1);
    expect(result.families[0].label).toBe('The Johnson Family');
    expect(result.families[0].hasFollowUp).toBe(false);
    expect(result.count).toBe(2);
  });

  it('treats a lone family member as an individual and flags existing follow-up', () => {
    const emily = person({ id: 'e', firstName: 'Emily', lastName: 'Roberts', status: 'visitor', firstVisit: '2026-08-26', familyId: 'fam2' });
    const result = deriveNewPeople([emily], [task({ personId: 'e', category: 'follow-up' })], NOW);
    expect(result.families).toHaveLength(0);
    expect(result.individuals).toHaveLength(1);
    expect(result.individuals[0].hasFollowUp).toBe(true);
    expect(result.individuals[0].joinedDaysAgo).toBe(5);
  });

  it('excludes visitors older than 7 days and non-visitors', () => {
    const old = person({ id: 'o', status: 'visitor', firstVisit: '2026-08-01' });
    const member = person({ id: 'm2', status: 'member', firstVisit: '2026-08-30' });
    const result = deriveNewPeople([old, member], [], NOW);
    expect(result.count).toBe(0);
  });
});

describe('deriveSundayReadiness', () => {
  const nextSunday = serviceEvent('svc1', '2026-09-06T10:00:00');

  it('finds the next Sunday service, skipping non-Sunday services', () => {
    const xmasEve = serviceEvent('xmas', '2026-09-03T17:00:00'); // Thursday service
    const readiness = deriveSundayReadiness([], [xmasEve, nextSunday], NOW);
    expect(readiness.service?.id).toBe('svc1');
  });

  it('reports a percentage only with 3+ tracked tasks in the window', () => {
    const tasks = [
      task({ id: 'a', dueDate: '2026-09-02', completed: true }),
      task({ id: 'b', dueDate: '2026-09-04', completed: true }),
      task({ id: 'c', dueDate: '2026-09-05', completed: false }),
    ];
    const readiness = deriveSundayReadiness(tasks, [nextSunday], NOW);
    expect(readiness.kind).toBe('quantitative');
    expect(readiness.pct).toBe(67);
    expect(readiness.openCount).toBe(1);
  });

  it('stays qualitative below the threshold — no fabricated percentage', () => {
    const readiness = deriveSundayReadiness([task({ id: 'a', dueDate: '2026-09-02' })], [nextSunday], NOW);
    expect(readiness.kind).toBe('qualitative');
    expect(readiness.pct).toBeUndefined();
    expect(readiness.openCount).toBe(1);
  });

  it('is qualitative with zero tasks and no service on an empty calendar', () => {
    const readiness = deriveSundayReadiness([], [], NOW);
    expect(readiness.service).toBeNull();
    expect(readiness.kind).toBe('qualitative');
    expect(readiness.totalCount).toBe(0);
  });

  it('resolves the next Sunday across a month boundary', () => {
    const endOfMonth = new Date('2026-08-31T12:00:00');
    const septService = serviceEvent('sept', '2026-09-06T10:00:00');
    const readiness = deriveSundayReadiness([], [septService], endOfMonth);
    expect(readiness.service?.id).toBe('sept');
  });

  it('ignores tasks due after Sunday', () => {
    const tasks = [
      task({ id: 'a', dueDate: '2026-09-10' }),
      task({ id: 'b', dueDate: '2026-09-20' }),
      task({ id: 'c', dueDate: '2026-09-30' }),
    ];
    const readiness = deriveSundayReadiness(tasks, [nextSunday], NOW);
    expect(readiness.totalCount).toBe(0);
    expect(readiness.kind).toBe('qualitative');
  });
});
