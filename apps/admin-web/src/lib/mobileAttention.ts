/**
 * Pure derivations behind the GRACE Mobile screens. Every number the
 * mobile UI shows comes from one of these functions over real CRM rows —
 * nothing here invents data, and callers must render the qualitative
 * fallbacks rather than substituting a made-up figure (the live-tenant
 * "no fabricated data" rule).
 */
import type { CalendarEvent, Person, PrayerRequest, Task } from '../types';
import { parseDateFlexible } from '../utils/validation';

const DAY_MS = 86_400_000;

function daysAgo(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const date = parseDateFlexible(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export interface FollowUpItem {
  person: Person;
  reason: string;
  kind: 'task' | 'prayer';
  ageDays: number;
}

/**
 * Who needs a follow-up touch: open follow-up tasks joined to their person,
 * plus active non-private prayer requests. One row per person (the task
 * wins over the prayer when both exist).
 */
export function deriveFollowUps(
  people: Person[],
  tasks: Task[],
  prayers: PrayerRequest[],
  now = new Date(),
): FollowUpItem[] {
  const personById = new Map(people.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const items: FollowUpItem[] = [];

  for (const task of tasks) {
    if (task.completed || task.category !== 'follow-up' || !task.personId) continue;
    const person = personById.get(task.personId);
    if (!person || seen.has(person.id)) continue;
    seen.add(person.id);
    items.push({
      person,
      reason: task.title || 'Follow-up task',
      kind: 'task',
      ageDays: daysAgo(task.createdAt, now) ?? 0,
    });
  }

  for (const prayer of prayers) {
    if (prayer.isAnswered || prayer.isPrivate) continue;
    const person = personById.get(prayer.personId);
    if (!person || seen.has(person.id)) continue;
    seen.add(person.id);
    items.push({
      person,
      reason: 'Prayer request',
      kind: 'prayer',
      ageDays: daysAgo(prayer.createdAt, now) ?? 0,
    });
  }

  return items.sort((a, b) => a.ageDays - b.ageDays);
}

export interface NewFamilyGroup {
  familyId: string;
  label: string;
  members: Person[];
  joinedDaysAgo: number;
  hasFollowUp: boolean;
}

export interface NewIndividual {
  person: Person;
  joinedDaysAgo: number;
  hasFollowUp: boolean;
}

export interface NewPeople {
  families: NewFamilyGroup[];
  individuals: NewIndividual[];
  /** Total new people (family members + individuals). */
  count: number;
}

/**
 * Recent first-time visitors (first visit within the last 7 days), grouped
 * into families when two or more share a familyId. "hasFollowUp" means an
 * open follow-up task already references someone in the group.
 */
export function deriveNewPeople(people: Person[], tasks: Task[], now = new Date()): NewPeople {
  const openFollowUpPersonIds = new Set(
    tasks.filter((t) => !t.completed && t.category === 'follow-up' && t.personId).map((t) => t.personId as string),
  );
  const recent = people.filter((p) => {
    if (p.status !== 'visitor') return false;
    const age = daysAgo(p.firstVisit, now);
    return age !== null && age <= 7;
  });

  const byFamily = new Map<string, Person[]>();
  const singles: Person[] = [];
  for (const person of recent) {
    if (person.familyId) {
      const group = byFamily.get(person.familyId) ?? [];
      group.push(person);
      byFamily.set(person.familyId, group);
    } else {
      singles.push(person);
    }
  }

  const families: NewFamilyGroup[] = [];
  for (const [familyId, members] of byFamily) {
    if (members.length < 2) {
      singles.push(...members);
      continue;
    }
    const lastName = members.find((m) => m.lastName)?.lastName || 'New';
    families.push({
      familyId,
      label: `The ${lastName} Family`,
      members,
      joinedDaysAgo: Math.min(...members.map((m) => daysAgo(m.firstVisit, now) ?? 0)),
      hasFollowUp: members.some((m) => openFollowUpPersonIds.has(m.id)),
    });
  }
  families.sort((a, b) => a.joinedDaysAgo - b.joinedDaysAgo);

  const individuals: NewIndividual[] = singles
    .map((person) => ({
      person,
      joinedDaysAgo: daysAgo(person.firstVisit, now) ?? 0,
      hasFollowUp: openFollowUpPersonIds.has(person.id),
    }))
    .sort((a, b) => a.joinedDaysAgo - b.joinedDaysAgo);

  return { families, individuals, count: recent.length };
}

export interface SundayReadiness {
  /** The next Sunday service event (real or calendar-rhythm synthesized). */
  service: CalendarEvent | null;
  /**
   * quantitative — enough tracked prep items exist to state a % honestly;
   * qualitative — too few items to claim a percentage, show counts instead.
   */
  kind: 'quantitative' | 'qualitative';
  /** Only present when kind === 'quantitative'. */
  pct?: number;
  openCount: number;
  doneCount: number;
  totalCount: number;
}

/** Fewer tracked items than this and a percentage would be false precision. */
const MIN_ITEMS_FOR_PERCENT = 3;

/**
 * Sunday prep status derived from tasks due on or before the next Sunday
 * service. A percentage is only reported when at least MIN_ITEMS_FOR_PERCENT
 * items are tracked in that window; otherwise the result is qualitative
 * and the UI must not render a ring or bar.
 */
export function deriveSundayReadiness(
  tasks: Task[],
  events: CalendarEvent[],
  now = new Date(),
): SundayReadiness {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const upcomingServices = events
    .filter((e) => e.category === 'service' && new Date(e.startDate).getTime() >= startOfToday.getTime())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const service =
    upcomingServices.find((e) => new Date(e.startDate).getDay() === 0) ?? upcomingServices[0] ?? null;

  let windowEnd: Date | null = null;
  if (service) {
    windowEnd = new Date(service.startDate);
    windowEnd.setHours(23, 59, 59, 999);
  }

  // Only tasks due between today and the service count as Sunday prep —
  // long-overdue backlog items would drown the signal (and the %).
  const inWindow = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = parseDateFlexible(task.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    if (due.getTime() < startOfToday.getTime()) return false;
    return windowEnd ? due.getTime() <= windowEnd.getTime() : false;
  });

  const totalCount = inWindow.length;
  const doneCount = inWindow.filter((t) => t.completed).length;
  const openCount = totalCount - doneCount;

  if (totalCount >= MIN_ITEMS_FOR_PERCENT) {
    return {
      service,
      kind: 'quantitative',
      pct: Math.round((doneCount / totalCount) * 100),
      openCount,
      doneCount,
      totalCount,
    };
  }
  return { service, kind: 'qualitative', openCount, doneCount, totalCount };
}
