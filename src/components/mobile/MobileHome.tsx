import { useMemo } from 'react';
import {
  Users,
  CheckSquare,
  Cake,
  DollarSign,
  Calendar,
  Hand,
  UserPlus,
  ListTodo,
  Church,
  ChevronRight,
} from 'lucide-react';
import type { View, Person, Task, Giving, CalendarEvent, PrayerRequest } from '../../types';

interface MobileHomeProps {
  churchName?: string;
  userName?: string;
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  prayers: PrayerRequest[];
  onNavigate: (view: View) => void;
}

function birthdayWithinDays(birthDate: string | undefined, days: number, now: Date): boolean {
  if (!birthDate) return false;
  const bd = new Date(birthDate);
  if (Number.isNaN(bd.getTime())) return false;
  const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next.setFullYear(now.getFullYear() + 1);
  }
  const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= days;
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function MobileHome({
  churchName,
  userName,
  people,
  tasks,
  giving,
  events,
  prayers,
  onNavigate,
}: MobileHomeProps) {
  const now = useMemo(() => new Date(), []);

  const memberCount = useMemo(
    () => people.filter((p) => p.status === 'member').length,
    [people],
  );

  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const tasksDueToday = useMemo(() => {
    const today = now.toISOString().slice(0, 10);
    return openTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) <= today).length;
  }, [openTasks, now]);

  const birthdaysSoon = useMemo(
    () => people.filter((p) => birthdayWithinDays(p.birthDate, 7, now)).length,
    [people, now],
  );

  const givingThisMonth = useMemo(() => {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return giving
      .filter((g) => g.date?.startsWith(ym))
      .reduce((sum, g) => sum + (g.amount || 0), 0);
  }, [giving, now]);

  const upcomingEvents = useMemo(() => {
    const weekOut = new Date(now);
    weekOut.setDate(weekOut.getDate() + 7);
    return events
      .filter((e) => {
        const start = new Date(e.startDate);
        return !Number.isNaN(start.getTime()) && start >= now && start <= weekOut;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);
  }, [events, now]);

  const activePrayers = useMemo(
    () => prayers.filter((p) => !p.isAnswered).length,
    [prayers],
  );

  const kpis = [
    {
      label: 'Members',
      value: memberCount.toLocaleString(),
      icon: <Users size={18} />,
      view: 'people' as View,
      tone: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10',
    },
    {
      label: 'Open tasks',
      value: openTasks.length.toLocaleString(),
      sub: tasksDueToday > 0 ? `${tasksDueToday} due` : undefined,
      icon: <CheckSquare size={18} />,
      view: 'feed' as View,
      tone: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10',
    },
    {
      label: 'Birthdays',
      value: birthdaysSoon.toLocaleString(),
      sub: 'next 7 days',
      icon: <Cake size={18} />,
      view: 'feed' as View,
      tone: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    },
    {
      label: 'Giving (mo.)',
      value: `$${givingThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: <DollarSign size={18} />,
      view: 'giving' as View,
      tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
    },
  ];

  const quickActions = [
    { label: 'Add person', icon: <UserPlus size={18} />, view: 'people' as View },
    { label: 'Tasks', icon: <ListTodo size={18} />, view: 'tasks' as View },
    { label: 'Record gift', icon: <DollarSign size={18} />, view: 'giving' as View },
    { label: 'Sunday', icon: <Church size={18} />, view: 'sunday-prep' as View },
  ];

  return (
    <div className="px-4 py-4 space-y-5 pb-8">
      {/* Greeting */}
      <div>
        <p className="text-sm text-gray-500 dark:text-dark-400">
          {greeting(now)}
          {userName ? `, ${userName.split(' ')[0]}` : ''}
        </p>
        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100 leading-tight">
          {churchName || 'GRACE'}
        </h2>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={() => onNavigate(k.view)}
            className="text-left p-3.5 rounded-2xl bg-white dark:bg-dark-850 border border-gray-100 dark:border-dark-700 hover:border-gray-200 dark:hover:border-dark-600 transition-colors"
          >
            <span
              className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2 ${k.tone}`}
            >
              {k.icon}
            </span>
            <p className="text-2xl font-bold text-gray-900 dark:text-dark-100 leading-none">
              {k.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              {k.label}
              {k.sub ? <span className="text-gray-400 dark:text-dark-500"> · {k.sub}</span> : null}
            </p>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-dark-500 mb-2">
          Quick actions
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => onNavigate(a.view)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-dark-850 border border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
            >
              <span className="text-rose-600 dark:text-rose-400">{a.icon}</span>
              <span className="text-[10px] font-medium text-gray-600 dark:text-dark-300 text-center leading-tight">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* This week */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-dark-500">
            This week
          </h3>
          <button
            onClick={() => onNavigate('sunday-prep')}
            className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-0.5"
          >
            Calendar <ChevronRight size={13} />
          </button>
        </div>
        <div className="rounded-2xl bg-white dark:bg-dark-850 border border-gray-100 dark:border-dark-700 divide-y divide-gray-100 dark:divide-dark-700 overflow-hidden">
          {upcomingEvents.length === 0 ? (
            <div className="flex items-center gap-3 p-4 text-sm text-gray-400 dark:text-dark-500">
              <Calendar size={18} />
              No events in the next 7 days
            </div>
          ) : (
            upcomingEvents.map((e) => (
              <button
                key={e.id}
                onClick={() => onNavigate('sunday-prep')}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  <Calendar size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                    {e.title}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-dark-400">
                    {new Date(e.startDate).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Prayer shortcut */}
      <button
        onClick={() => onNavigate('prayer')}
        className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-dark-850 border border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors text-left"
      >
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex-shrink-0">
          <Hand size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900 dark:text-dark-100">
            Prayer requests
          </span>
          <span className="block text-xs text-gray-500 dark:text-dark-400">
            {activePrayers} active
          </span>
        </span>
        <ChevronRight size={18} className="text-gray-300 dark:text-dark-500" />
      </button>
    </div>
  );
}
