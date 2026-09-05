import { describe, it, expect } from 'vitest';
import {
  parseActions,
  validateAction,
  resolvePerson,
  resolveTask,
  resolvePrayer,
  countPersonMatches,
  countTaskMatches,
  countPrayerMatches,
  hydrateAction,
  isTaskBatchFollowUp,
  buildTaskCompletionActions,
  extractPastedTaskTitles,
  isPastedTaskList,
  buildAddTaskActionsFromInput,
  isOverdueTasksQuery,
  getOverdueTasks,
  formatOverdueTasksResponse,
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

  it('leaves one paragraph break where an action block was stripped, not a hole', () => {
    // The model puts the action on its own paragraph; removing it left two
    // blank paragraphs back to back, which whitespace-pre-wrap rendered as a
    // gap in the bubble (2026-09-05 rehearsal).
    const text = "I'll remove ZZREHEARSAL DeleteMe from the system.\n\n<action>{\"type\":\"delete_person\",\"personName\":\"ZZREHEARSAL DeleteMe\"}</action>\n\nReview and confirm when you're ready, and I'll save it.";
    const r = parseActions(text);
    expect(r.actions).toHaveLength(1);
    expect(r.cleanText).toBe("I'll remove ZZREHEARSAL DeleteMe from the system.\n\nReview and confirm when you're ready, and I'll save it.");
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

// ADR-018 action-resolution safety closure: resolvePerson/resolveTask/
// resolvePrayer above are UNCHANGED (same signature, same first-match
// behavior, all 41 pre-existing tests still pass) — these are the new,
// additive companions that make ambiguity visible instead of silently
// picking a winner.
describe('countPersonMatches', () => {
  it('returns every candidate at the SAME tier resolvePerson would pick from — the existing "Sarah"/"Sarah Kim" fixture is a real collision at the first-name tier', () => {
    // resolvePerson('Sarah', people) deterministically returns p1 (first in
    // array) per the pre-existing test above — this proves that "winner"
    // was really an arbitrary pick among 2 real candidates.
    const matches = countPersonMatches('Sarah', people);
    expect(matches.map(p => p.id).sort()).toEqual(['p1', 'p3']);
  });

  it('a full-name match is unambiguous even when the first name collides', () => {
    expect(countPersonMatches('Sarah Kim', people)).toHaveLength(1);
    expect(countPersonMatches('Sarah Kim', people)[0].id).toBe('p1');
  });

  it('zero matches for a name nobody has', () => {
    expect(countPersonMatches('Nobody', people)).toHaveLength(0);
  });

  it('empty/undefined name returns no candidates', () => {
    expect(countPersonMatches(undefined, people)).toHaveLength(0);
    expect(countPersonMatches('', people)).toHaveLength(0);
  });
});

describe('countTaskMatches', () => {
  const openCollisionTasks: Task[] = [
    { id: 't1', title: 'Follow up', completed: false, dueDate: '2026-05-01', priority: 'medium', category: 'follow-up', createdAt: '2026-04-01' },
    { id: 't2', title: 'Follow up', completed: false, dueDate: '2026-05-02', priority: 'low', category: 'follow-up', createdAt: '2026-04-02' },
    { id: 't3', title: 'Follow up', completed: true, dueDate: '2026-04-01', priority: 'medium', category: 'follow-up', createdAt: '2026-03-01' },
  ];

  it('detects a genuine open-task title collision (completed tasks excluded)', () => {
    const matches = countTaskMatches('Follow up', undefined, openCollisionTasks, people);
    expect(matches.map(t => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('a unique open title is unambiguous', () => {
    const tasks: Task[] = [{ id: 't1', title: 'Unique title', completed: false, dueDate: '2026-05-01', priority: 'medium', category: 'follow-up', createdAt: '2026-04-01' }];
    expect(countTaskMatches('Unique title', undefined, tasks, people)).toHaveLength(1);
  });

  it('falls back to person-based matching when title does not match, and stays a single match for a unique person', () => {
    const tasks: Task[] = [{ id: 't1', personId: 'p1', title: 'Something else', completed: false, dueDate: '2026-05-01', priority: 'medium', category: 'follow-up', createdAt: '2026-04-01' }];
    expect(countTaskMatches('not a real task', 'Sarah Kim', tasks, people)).toHaveLength(1);
  });

  it('an ambiguous PERSON reference also makes the resulting task lookup ambiguous', () => {
    const tasks: Task[] = [
      { id: 't1', personId: 'p1', title: 'Task for p1', completed: false, dueDate: '2026-05-01', priority: 'medium', category: 'follow-up', createdAt: '2026-04-01' },
      { id: 't2', personId: 'p3', title: 'Task for p3', completed: false, dueDate: '2026-05-02', priority: 'medium', category: 'follow-up', createdAt: '2026-04-02' },
    ];
    // "Sarah" alone collides between p1 and p3 (see countPersonMatches above)
    const matches = countTaskMatches('not a real task', 'Sarah', tasks, people);
    expect(matches.map(t => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('zero matches when nothing fits', () => {
    expect(countTaskMatches('xyz', 'Nobody', openCollisionTasks, people)).toHaveLength(0);
  });
});

describe('countPrayerMatches', () => {
  it('detects a genuine active-prayer collision for an ambiguous person reference', () => {
    const prayers: PrayerRequest[] = [
      { id: 'pr1', personId: 'p1', content: 'surgery', isPrivate: false, isAnswered: false, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
      { id: 'pr2', personId: 'p3', content: 'job search', isPrivate: false, isAnswered: false, createdAt: '2026-04-02', updatedAt: '2026-04-02' },
    ];
    const matches = countPrayerMatches(undefined, 'Sarah', prayers, people);
    expect(matches.map(p => p.id).sort()).toEqual(['pr1', 'pr2']);
  });

  it('an unambiguous full-name person reference stays a single match', () => {
    const prayers: PrayerRequest[] = [{ id: 'pr1', personId: 'p1', content: 'surgery', isPrivate: false, isAnswered: false, createdAt: '2026-04-01', updatedAt: '2026-04-01' }];
    expect(countPrayerMatches(undefined, 'Sarah Kim', prayers, people)).toHaveLength(1);
  });

  it('excludes answered prayers from collision detection', () => {
    const prayers: PrayerRequest[] = [
      { id: 'pr1', personId: 'p1', content: 'surgery', isPrivate: false, isAnswered: false, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
      { id: 'pr2', personId: 'p3', content: 'old', isPrivate: false, isAnswered: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ];
    expect(countPrayerMatches(undefined, 'Sarah', prayers, people)).toHaveLength(1);
  });

  it('falls back to content substring when person is not given', () => {
    const prayers: PrayerRequest[] = [{ id: 'pr1', personId: 'p1', content: 'job search', isPrivate: false, isAnswered: false, createdAt: '2026-04-01', updatedAt: '2026-04-01' }];
    expect(countPrayerMatches('job search', undefined, prayers, people)).toHaveLength(1);
  });
});

describe('deterministic task follow-up actions', () => {
  const tasks: Task[] = [
    { id: 't1', title: 'Thank Christopher Hall for first gift', completed: false, dueDate: '2026-05-01', priority: 'high', category: 'follow-up', createdAt: '2026-04-01' },
    { id: 't2', title: 'Acknowledge Richard Andersons missions gift', completed: false, dueDate: '2026-05-02', priority: 'medium', category: 'follow-up', createdAt: '2026-04-02' },
    { id: 't3', title: 'Already done', completed: true, dueDate: '2026-05-03', priority: 'low', category: 'admin', createdAt: '2026-04-03' },
  ];

  it('detects short follow-up commands that mean complete the listed tasks', () => {
    expect(isTaskBatchFollowUp('ok do tasks')).toBe(true);
    expect(isTaskBatchFollowUp('do them')).toBe(true);
    expect(isTaskBatchFollowUp('handle these')).toBe(true);
    expect(isTaskBatchFollowUp('complete all tasks')).toBe(true);
    expect(isTaskBatchFollowUp('what tasks are overdue?')).toBe(false);
  });

  it('builds mark_task_done action cards for open tasks without calling AI', () => {
    const actions = buildTaskCompletionActions(tasks);
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({
      type: 'mark_task_done',
      taskId: 't1',
      taskTitle: 'Thank Christopher Hall for first gift',
    });
    expect(actions[1].taskId).toBe('t2');
  });

  it('caps vague batch completion at 10 tasks', () => {
    const manyTasks: Task[] = Array.from({ length: 12 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      completed: false,
      dueDate: '2026-05-01',
      priority: 'medium',
      category: 'follow-up',
      createdAt: '2026-04-01',
    }));
    expect(buildTaskCompletionActions(manyTasks)).toHaveLength(10);
  });
});

describe('deterministic pasted task list actions', () => {
  const pasted = `Thank Maria for bringing guest
* Follow up with Cam 1993
* Follow up with Marcus Taylor
* Connect Ashley with young adults
* Check on Michelle Youngs family
* Invite Brian Cooper to membership class
* Thank Christopher Hall for first gift
* Acknowledge Richard Andersons missions gift
* Plan March events calendar
* Birthday outreach to Andrew Clark
* Review volunteer schedule for March
tasks`;

  it('detects pasted multiline task lists before calling AI', () => {
    expect(isPastedTaskList(pasted)).toBe(true);
    expect(isPastedTaskList('what tasks are overdue?')).toBe(false);
  });

  it('extracts task titles and ignores bullet markers plus trailing tasks label', () => {
    const titles = extractPastedTaskTitles(pasted);
    expect(titles).toHaveLength(11);
    expect(titles[0]).toBe('Thank Maria for bringing guest');
    expect(titles[1]).toBe('Follow up with Cam 1993');
    expect(titles).not.toContain('tasks');
  });

  it('builds editable add_task cards from pasted lines without Gemini', () => {
    const actions = buildAddTaskActionsFromInput(pasted);
    expect(actions).toHaveLength(11);
    expect(actions[0]).toMatchObject({
      type: 'add_task',
      title: 'Thank Maria for bringing guest',
      priority: 'medium',
    });
    expect(actions[10].title).toBe('Review volunteer schedule for March');
  });

  it('caps pasted task list actions at 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => `Task ${i + 1}`).join('\n');
    expect(buildAddTaskActionsFromInput(`${many}\ntasks`)).toHaveLength(20);
  });
});

describe('deterministic overdue task answers', () => {
  const tasks: Task[] = [
    { id: 'old2', title: 'Older overdue', completed: false, dueDate: '2026-03-01', priority: 'medium', category: 'follow-up', createdAt: '2026-02-01' },
    { id: 'done', title: 'Completed overdue', completed: true, dueDate: '2026-03-02', priority: 'medium', category: 'follow-up', createdAt: '2026-02-01' },
    { id: 'future', title: 'Future task', completed: false, dueDate: '2026-05-02', priority: 'medium', category: 'follow-up', createdAt: '2026-04-01' },
    { id: 'old1', title: 'Newest overdue', completed: false, dueDate: '2026-04-01', priority: 'high', category: 'follow-up', createdAt: '2026-03-01' },
  ];

  it('detects overdue task lookup questions', () => {
    expect(isOverdueTasksQuery('What tasks are overdue?')).toBe(true);
    expect(isOverdueTasksQuery('show overdue todos')).toBe(true);
    expect(isOverdueTasksQuery('add a task')).toBe(false);
  });

  it('returns only incomplete tasks due before today, sorted by due date', () => {
    const overdue = getOverdueTasks(tasks, '2026-04-30');
    expect(overdue.map(t => t.id)).toEqual(['old2', 'old1']);
  });

  it('formats overdue task answers without calling AI', () => {
    expect(formatOverdueTasksResponse(tasks, '2026-04-30')).toContain('Overdue tasks (2)');
    expect(formatOverdueTasksResponse([], '2026-04-30')).toBe('No overdue tasks right now.');
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

  // ADR-018 action-resolution safety closure — fail closed on ambiguity.
  it('a bare first name that collides between two real people sets personAmbiguous and leaves personId unset (never the arbitrary first match)', () => {
    const out = hydrateAction({ type: 'add_note', personName: 'Sarah', content: 'x' }, ctx);
    expect(out.personAmbiguous).toBe(true);
    expect(out.personId).toBeUndefined();
    expect(out.personCandidates?.sort()).toEqual(['Sarah Kim', 'Sarah Lopez']);
    // Original, unresolved text is preserved — never silently rewritten to one candidate's full name.
    expect(out.personName).toBe('Sarah');
  });

  it('a full name (unambiguous, even with a first-name collision elsewhere in the roster) resolves normally', () => {
    const out = hydrateAction({ type: 'add_note', personName: 'Sarah Kim', content: 'x' }, ctx);
    expect(out.personAmbiguous).toBeUndefined();
    expect(out.personId).toBe('p1');
  });

  it('an open-task title collision sets taskAmbiguous and leaves taskId unset', () => {
    const collidingCtx = {
      people, prayers,
      tasks: [
        { id: 'ta', title: 'Follow up', completed: false, dueDate: '2026-05-01', priority: 'medium' as const, category: 'follow-up' as const, createdAt: '2026-04-01' },
        { id: 'tb', title: 'Follow up', completed: false, dueDate: '2026-05-02', priority: 'low' as const, category: 'follow-up' as const, createdAt: '2026-04-02' },
      ],
    };
    const out = hydrateAction({ type: 'mark_task_done', taskTitle: 'Follow up' }, collidingCtx);
    expect(out.taskAmbiguous).toBe(true);
    expect(out.taskId).toBeUndefined();
    expect(out.taskCandidates?.sort()).toEqual(['Follow up', 'Follow up']);
  });

  it('an active-prayer collision (via an ambiguous person reference) sets prayerAmbiguous and leaves prayerId unset, without echoing prayer content as a disambiguation hint', () => {
    const collidingCtx = {
      people, tasks,
      prayers: [
        { id: 'pra', personId: 'p1', content: 'surgery detail one', isPrivate: false, isAnswered: false, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
        { id: 'prb', personId: 'p3', content: 'surgery detail two', isPrivate: false, isAnswered: false, createdAt: '2026-04-02', updatedAt: '2026-04-02' },
      ],
    };
    const out = hydrateAction({ type: 'mark_prayer_answered', personName: 'Sarah' }, collidingCtx);
    expect(out.prayerAmbiguous).toBe(true);
    expect(out.prayerId).toBeUndefined();
    // PendingAction has no prayerCandidates field at all (unlike person/task) —
    // prayer content is sensitive and must never be used to disambiguate.
    expect('prayerCandidates' in out).toBe(false);
  });
});
