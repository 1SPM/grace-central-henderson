import type { Person, Task, PrayerRequest, MemberStatus } from '../types';

export type ActionType =
  | 'add_task'
  | 'add_prayer'
  | 'add_note'
  | 'add_person'
  | 'mark_task_done'
  | 'update_person_status'
  | 'mark_prayer_answered';

export interface PendingAction {
  type: ActionType;
  title?: string;
  content?: string;
  personName?: string;
  personId?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: MemberStatus;
  taskTitle?: string;
  taskId?: string;
  prayerId?: string;
  prayerContent?: string;
  testimony?: string;
}

const ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  'add_task',
  'add_prayer',
  'add_note',
  'add_person',
  'mark_task_done',
  'update_person_status',
  'mark_prayer_answered',
]);

export interface ParseResult {
  cleanText: string;
  actions: PendingAction[];
}

export function parseActions(text: string): ParseResult {
  const matches = [...text.matchAll(/<action>([\s\S]*?)<\/action>/g)];
  if (matches.length === 0) return { cleanText: text, actions: [] };

  const actions: PendingAction[] = [];
  let cleanText = text;
  for (const m of matches) {
    cleanText = cleanText.replace(m[0], '');
    try {
      const raw = JSON.parse(m[1]);
      const valid = validateAction(raw);
      if (valid) actions.push(valid);
    } catch {
      // malformed JSON — skip silently
    }
  }
  cleanText = cleanText.trim();
  if (!cleanText) {
    cleanText = actions.length === 1
      ? 'Ready to add this? Review and edit, then click Execute.'
      : actions.length > 1
        ? `Ready to add ${actions.length} items. Review each, then click Execute.`
        : '';
  }
  return { cleanText, actions };
}

export function validateAction(raw: unknown): PendingAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (typeof type !== 'string' || !ACTION_TYPES.has(type as ActionType)) return null;

  const out: PendingAction = { type: type as ActionType };

  const stringFields: Array<keyof PendingAction> = [
    'title', 'content', 'personName', 'personId',
    'firstName', 'lastName', 'email', 'phone',
    'taskTitle', 'taskId', 'prayerId', 'prayerContent', 'testimony',
  ];
  for (const k of stringFields) {
    const v = r[k as string];
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) (out as unknown as Record<string, unknown>)[k as string] = trimmed;
    }
  }

  if (typeof r.priority === 'string' && (r.priority === 'low' || r.priority === 'medium' || r.priority === 'high')) {
    out.priority = r.priority;
  }

  if (typeof r.status === 'string') {
    const s = r.status.toLowerCase().trim();
    if (s === 'visitor' || s === 'regular' || s === 'member' || s === 'leader' || s === 'inactive') {
      out.status = s as MemberStatus;
    }
  }

  if (typeof r.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate)) {
    out.dueDate = r.dueDate;
  }

  return out;
}

export function resolvePerson(name: string | undefined, people: Person[]): Person | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();
  return people.find(p => `${p.firstName} ${p.lastName}`.toLowerCase() === lower)
    || people.find(p => p.firstName.toLowerCase() === lower)
    || people.find(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(lower));
}

export function resolveTask(
  title: string | undefined,
  personName: string | undefined,
  tasks: Task[],
  people: Person[],
): Task | undefined {
  const open = tasks.filter(t => !t.completed);
  if (title) {
    const lower = title.toLowerCase().trim();
    const exact = open.find(t => t.title.toLowerCase() === lower);
    if (exact) return exact;
    const partial = open.find(t => t.title.toLowerCase().includes(lower));
    if (partial) return partial;
  }
  if (personName) {
    const person = resolvePerson(personName, people);
    if (person) return open.find(t => t.personId === person.id);
  }
  return undefined;
}

export function resolvePrayer(
  content: string | undefined,
  personName: string | undefined,
  prayers: PrayerRequest[],
  people: Person[],
): PrayerRequest | undefined {
  const active = prayers.filter(p => !p.isAnswered);
  if (personName) {
    const person = resolvePerson(personName, people);
    if (person) {
      const match = active.find(p => p.personId === person.id);
      if (match) return match;
    }
  }
  if (content) {
    const lower = content.toLowerCase().trim();
    return active.find(p => p.content.toLowerCase().includes(lower));
  }
  return undefined;
}

export interface HydrateContext {
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
}

export function hydrateAction(action: PendingAction, ctx: HydrateContext): PendingAction {
  const matched = resolvePerson(action.personName, ctx.people);
  let { taskId, prayerId, prayerContent, taskTitle } = action;

  if (action.type === 'mark_task_done' && !taskId) {
    const t = resolveTask(action.taskTitle, action.personName, ctx.tasks, ctx.people);
    if (t) {
      taskId = t.id;
      taskTitle = t.title;
    }
  }
  if (action.type === 'mark_prayer_answered' && !prayerId) {
    const p = resolvePrayer(action.prayerContent, action.personName, ctx.prayers, ctx.people);
    if (p) {
      prayerId = p.id;
      prayerContent = p.content;
    }
  }

  return {
    ...action,
    personId: matched?.id ?? action.personId,
    personName: matched ? `${matched.firstName} ${matched.lastName}` : action.personName,
    taskId,
    taskTitle,
    prayerId,
    prayerContent,
  };
}
