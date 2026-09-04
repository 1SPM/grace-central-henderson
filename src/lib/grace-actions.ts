import type { Person, Task, PrayerRequest, MemberStatus, EventCategory } from '../types';
import { actionTypesForSurface } from './actionCatalog';
import { countPersonMatches } from './personMatching';

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
  | 'delete_prayer'
  | 'send_email'
  | 'send_sms';

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
  subject?: string;
  body?: string;
  message?: string;
  /**
   * Set by hydrateAction (ADR-018 action-resolution safety closure) when
   * personName/taskTitle/prayer matched MORE THAN ONE record — never
   * when it matched zero. A handler MUST refuse to proceed while any of
   * these are true, before any other check (including approval routing) —
   * see handlers.ts's blockOnAmbiguity, called first in every handler that
   * resolves an entity. personId/taskId/prayerId are deliberately left
   * unset in the ambiguous case (never the first/arbitrary candidate), so
   * a handler that somehow skipped the explicit check still fails closed
   * on the existing "missing id" check rather than silently proceeding.
   */
  personAmbiguous?: boolean;
  /** Full names only — safe to show for disambiguation. Never populated for tasks/prayers: a task title is fine to echo back, but prayer CONTENT is sensitive and must never be used as a disambiguation hint (item 8's "do not expose protected information merely to disambiguate"). */
  personCandidates?: string[];
  taskAmbiguous?: boolean;
  taskCandidates?: string[];
  prayerAmbiguous?: boolean;
}

// Derived from the catalog rather than restated here. This set and the
// ActionType union above were two hand-maintained copies of the same facts in
// one file, and the prompt that teaches the model to emit them was a third
// copy in another file entirely. actionCatalogBinding.test.ts now holds the
// union and the catalog together; this removes the copy that had no
// enforcement at all.
const ACTION_TYPES: ReadonlySet<string> = new Set(actionTypesForSurface('chat'));

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
    'location', 'subject', 'body', 'message',
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

// ---------------------------------------------------------------------
// Ambiguity detection (ADR-018 action-resolution safety closure) —
// additive companions to resolvePerson/resolveTask/resolvePrayer above,
// which are left completely unchanged (same signature, same first-match
// behavior, same existing tests) so nothing that already depends on them
// breaks. Each count* function mirrors its resolve* counterpart's exact
// tier logic (same order, same predicates) but returns EVERY match at
// whichever tier had a hit, instead of just the first — so
// `.length > 1` means "resolvePerson picked one of these arbitrarily,"
// not a new or different judgment about who matches.
// ---------------------------------------------------------------------

// countPersonMatches lives in personMatching.ts (a dependency-free leaf) so
// the server person-lookup route can share it without dragging this module's
// imports into a Node ESM function. Re-exported here so callers are unchanged.
export { countPersonMatches };

export function countTaskMatches(
  title: string | undefined,
  personName: string | undefined,
  tasks: Task[],
  people: Person[],
): Task[] {
  const open = tasks.filter(t => !t.completed);
  if (title) {
    const lower = title.toLowerCase().trim();
    const exact = open.filter(t => t.title.toLowerCase() === lower);
    if (exact.length > 0) return exact;
    const partial = open.filter(t => t.title.toLowerCase().includes(lower));
    if (partial.length > 0) return partial;
  }
  if (personName) {
    const personCandidates = countPersonMatches(personName, people);
    if (personCandidates.length === 1) {
      return open.filter(t => t.personId === personCandidates[0].id);
    }
    if (personCandidates.length > 1) {
      return open.filter(t => personCandidates.some(c => c.id === t.personId));
    }
  }
  return [];
}

export function countPrayerMatches(
  content: string | undefined,
  personName: string | undefined,
  prayers: PrayerRequest[],
  people: Person[],
): PrayerRequest[] {
  const active = prayers.filter(p => !p.isAnswered);
  if (personName) {
    const personCandidates = countPersonMatches(personName, people);
    if (personCandidates.length === 1) {
      const matches = active.filter(p => p.personId === personCandidates[0].id);
      if (matches.length > 0) return matches;
    } else if (personCandidates.length > 1) {
      const matches = active.filter(p => personCandidates.some(c => c.id === p.personId));
      if (matches.length > 0) return matches;
    }
  }
  if (content) {
    const lower = content.toLowerCase().trim();
    return active.filter(p => p.content.toLowerCase().includes(lower));
  }
  return [];
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
  const personCandidates = action.personName ? countPersonMatches(action.personName, ctx.people) : [];
  const personAmbiguous = personCandidates.length > 1;

  let { taskId, prayerId, prayerContent, taskTitle } = action;
  let taskAmbiguous = false;
  let taskCandidateTitles: string[] = [];
  let prayerAmbiguous = false;

  if ((action.type === 'mark_task_done' || action.type === 'update_task' || action.type === 'delete_task') && !taskId) {
    const taskMatches = countTaskMatches(action.taskTitle, action.personName, ctx.tasks, ctx.people);
    taskAmbiguous = taskMatches.length > 1;
    if (taskAmbiguous) {
      taskCandidateTitles = taskMatches.map(t => t.title);
    } else {
      const t = resolveTask(action.taskTitle, action.personName, ctx.tasks, ctx.people);
      if (t) {
        taskId = t.id;
        taskTitle = t.title;
      }
    }
  }
  if ((action.type === 'mark_prayer_answered' || action.type === 'delete_prayer') && !prayerId) {
    const prayerMatches = countPrayerMatches(action.prayerContent, action.personName, ctx.prayers, ctx.people);
    prayerAmbiguous = prayerMatches.length > 1;
    if (!prayerAmbiguous) {
      const p = resolvePrayer(action.prayerContent, action.personName, ctx.prayers, ctx.people);
      if (p) {
        prayerId = p.id;
        prayerContent = p.content;
      }
    }
  }

  return {
    ...action,
    // Deliberately unset (never the arbitrary first candidate) whenever
    // ambiguous — a handler that skipped the explicit blockOnAmbiguity
    // check still fails closed on the pre-existing "missing id" check.
    personId: personAmbiguous ? undefined : (matched?.id ?? action.personId),
    personName: personAmbiguous ? action.personName : (matched ? `${matched.firstName} ${matched.lastName}` : action.personName),
    personAmbiguous: personAmbiguous || undefined,
    personCandidates: personAmbiguous ? personCandidates.map(p => `${p.firstName} ${p.lastName}`.trim()) : undefined,
    taskId,
    taskTitle,
    taskAmbiguous: taskAmbiguous || undefined,
    taskCandidates: taskAmbiguous ? taskCandidateTitles : undefined,
    prayerId,
    prayerContent,
    prayerAmbiguous: prayerAmbiguous || undefined,
  };
}
