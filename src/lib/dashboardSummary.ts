import type { Giving, PastoralConversation, Person, PrayerRequest, Task } from '../types';
import type { DayAgendaEvent } from './calendarEvents';

export const DEMO_MONTHLY_GOAL = 100_000;

export interface DashboardMetrics {
  givingMtd: number;
  goalPct: number;
  fundTotalsMtd: { fund: string; amount: number }[];
  openCare: PastoralConversation[];
  crisisCount: number;
  newMembersThisWeek: Person[];
  inactiveCount: number;
  overdueTasks: number;
  mailBacklog: number;
  attentionCount: number;
}

export interface TodayAttentionInput {
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  mailNeedsReview?: number;
  mailFlagged?: number;
  hideMail?: boolean;
}

function isBirthdayWithinDays(birthDate: string | undefined, days: number, now: Date = new Date()): boolean {
  if (!birthDate) return false;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return false;
  const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (thisYear < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    thisYear.setFullYear(now.getFullYear() + 1);
  }
  const diff = (thisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

/** Counts non-zero Today-rail attention items (matches embedded TodayActionStrip rules). */
export function countTodayAttention({
  people,
  tasks,
  prayers,
  mailNeedsReview = 0,
  mailFlagged = 0,
  hideMail = false,
}: TodayAttentionInput): number {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  let count = 0;
  if (!hideMail && mailFlagged > 0) count += 1;
  if (!hideMail && mailNeedsReview > 0) count += 1;

  if (tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length > 0) count += 1;

  if (people.filter(p => p.status === 'visitor' && p.firstVisit && new Date(p.firstVisit) >= sevenDaysAgo).length > 0) {
    count += 1;
  }
  if (people.filter(p => p.status === 'inactive').length > 0) count += 1;
  if (people.filter(p => isBirthdayWithinDays(p.birthDate, 7, now)).length > 0) count += 1;
  if (prayers.filter(p => !p.isAnswered).length > 0) count += 1;

  return count;
}

export function buildDashboardMetrics(
  people: Person[],
  tasks: Task[],
  giving: Giving[],
  careConversations: PastoralConversation[],
  attentionCount: number,
): DashboardMetrics {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mtdGifts = giving.filter(g => new Date(g.date) >= monthStart);
  const source = mtdGifts.length > 0 ? mtdGifts : giving;
  const mtd = source.reduce((sum, g) => sum + g.amount, 0);

  const fundTotals: Record<string, number> = {};
  source.forEach(g => {
    fundTotals[g.fund] = (fundTotals[g.fund] || 0) + g.amount;
  });
  const funds = Object.entries(fundTotals)
    .map(([fund, amount]) => ({ fund, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const care = careConversations
    .filter(c => c.status === 'active' || c.status === 'waiting' || c.status === 'escalated')
    .sort((a, b) => {
      if (a.priority === 'crisis' && b.priority !== 'crisis') return -1;
      if (b.priority === 'crisis' && a.priority !== 'crisis') return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  let newThisWeek = people.filter(
    p => p.status === 'member' && p.joinDate && new Date(p.joinDate) >= weekAgo,
  );
  if (newThisWeek.length === 0) {
    newThisWeek = people
      .filter(p => p.status === 'member' && p.joinDate)
      .sort((a, b) => (b.joinDate || '').localeCompare(a.joinDate || ''))
      .slice(0, 4);
  }

  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;

  return {
    givingMtd: mtd,
    goalPct: Math.min(Math.round((mtd / DEMO_MONTHLY_GOAL) * 100), 100),
    fundTotalsMtd: funds,
    openCare: care,
    crisisCount: care.filter(c => c.priority === 'crisis').length,
    newMembersThisWeek: newThisWeek.slice(0, 4),
    inactiveCount: people.filter(p => p.status === 'inactive').length,
    overdueTasks,
    mailBacklog: 0,
    attentionCount,
  };
}

export function buildDashboardMetricsFromInputs(
  people: Person[],
  tasks: Task[],
  giving: Giving[],
  careConversations: PastoralConversation[],
  attentionInput: TodayAttentionInput,
): DashboardMetrics {
  const attentionCount = countTodayAttention(attentionInput);
  const metrics = buildDashboardMetrics(people, tasks, giving, careConversations, attentionCount);
  metrics.mailBacklog = (attentionInput.mailNeedsReview ?? 0) + (attentionInput.mailFlagged ?? 0);
  return metrics;
}

export function findNextEventLabel(
  eventsByDay: Record<string, DayAgendaEvent[]>,
  todayKey: string,
): string | null {
  const todayStart = parseDayKey(todayKey).getTime();
  const upcoming = Object.entries(eventsByDay)
    .flatMap(([key, items]) =>
      items.map(event => ({ key, event, day: parseDayKey(key) })),
    )
    .filter(({ day }) => day.getTime() >= todayStart)
    .sort((a, b) => new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime());

  const next = upcoming[0];
  if (!next) return null;

  const dayLabel = next.day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = next.event.time ? ` · ${next.event.time}` : '';
  return `${next.event.title} — ${dayLabel}${timePart}`;
}

function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month, day);
}

export function buildHeroSubline(attentionCount: number, nextEventLabel: string | null): string {
  const parts: string[] = [];
  if (attentionCount > 0) {
    // attentionCount is a count of non-empty attention CATEGORIES (mail,
    // overdue tasks, new visitors, inactive members, birthdays, prayers —
    // see countTodayAttention above), not individual items. "N items need
    // attention" read as a literal item count and directly contradicted
    // Action Center's "N items need attention" (a true item count) showing
    // a much larger number for the same day — same phrase, different unit.
    parts.push(`${attentionCount} area${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention`);
  } else {
    parts.push('All clear for today');
  }
  if (nextEventLabel) {
    parts.push(`Next: ${nextEventLabel}`);
  }
  return parts.join(' · ');
}

export function countDetailSections(
  fundTotalsMtd: { fund: string; amount: number }[],
  openCare: PastoralConversation[],
  newMembersThisWeek: Person[],
): number {
  let n = 0;
  if (fundTotalsMtd.length > 0) n += 1;
  if (openCare.length > 0) n += 1;
  if (newMembersThisWeek.length > 0) n += 1;
  return n;
}
