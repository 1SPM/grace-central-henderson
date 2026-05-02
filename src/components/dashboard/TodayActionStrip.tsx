import { AlertTriangle, UserCheck, UserMinus, Cake, CalendarDays, Heart, ArrowRight, Mail } from 'lucide-react';
import type { Person, Task, CalendarEvent, PrayerRequest } from '../../types';

interface TodayActionStripProps {
  people: Person[];
  tasks: Task[];
  events: CalendarEvent[];
  prayers: PrayerRequest[];
  mailNeedsReview?: number;
  mailFlagged?: number;
  onViewTasks: () => void;
  onViewVisitors?: () => void;
  onViewInactive?: () => void;
  onViewCalendar?: () => void;
  onNavigate?: (view: string) => void;
}

interface ActionCard {
  key: string;
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  hint: string;
  tone: 'urgent' | 'warm' | 'cool' | 'neutral';
  onClick?: () => void;
}

const TONE: Record<ActionCard['tone'], { iconBg: string; iconColor: string; ring: string }> = {
  urgent: {
    iconBg: 'bg-rose-50 dark:bg-rose-500/10',
    iconColor: 'text-rose-600 dark:text-rose-400',
    ring: 'hover:border-rose-300 dark:hover:border-rose-500/40',
  },
  warm: {
    iconBg: 'bg-amber-50 dark:bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    ring: 'hover:border-amber-300 dark:hover:border-amber-500/40',
  },
  cool: {
    iconBg: 'bg-sky-50 dark:bg-sky-500/10',
    iconColor: 'text-sky-600 dark:text-sky-400',
    ring: 'hover:border-sky-300 dark:hover:border-sky-500/40',
  },
  neutral: {
    iconBg: 'bg-stone-100 dark:bg-dark-700',
    iconColor: 'text-slate-600 dark:text-dark-300',
    ring: 'hover:border-slate-300 dark:hover:border-dark-500',
  },
};

function isWithinDays(dateStr: string | undefined, days: number, now: Date = new Date()): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
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

export function TodayActionStrip({
  people,
  tasks,
  events,
  prayers,
  mailNeedsReview = 0,
  mailFlagged = 0,
  onViewTasks,
  onViewVisitors,
  onViewInactive,
  onViewCalendar,
  onNavigate,
}: TodayActionStripProps) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;
  const newVisitors = people.filter(
    p => p.status === 'visitor' && p.firstVisit && new Date(p.firstVisit) >= sevenDaysAgo,
  ).length;
  const inactiveCount = people.filter(p => p.status === 'inactive').length;
  const birthdaysSoon = people.filter(p => isBirthdayWithinDays(p.birthDate, 7, now)).length;
  const eventsSoon = events.filter(e => isWithinDays(e.startDate, 7, now)).length;
  const activePrayers = prayers.filter(p => !p.isAnswered).length;

  const cards: ActionCard[] = [
    {
      key: 'mail-flagged',
      icon: AlertTriangle,
      label: 'Flagged email',
      count: mailFlagged,
      hint: mailFlagged === 1 ? 'needs personal reply' : 'need personal reply',
      tone: 'urgent',
      onClick: () => onNavigate?.('mail'),
    },
    {
      key: 'mail-review',
      icon: Mail,
      label: 'Email to review',
      count: mailNeedsReview,
      hint: mailNeedsReview === 1 ? 'awaiting your call' : 'awaiting your call',
      tone: 'warm',
      onClick: () => onNavigate?.('mail'),
    },
    {
      key: 'overdue',
      icon: AlertTriangle,
      label: 'Overdue tasks',
      count: overdueTasks,
      hint: overdueTasks === 1 ? 'task past due' : 'tasks past due',
      tone: 'urgent',
      onClick: onViewTasks,
    },
    {
      key: 'visitors',
      icon: UserCheck,
      label: 'New visitors',
      count: newVisitors,
      hint: 'this week',
      tone: 'warm',
      onClick: onViewVisitors,
    },
    {
      key: 'inactive',
      icon: UserMinus,
      label: 'Drifting',
      count: inactiveCount,
      hint: 'inactive members',
      tone: 'neutral',
      onClick: onViewInactive,
    },
    {
      key: 'birthdays',
      icon: Cake,
      label: 'Birthdays',
      count: birthdaysSoon,
      hint: 'in next 7 days',
      tone: 'warm',
      onClick: () => onNavigate?.('birthdays'),
    },
    {
      key: 'events',
      icon: CalendarDays,
      label: 'Events',
      count: eventsSoon,
      hint: 'this week',
      tone: 'cool',
      onClick: onViewCalendar,
    },
    {
      key: 'prayers',
      icon: Heart,
      label: 'Prayer requests',
      count: activePrayers,
      hint: 'active',
      tone: 'warm',
      onClick: () => onNavigate?.('prayer'),
    },
  ];

  const visible = cards.filter(c => c.count > 0);
  const allClear = visible.length === 0;

  if (allClear) {
    return (
      <div className="mb-6 px-5 py-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200/60 dark:border-emerald-500/20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
          <Heart size={16} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">All clear today.</p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70">No overdue tasks, drifting members, or upcoming events. Good day to call someone.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-dark-400">Today</h2>
        <span className="text-xs text-gray-500 dark:text-dark-500">{visible.length} need attention</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {visible.map(card => {
          const tone = TONE[card.tone];
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              onClick={card.onClick}
              disabled={!card.onClick}
              className={`group relative flex flex-col items-start gap-2 p-3 rounded-xl bg-white dark:bg-dark-800 border border-stone-200 dark:border-dark-700 transition-all text-left ${tone.ring} ${card.onClick ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone.iconBg}`}>
                <Icon size={15} className={tone.iconColor} />
              </div>
              <div className="min-w-0 w-full">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold text-slate-900 dark:text-dark-100 leading-none">{card.count}</span>
                  {card.onClick && (
                    <ArrowRight size={12} className="ml-auto text-gray-400 group-hover:text-gray-600 dark:group-hover:text-dark-300 transition-colors" />
                  )}
                </div>
                <p className="text-xs font-medium text-slate-700 dark:text-dark-200 mt-1 truncate">{card.label}</p>
                <p className="text-[11px] text-gray-500 dark:text-dark-400 truncate">{card.hint}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
