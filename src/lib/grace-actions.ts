import type { Person, Task, PrayerRequest, MemberStatus, EventCategory } from '../types';

export type ActionType =
  | 'add_task'
  | 'add_prayer'
  | 'add_note'
  | 'add_person'
  | 'add_event'
  | 'mark_task_done'
  | 'update_task'
  | 'update_person_status'
  | 'mark_prayer_answered'
  | 'delete_task'
  | 'delete_person'
  | 'delete_prayer';

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
  startDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  category?: EventCategory;
}

const ACTION_TYPES: ReadonlySet<ActionType> = new Set<ActionType>([
  'add_task',
  'add_prayer',
  'add_note',
  'add_person',
  'add_event',
  'mark_task_done',
  'update_task',
  'update_person_status',
  'mark_prayer_answered',
  'delete_task',
  'delete_person',
  'delete_prayer',
]);

const EVENT_CATEGORIES: ReadonlySet<EventCategory> = new Set<EventCategory>([
  'service', 'meeting', 'event', 'small-group', 'holiday', 'wedding',
  'funeral', 'obituary', 'ceremony', 'baptism', 'dedication',
  'counseling', 'rehearsal', 'outreach',
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
  if (typeof type !== 'string' || !ACTION_TYPES.has(type as ActionType)) {
    if (typeof console !== 'undefined') {
      console.warn('[grace] dropped action with unknown type:', type, raw);
    }
    return null;
  }

  const out: PendingAction = { type: type as ActionType };

  const stringFields: Array<keyof PendingAction> = [
    'title', 'content', 'personName', 'personId',
    'firstName', 'lastName', 'email', 'phone',
    'taskTitle', 'taskId', 'prayerId', 'prayerContent', 'testimony',
    'location',
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

  if (typeof r.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate)) {
    out.startDate = r.startDate;
  }
  if (typeof r.startTime === 'string' && /^\d{2}:\d{2}$/.test(r.startTime)) {
    out.startTime = r.startTime;
  }
  if (typeof r.endTime === 'string' && /^\d{2}:\d{2}$/.test(r.endTime)) {
    out.endTime = r.endTime;
  }
  if (typeof r.allDay === 'boolean') {
    out.allDay = r.allDay;
  }
  if (typeof r.category === 'string' && EVENT_CATEGORIES.has(r.category as EventCategory)) {
    out.category = r.category as EventCategory;
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

const TASK_BATCH_FOLLOW_UP_RE = /^(?:ok(?:ay)?\s*)?(?:please\s*)?(?:do|handle|complete|finish|mark|clear)\s+(?:the\s+)?(?:tasks?|them|these|those|all)(?:\s+(?:tasks?|done|off))?[.!?\s]*$/i;

export function isTaskBatchFollowUp(query: string): boolean {
  return TASK_BATCH_FOLLOW_UP_RE.test(query.trim());
}

export function buildTaskCompletionActions(tasks: Task[], limit = 10): PendingAction[] {
  return tasks
    .filter(t => !t.completed)
    .slice(0, limit)
    .map(t => ({
      type: 'mark_task_done',
      taskId: t.id,
      taskTitle: t.title,
      personId: t.personId,
    }));
}

function normalizeTaskLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*•‣–—]|\d+[.)])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TASK_LIST_TRAILER_RE = /^(?:tasks?|to[-\s]?dos?|todo list|task list)$/i;

export function extractPastedTaskTitles(input: string, limit = 20): string[] {
  const rawLines = input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const hasTaskTrailer = rawLines.some(line => TASK_LIST_TRAILER_RE.test(normalizeTaskLine(line)));
  const bulletLikeCount = rawLines.filter(line => /^\s*(?:[-*•‣–—]|\d+[.)])\s+/.test(line)).length;
  const lines = rawLines
    .map(normalizeTaskLine)
    .filter(Boolean)
    .filter(line => !TASK_LIST_TRAILER_RE.test(line));

  if (lines.length < 2) return [];
  if (!hasTaskTrailer && bulletLikeCount < 2 && lines.length < 3) return [];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function isPastedTaskList(input: string): boolean {
  return extractPastedTaskTitles(input).length >= 2;
}

export function buildAddTaskActionsFromInput(input: string, limit = 20): PendingAction[] {
  return extractPastedTaskTitles(input, limit).map(title => ({
    type: 'add_task',
    title,
    priority: 'medium',
  }));
}

export function isOverdueTasksQuery(input: string): boolean {
  return /\b(?:what|show|list|which)\b[\s\S]*\b(?:tasks?|to[-\s]?dos?)\b[\s\S]*\boverdue\b/i.test(input.trim())
    || /\boverdue\b[\s\S]*\b(?:tasks?|to[-\s]?dos?)\b/i.test(input.trim());
}

export function getOverdueTasks(tasks: Task[], today = new Date().toISOString().slice(0, 10)): Task[] {
  return tasks
    .filter(t => !t.completed && Boolean(t.dueDate) && String(t.dueDate) < today)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

export function formatOverdueTasksResponse(tasks: Task[], today = new Date().toISOString().slice(0, 10)): string {
  const overdue = getOverdueTasks(tasks, today);
  if (overdue.length === 0) return 'No overdue tasks right now.';
  return `Overdue tasks (${overdue.length}):\n${overdue.map(t => `- ${t.title}${t.dueDate ? ` — due ${t.dueDate}` : ''}`).join('\n')}`;
}

export function hydrateAction(action: PendingAction, ctx: HydrateContext): PendingAction {
  const matched = resolvePerson(action.personName, ctx.people);
  let { taskId, prayerId, prayerContent, taskTitle } = action;

  if ((action.type === 'mark_task_done' || action.type === 'update_task' || action.type === 'delete_task') && !taskId) {
    const t = resolveTask(action.taskTitle, action.personName, ctx.tasks, ctx.people);
    if (t) {
      taskId = t.id;
      taskTitle = t.title;
    }
  }
  if ((action.type === 'mark_prayer_answered' || action.type === 'delete_prayer') && !prayerId) {
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
