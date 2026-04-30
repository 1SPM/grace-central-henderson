import { describe, it, expect } from 'vitest';
import {
  parseActions,
  validateAction,
  resolvePerson,
  resolveTask,
  resolvePrayer,
  hydrateAction,
} from './grace-actions';
import type { Person, Task, PrayerRequest } from '../types';

const sarah: Person = {
  id: 'p1', firstName: 'Sarah', lastName: 'Kim', email: '', phone: '',
  status: 'visitor', tags: [], smallGroups: [],
};
const johnny: Person = {
  id: 'p2', firstName: 'Johnny', lastName: 'Carter', email: '', phone: '',
  status: 'member', tags: [], smallGroups: [],
};
const sarahKim2: Person = {
  id: 'p3', firstName: 'Sarah', lastName: 'Lopez', email: '', phone: '',
  status: 'regular', tags: [], smallGroups: [],
};
const people: Person[] = [sarah, johnny, sarahKim2];

describe('parseActions', () => {
  it('extracts a single action and replaces text with default prompt', () => {
    const text = 'Sure! <action>{"type":"add_person","firstName":"Sarah"}</action>';
    const r = parseActions(text);
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0].type).toBe('add_person');
    expect(r.actions[0].firstName).toBe('Sarah');
    expect(r.cleanText).toContain('Sure!');
  });

  it('extracts multiple action blocks', () => {
    const text = '<action>{"type":"add_person","firstName":"A"}</action><action>{"type":"add_task","title":"Call A"}</action>';
    const r = parseActions(text);
    expect(r.actions).toHaveLength(2);
    expect(r.actions[0].type).toBe('add_person');
    expect(r.actions[1].type).toBe('add_task');
    expect(r.cleanText).toMatch(/Ready to add 2/);
  });

  it('skips malformed JSON without crashing', () => {
    const text = 'Hi <action>{not json}</action> there';
    const r = parseActions(text);
    expect(r.actions).toHaveLength(0);
    expect(r.cleanText).toBe('Hi  there');
  });

  it('skips actions with invalid type', () => {
    const text = '<action>{"type":"delete_universe"}</action>';
    const r = parseActions(text);
    expect(r.actions).toHaveLength(0);
  });

  it('returns text unchanged when no action blocks', () => {
    const r = parseActions('Just answering a question.');
    expect(r.actions).toHaveLength(0);
    expect(r.cleanText).toBe('Just answering a question.');
  });
});

describe('validateAction', () => {
  it('accepts valid add_person', () => {
    const a = validateAction({ type: 'add_person', firstName: ' Sarah ', status: 'visitor' });
    expect(a?.firstName).toBe('Sarah');
    expect(a?.status).toBe('visitor');
  });

  it('rejects unknown type', () => {
    expect(validateAction({ type: 'destroy' })).toBeNull();
  });

  it('rejects unknown status, keeps rest', () => {
    const a = validateAction({ type: 'add_person', firstName: 'A', status: 'wizard' });
    expect(a).not.toBeNull();
    expect(a?.status).toBeUndefined();
  });

  it('drops invalid dueDate', () => {
    const a = validateAction({ type: 'add_task', title: 'X', dueDate: 'tomorrow' });
    expect(a?.dueDate).toBeUndefined();
  });

  it('keeps valid YYYY-MM-DD dueDate', () => {
    const a = validateAction({ type: 'add_task', title: 'X', dueDate: '2026-05-01' });
    expect(a?.dueDate).toBe('2026-05-01');
  });

  it('drops invalid priority', () => {
    const a = validateAction({ type: 'add_task', title: 'X', priority: 'urgent' });
    expect(a?.priority).toBeUndefined();
  });

  it('drops unknown keys', () => {
    const a = validateAction({ type: 'add_person', firstName: 'A', evilField: 'haha' }) as Record<string, unknown> | null;
    expect(a?.evilField).toBeUndefined();
  });

  it('returns null for non-objects', () => {
    expect(validateAction(null)).toBeNull();
    expect(validateAction('string')).toBeNull();
    expect(validateAction(42)).toBeNull();
  });
});

