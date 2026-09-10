import { useMemo } from 'react';
import { ListTodo, Mic, Sparkles, UserPlus } from 'lucide-react';
import type { CalendarEvent, Person, PrayerRequest, Task, View } from '../../../types';
import { GraceOrb } from '../../grace/GraceOrb';
import { greetingWord, getChurchHour } from '../../../lib/greeting';
import { parseDateFlexible } from '../../../utils/validation';
import {
  deriveFollowUps,
  deriveNewPeople,
  type SundayReadiness,
} from '../../../lib/mobileAttention';
import { muted } from '../ui/mobileTheme';
import { MobileCard, MobileCardRow, EmptyCard } from '../ui/MobileCard';
import { SectionLabel } from '../ui/SectionLabel';
import { IconChip } from '../ui/IconChip';
import { ProgressRing } from '../ui/ProgressRing';
import { EventRow } from '../ui/EventRow';
import { agoLabel, eventDateLabel } from '../ui/mobileFormat';

interface HomeScreenProps {
  userName?: string;
  churchTimezone?: string;
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  /** CRM events merged with the church calendar rhythm (includes Sunday services). */
  mergedEvents: CalendarEvent[];
  readiness: SundayReadiness;
  onNavigate: (view: View) => void;
  onOpenGrace: (seed?: string, opts?: { listen?: boolean }) => void;
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function HomeScreen({
  userName,
  churchTimezone,
  people,
  tasks,
  prayers,
  mergedEvents,
  readiness,
  onNavigate,
  onOpenGrace,
}: HomeScreenProps) {
  const now = useMemo(() => new Date(), []);
  const firstName = userName?.split(' ')[0];
  const hour = churchTimezone ? getChurchHour(churchTimezone, now) : now.getHours();
  const greeting = firstName ? `${greetingWord(hour)}, ${firstName}.` : `${greetingWord(hour)}.`;
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const followUps = useMemo(() => deriveFollowUps(people, tasks, prayers, now), [people, tasks, prayers, now]);
  const newPeople = useMemo(() => deriveNewPeople(people, tasks, now), [people, tasks, now]);
  const overdueCount = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.completed || !t.dueDate) return false;
        const due = parseDateFlexible(t.dueDate);
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        return !Number.isNaN(due.getTime()) && due.getTime() < startOfToday.getTime();
      }).length,
    [tasks, now],
  );

  const { todayEvents, weekEvents } = useMemo(() => {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
    const weekEnd = new Date(startOfToday.getTime() + 7 * 86_400_000);
    const upcoming = mergedEvents
      .filter((e) => {
        const start = new Date(e.startDate);
        return !Number.isNaN(start.getTime()) && start.getTime() >= startOfToday.getTime();
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return {
      todayEvents: upcoming
        .filter((e) => new Date(e.startDate).getTime() < endOfToday.getTime() && e.id !== readiness.service?.id)
        .slice(0, 2),
      weekEvents: upcoming
        .filter((e) => {
          const start = new Date(e.startDate).getTime();
          return start >= endOfToday.getTime() && start < weekEnd.getTime() && e.id !== readiness.service?.id;
        })
        .slice(0, 3),
    };
  }, [mergedEvents, now, readiness.service?.id]);

  const attentionCount =
    (followUps.length > 0 ? 1 : 0) + (newPeople.count > 0 ? 1 : 0) + (overdueCount > 0 ? 1 : 0);
  const attentionLine =
    attentionCount > 0
      ? `${countWord(attentionCount)} thing${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} your attention${readiness.service ? ' before Sunday' : ''}.`
      : 'Nothing needs your attention right now.';

  const quickActions: { label: string; icon: React.ReactNode; tone: string; onClick: () => void }[] = [
    { label: 'Talk to Grace', icon: <Mic size={18} />, tone: 'bg-sky-500/15 text-sky-300', onClick: () => onOpenGrace(undefined, { listen: true }) },
    { label: 'Brief', icon: <Sparkles size={18} />, tone: 'bg-amber-500/15 text-amber-300', onClick: () => onNavigate('feed') },
    { label: 'Add Person', icon: <UserPlus size={18} />, tone: 'bg-emerald-500/15 text-emerald-300', onClick: () => onNavigate('people') },
    { label: 'Work Queue', icon: <ListTodo size={18} />, tone: 'bg-violet-500/15 text-violet-300', onClick: () => onNavigate('tasks') },
  ];

  const firstFollowUp = followUps[0];

  return (
    <div className="px-4 pt-4 pb-6 space-y-5 min-h-full bg-[radial-gradient(circle_at_78%_0%,rgba(73,92,230,.18),transparent_28%),#070b14]">
      <p className={`text-xs ${muted}`}>{dateLabel}</p>

      {/* Orb + greeting */}
      <div className="flex items-center gap-4">
        <GraceOrb size="sb" rings />
        <div className="min-w-0">
          <h1 className="text-[23px] font-semibold tracking-tight leading-tight">{greeting}</h1>
          <p className={`text-sm mt-1 ${muted}`}>{attentionLine}</p>
          <p className="text-xs mt-1.5 flex items-center gap-1.5 text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Ready to help
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-2.5 flex flex-col items-center gap-2 text-center"
          >
            <span className={`w-9 h-9 grid place-items-center rounded-xl ${action.tone}`}>{action.icon}</span>
            <span className="text-[10px] font-medium text-slate-300 leading-tight">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Today */}
      <div className="space-y-2">
        <SectionLabel>Today</SectionLabel>
        {todayEvents.map((event) => (
          <EventRow key={event.id} event={event} onClick={() => onNavigate('sunday-prep')} />
        ))}
        {firstFollowUp && (
          <MobileCardRow
            icon={
              <IconChip tone="orange">
                <UserPlus size={17} />
              </IconChip>
            }
            title={`${firstFollowUp.person.firstName} ${firstFollowUp.person.lastName} needs follow-up`}
            detail={`${firstFollowUp.reason} · ${agoLabel(firstFollowUp.ageDays)}`}
            chevron
            onClick={() => onNavigate('people')}
          />
        )}
        {newPeople.count > 0 && (
          <MobileCardRow
            icon={
              <IconChip tone="emerald">
                <UserPlus size={17} />
              </IconChip>
            }
            title={
              newPeople.families.length > 0
                ? `${newPeople.families.length} new ${newPeople.families.length === 1 ? 'family' : 'families'}`
                : `${newPeople.count} new ${newPeople.count === 1 ? 'person' : 'people'}`
            }
            detail={
              newPeople.families.some((f) => !f.hasFollowUp) || newPeople.individuals.some((i) => !i.hasFollowUp)
                ? 'No follow-up assigned'
                : 'Follow-up underway'
            }
            chevron
            onClick={() => onNavigate('people')}
          />
        )}
        {overdueCount > 0 && (
          <MobileCardRow
            icon={
              <IconChip tone="rose">
                <ListTodo size={17} />
              </IconChip>
            }
            title={`${overdueCount} overdue ${overdueCount === 1 ? 'task' : 'tasks'}`}
            detail="Past their due date"
            chevron
            onClick={() => onNavigate('tasks')}
          />
        )}
        {readiness.service && (
          <MobileCard onClick={() => onNavigate('sunday-prep')} className="p-3.5 flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-100 truncate">{readiness.service.title}</span>
              <span className={`block text-xs mt-0.5 ${muted}`}>
                {readiness.kind === 'quantitative'
                  ? `Preparation ${readiness.pct}% · ${eventDateLabel(readiness.service.startDate, readiness.service.allDay)}`
                  : readiness.totalCount > 0
                    ? `${readiness.openCount} prep ${readiness.openCount === 1 ? 'item' : 'items'} open · ${eventDateLabel(readiness.service.startDate, readiness.service.allDay)}`
                    : eventDateLabel(readiness.service.startDate, readiness.service.allDay)}
              </span>
            </span>
            {readiness.kind === 'quantitative' && readiness.pct != null && (
              <ProgressRing value={readiness.pct} size={46} />
            )}
          </MobileCard>
        )}
        {todayEvents.length === 0 && !firstFollowUp && newPeople.count === 0 && overdueCount === 0 && !readiness.service && (
          <EmptyCard>Nothing needs attention right now.</EmptyCard>
        )}
      </div>

      {/* This week */}
      <div className="space-y-2">
        <SectionLabel>This week</SectionLabel>
        {weekEvents.length > 0 ? (
          weekEvents.map((event) => <EventRow key={event.id} event={event} />)
        ) : (
          <EmptyCard>No other events this week.</EmptyCard>
        )}
      </div>
    </div>
  );
}