describe('resolvePerson', () => {
  it('matches exact full name', () => {
    expect(resolvePerson('Sarah Kim', people)?.id).toBe('p1');
  });

  it('matches first name when only one matches', () => {
    expect(resolvePerson('Johnny', people)?.id).toBe('p2');
  });

  it('returns first first-name match when multiple exist', () => {
    expect(resolvePerson('Sarah', people)?.id).toBe('p1');
  });

  it('falls back to partial full-name substring', () => {
    expect(resolvePerson('Lopez', people)?.id).toBe('p3');
  });

  it('is case insensitive', () => {
    expect(resolvePerson('SARAH KIM', people)?.id).toBe('p1');
  });

  it('returns undefined for empty / no match', () => {
    expect(resolvePerson(undefined, people)).toBeUndefined();
    expect(resolvePerson('Nobody', people)).toBeUndefined();
  });
});

describe('resolveTask', () => {
  const tasks: Task[] = [
    { id: 't1', title: 'Call Sarah about Sunday', completed: false, dueDate: '2026-05-01', priority: 'medium', category: 'follow-up', createdAt: '2026-04-01' },
    { id: 't2', title: 'Order communion supplies', completed: false, dueDate: '2026-05-02', priority: 'low', category: 'admin', createdAt: '2026-04-01' },
    { id: 't3', title: 'Call Sarah about Sunday', completed: true, dueDate: '2026-04-01', priority: 'medium', category: 'follow-up', createdAt: '2026-03-01' },
    { id: 't4', personId: 'p1', title: 'Welcome Sarah', completed: false, dueDate: '2026-05-05', priority: 'high', category: 'follow-up', createdAt: '2026-04-15' },
  ];

  it('finds exact title match among open tasks (skips completed)', () => {
    expect(resolveTask('Call Sarah about Sunday', undefined, tasks, people)?.id).toBe('t1');
  });

  it('finds partial title match', () => {
    expect(resolveTask('communion', undefined, tasks, people)?.id).toBe('t2');
  });

  it('falls back to person-based match when title not found', () => {
    expect(resolveTask('not a real task', 'Sarah Kim', tasks, people)?.id).toBe('t4');
  });

  it('returns undefined when nothing matches', () => {
    expect(resolveTask('xyz', 'Nobody', tasks, people)).toBeUndefined();
  });
});

describe('resolvePrayer', () => {
  const prayers: PrayerRequest[] = [
    { id: 'pr1', personId: 'p1', content: "Sarah's surgery on Tuesday", isPrivate: false, isAnswered: false, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
    { id: 'pr2', personId: 'p2', content: 'Johnny job search', isPrivate: false, isAnswered: false, createdAt: '2026-04-10', updatedAt: '2026-04-10' },
    { id: 'pr3', personId: 'p1', content: 'old answered prayer', isPrivate: false, isAnswered: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  it('finds active prayer by person', () => {
    expect(resolvePrayer(undefined, 'Sarah Kim', prayers, people)?.id).toBe('pr1');
  });

  it('skips answered prayers', () => {
    expect(resolvePrayer(undefined, 'Sarah Kim', prayers, people)?.isAnswered).toBe(false);
  });

  it('falls back to content substring', () => {
    expect(resolvePrayer('job search', undefined, prayers, people)?.id).toBe('pr2');
  });

  it('returns undefined when no match', () => {
    expect(resolvePrayer('nothing', 'Nobody', prayers, people)).toBeUndefined();
  });
});

describe('hydrateAction', () => {
  const tasks: Task[] = [
    { id: 't1', title: 'Welcome Sarah', completed: false, dueDate: '2026-05-01', priority: 'medium', category: 'follow-up', createdAt: '2026-04-01' },
  ];
  const prayers: PrayerRequest[] = [
    { id: 'pr1', personId: 'p1', content: 'surgery', isPrivate: false, isAnswered: false, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  ];
  const ctx = { people, tasks, prayers };

  it('hydrates personId from personName for add_task', () => {
    const out = hydrateAction({ type: 'add_task', title: 'Call', personName: 'Sarah Kim' }, ctx);
    expect(out.personId).toBe('p1');
    expect(out.personName).toBe('Sarah Kim');
  });

  it('hydrates taskId for mark_task_done', () => {
    const out = hydrateAction({ type: 'mark_task_done', taskTitle: 'Welcome Sarah' }, ctx);
    expect(out.taskId).toBe('t1');
  });

  it('hydrates prayerId + content for mark_prayer_answered', () => {
    const out = hydrateAction({ type: 'mark_prayer_answered', personName: 'Sarah Kim' }, ctx);
    expect(out.prayerId).toBe('pr1');
    expect(out.prayerContent).toBe('surgery');
  });

  it('leaves missing references empty rather than crashing', () => {
    const out = hydrateAction({ type: 'mark_task_done', taskTitle: 'no such task' }, ctx);
    expect(out.taskId).toBeUndefined();
  });
});
