import { useMemo } from 'react';
import { formatLocalDate } from '../utils/validation';
import {
  Users,
  UserPlus,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Heart,
  LayoutDashboard,
  Church,
  ListTodo,
  Zap,
  BookOpen,
  BarChart3,
  DollarSign,
  Mail,
  Smartphone,
  LogIn,
  CalendarCheck,
  HeartHandshake,
  CalendarDays,
  Bot,
} from 'lucide-react';
import { Person, Task, Giving, Interaction, PrayerRequest, CalendarEvent, LeaderProfile, PastoralConversation, HelpCategory } from '../types';
import type { ChurchSettings } from '../hooks/useChurchSettings';
import { StatCard } from './ui/StatCard';
import { TodayActionStrip } from './dashboard/TodayActionStrip';
import { ClockCalendarBanner } from './dashboard/ClockCalendarBanner';
import { GraceGettingStartedPanel } from './grace/GraceGettingStartedPanel';
import { useGraceChat } from '../contexts/GraceChatContext';
import { useMailInboxStats } from '../hooks/useMailInboxStats';
import { usePortalActivity } from '../hooks/usePortalActivity';
import { useAuthContext } from '../contexts/AuthContext';
import { useChurchClock } from '../hooks/useChurchClock';
import { buildDashboardCalendarIndex } from '../lib/calendarEvents';
import { greetingWord, resolveAddressee } from '../lib/greeting';
import { CENTRAL_HENDERSON_TIMEZONE } from '../config/centralHenderson';

interface DashboardProps {
  churchId?: string;
  people: Person[];
  tasks: Task[];
  events?: CalendarEvent[];
  giving?: Giving[];
  interactions?: Interaction[];
  prayers?: PrayerRequest[];
  onViewPerson: (id: string) => void;
  onViewTasks: () => void;
  onViewGiving?: () => void;
  onViewPeople?: () => void;
  onViewVisitors?: () => void;
  onViewInactive?: () => void;
  onViewActions?: () => void;
  onViewCalendar?: () => void;
  onViewAnalytics?: () => void;
  churchSettings?: ChurchSettings;
  onNavigate?: (view: string) => void;
  onDismissGraceIntro?: () => void;
  onOpenTutorials?: () => void;
  leaders?: LeaderProfile[];
  onViewLeaders?: () => void;
  careConversations?: PastoralConversation[];
}

const CARE_CATEGORY_LABELS: Record<HelpCategory, string> = {
  marriage: 'Marriage',
  addiction: 'Recovery',
  grief: 'Grief',
  'faith-questions': 'Faith',
  crisis: 'Crisis',
  financial: 'Financial',
  'anxiety-depression': 'Mental Health',
  parenting: 'Parenting',
  general: 'General',
};

export function Dashboard({ churchId, people, tasks, events = [], giving = [], prayers = [], onViewPerson, onViewTasks, onViewGiving, onViewPeople, onViewVisitors, onViewInactive, onViewActions, onViewCalendar, onViewAnalytics, churchSettings, onNavigate, onDismissGraceIntro, onOpenTutorials, leaders = [], onViewLeaders, careConversations = [], }: DashboardProps) {
  const grace = useGraceChat();
  const mailStats = useMailInboxStats();
  const portalActivity = usePortalActivity(churchId ?? '');
  const { user } = useAuthContext();
  const churchName = churchSettings?.profile?.name || 'Central Henderson Church';
  const timezone = churchSettings?.timezone || CENTRAL_HENDERSON_TIMEZONE;
  const { zoned } = useChurchClock(timezone);
  const greeting = greetingWord(zoned.hour24);
  const addressee = resolveAddressee(user?.firstName, user?.role);
  const calendarIndex = useMemo(
    () => buildDashboardCalendarIndex(events, zoned.year),
    [events, zoned.year],
  );

  // Memoize filtered arrays to prevent recalculation on every render
  const { visitors, inactive, pendingTasks } = useMemo(() => ({
    visitors: people.filter(p => p.status === 'visitor'),
    inactive: people.filter(p => p.status === 'inactive'),
    pendingTasks: tasks.filter(t => !t.completed),
  }), [people, tasks]);

  // Memoize person lookup map for O(1) access
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  // Compute weekly sparkline data from created_at dates (last 7 weeks)
  const { peopleSparkline, tasksSparkline } = useMemo(() => {
    const now = new Date();
    const weeks = 7;
    const peopleCounts: number[] = [];
    const visitorCounts: number[] = [];
    const taskCounts: number[] = [];

    for (let w = weeks - 1; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - w * 7);
      const weekEndStr = weekEnd.toISOString();

      peopleCounts.push(people.filter(p => (p.joinDate || p.firstVisit || '') <= weekEndStr).length || people.length);
      visitorCounts.push(people.filter(p => p.status === 'visitor' && (p.firstVisit || '') <= weekEndStr).length || visitors.length);
      taskCounts.push(tasks.filter(t => !t.completed && (t.createdAt || '') <= weekEndStr).length || pendingTasks.length);
    }

    // Ensure the last point matches the current live count
    peopleCounts[weeks - 1] = people.length;
    visitorCounts[weeks - 1] = visitors.length;
    taskCounts[weeks - 1] = pendingTasks.length;

    return { peopleSparkline: peopleCounts, visitorsSparkline: visitorCounts, tasksSparkline: taskCounts };
  }, [people, visitors, tasks, pendingTasks]);

  // KPI row + card grid data (mockup dashboard restructure)
  const DEMO_MONTHLY_GOAL = 100000;
  const { givingMtd, goalPct, fundTotalsMtd, openCare, newMembersThisWeek, upcomingEvents } = useMemo(() => {
    const now = new Date();
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

    const upcoming = [...events]
      .filter(e => new Date(e.startDate) >= new Date(now.toDateString()))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 4);

    return {
      givingMtd: mtd,
      goalPct: Math.min(Math.round((mtd / DEMO_MONTHLY_GOAL) * 100), 100),
      fundTotalsMtd: funds,
      openCare: care,
      newMembersThisWeek: newThisWeek.slice(0, 4),
      upcomingEvents: upcoming,
    };
  }, [giving, careConversations, people, events]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Compact Command Header */}
      <div className="mb-6 px-5 sm:px-6 py-5 rounded-2xl bg-gradient-to-br from-white via-stone-50 to-amber-50/50 dark:from-dark-800 dark:via-dark-800 dark:to-amber-950/20 border border-stone-200 dark:border-dark-700">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={13} className="text-amber-500" />
              <span className="text-[11px] uppercase tracking-[0.15em] text-gray-500 dark:text-dark-400 font-medium">
                {greeting}
              </span>
            </div>
            <h1 className="serif text-2xl text-slate-900 dark:text-dark-100 leading-tight truncate">
              {addressee}
            </h1>
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
              {churchName}
            </p>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
              Here's what needs your attention today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => grace.openPanel()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-950 text-white rounded-lg transition-colors"
            >
              <Sparkles size={14} className="text-amber-300" />
              Ask Grace
            </button>
            <button
              onClick={() => onViewPeople?.()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white dark:bg-dark-700 hover:bg-stone-100 dark:hover:bg-dark-600 text-slate-800 dark:text-dark-100 border border-stone-300 dark:border-dark-600 rounded-lg transition-colors"
            >
              <UserPlus size={14} />
              Add person
            </button>
            <button
              onClick={onViewActions ?? onViewTasks}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white dark:bg-dark-700 hover:bg-stone-100 dark:hover:bg-dark-600 text-slate-800 dark:text-dark-100 border border-stone-300 dark:border-dark-600 rounded-lg transition-colors"
            >
              <ListTodo size={14} />
              Work Queue
            </button>
            <button
              onClick={() => onNavigate?.('mail')}
              className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white dark:bg-dark-700 hover:bg-stone-100 dark:hover:bg-dark-600 text-slate-800 dark:text-dark-100 border border-stone-300 dark:border-dark-600 rounded-lg transition-colors"
            >
              <Mail size={14} />
              Mail
              {(mailStats.needsReview + mailStats.flagged) > 0 && (
                <span className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full ${mailStats.flagged > 0
                  ? 'bg-rose-500 text-white'
                  : 'bg-amber-500 text-white'}`}>
                  {mailStats.needsReview + mailStats.flagged}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab row */}
        <div className="flex items-center gap-1 -mb-1 border-t border-stone-200 dark:border-dark-700 pt-3">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-slate-900 text-white">
            <LayoutDashboard size={14} />
            Overview
          </span>
          <button
            data-tutorial="dashboard-sunday-prep"
            onClick={() => onNavigate?.('sunday-prep')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-dark-300 hover:bg-stone-200/60 dark:hover:bg-dark-700 transition-all"
          >
            <Church size={14} />
            Sunday Service Tools
          </button>
          {onOpenTutorials && (
            <button
              onClick={onOpenTutorials}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-dark-300 hover:bg-stone-200/60 dark:hover:bg-dark-700 ml-auto"
            >
              <BookOpen size={14} />
              Take a Tour
            </button>
          )}
        </div>
      </div>

      <ClockCalendarBanner
        className="mb-6"
        eventDays={calendarIndex.eventDays}
        eventsByDay={calendarIndex.eventsByDay}
        onOpenCalendar={onViewCalendar}
        timezone={timezone}
      />

      {!churchSettings?.onboarding?.graceIntroDismissed && onDismissGraceIntro && (
        <GraceGettingStartedPanel
          churchName={churchName}
          onDismiss={onDismissGraceIntro}
        />
      )}

      <TodayActionStrip
        people={people}
        tasks={tasks}
        events={events}
        prayers={prayers}
        mailNeedsReview={mailStats.needsReview}
        mailFlagged={mailStats.flagged}
        onViewTasks={onViewActions ?? onViewTasks}
        onViewVisitors={onViewVisitors}
        onViewInactive={onViewInactive}
        onViewCalendar={onViewCalendar}
        onNavigate={onNavigate}
      />


      {/* KPI row — pinned at top of overview */}
      <div data-tutorial="dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Members"
          value={people.length}
          icon={<Users size={20} />}
          change={visitors.length > 0 ? Math.min(visitors.length * 5, 20) : 0}
          changeLabel={`${visitors.length} visitors in pipeline`}
          sparklineData={peopleSparkline}
          accentColor="blue"
          onClick={onViewPeople}
        />
        <StatCard
          label="Impact MTD"
          value={`$${Math.round(givingMtd).toLocaleString()}`}
          icon={<DollarSign size={20} />}
          change={goalPct}
          changeLabel="of monthly goal"
          accentColor="emerald"
          onClick={onViewGiving}
        />
        <StatCard
          label="Open dispatch"
          value={openCare.length}
          icon={<Heart size={20} />}
          change={openCare.filter(c => c.priority === 'crisis').length}
          changeLabel={openCare.length > 0 ? `${openCare.filter(c => c.priority === 'crisis').length} crisis` : 'all clear'}
          invertTrend
          accentColor="rose"
          onClick={() => onNavigate?.('pastoral-care')}
        />
        <StatCard
          label="Leader Sessions"
          value={leaders.length}
          icon={<Bot size={20} />}
          change={leaders.filter(l => l.isAvailable).length}
          changeLabel="available leaders"
          sparklineData={tasksSparkline}
          accentColor="amber"
          onClick={onViewLeaders}
        />
      </div>

      {/* Member Portal engagement (last 7 days) */}
      {churchId && !portalActivity.isDemo && (
        <button
          onClick={() => onNavigate?.('portal-activity')}
          className="w-full mb-6 bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-left"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg flex items-center justify-center">
                <Smartphone size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Member Portal — last 7 days</h3>
            </div>
            <ChevronRight size={16} className="text-gray-400 dark:text-dark-500" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Active members', value: portalActivity.summary.activeMembers7d, icon: Users },
              { label: 'Logins', value: portalActivity.summary.logins7d, icon: LogIn },
              { label: 'RSVPs', value: portalActivity.summary.rsvps7d, icon: CalendarCheck },
              { label: 'Gifts', value: portalActivity.summary.gifts7d, icon: DollarSign },
              { label: 'Care messages', value: portalActivity.summary.careMessages7d, icon: HeartHandshake },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={14} className="text-gray-400 dark:text-dark-500 flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-dark-100 leading-none">{value}</p>
                  <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </button>
      )}

      {/* Members Need Care Alert — positioned high for pastoral priority */}
      {inactive.length > 0 && (
        <div data-tutorial="dashboard-care-alert" className="mb-6 bg-rose-50 dark:bg-rose-900/10 rounded-xl p-4 border border-rose-200 dark:border-rose-800/30 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-stone-100 dark:bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <Heart className="text-rose-500" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Members Need Care</h3>
              <p className="text-sm text-gray-600 dark:text-dark-400 mt-0.5">
                {inactive.length} {inactive.length === 1 ? 'person hasn\'t' : 'people haven\'t'} been active recently. Reach out today.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {inactive.slice(0, 3).map((person) => (
                  <button
                    key={person.id}
                    onClick={() => onViewPerson(person.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 dark:bg-dark-800 rounded-lg text-xs font-medium text-gray-700 dark:text-dark-300 hover:bg-rose-100 dark:hover:bg-dark-750 border border-gray-200 dark:border-dark-600 transition-colors shadow-sm"
                  >
                    {person.firstName} {person.lastName}
                    <ChevronRight size={12} />
                  </button>
                ))}
                {inactive.length > 3 && (
                  <button
                    onClick={onViewInactive}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-100 dark:bg-rose-500/10 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20 transition-colors"
                  >
                    +{inactive.length - 3} more
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action CTAs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Actions CTA */}
        <button
          onClick={onViewActions}
          className="group relative overflow-hidden bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-5 text-left transition-all hover:shadow-lg hover:scale-[1.01] shadow-sm"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={20} />
              </div>
              <ArrowRight className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" size={18} />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Action Center</h3>
            <p className="text-white/80 text-sm">
              {(() => {
                const urgentCount = pendingTasks.filter(t => t.priority === 'high').length;
                const otherTaskCount = pendingTasks.length - urgentCount;
                const parts: string[] = [];
                if (urgentCount > 0) parts.push(`${urgentCount} urgent`);
                parts.push(`${visitors.length} ${visitors.length === 1 ? 'visitor' : 'visitors'}`);
                if (otherTaskCount > 0) parts.push(`${otherTaskCount} ${otherTaskCount === 1 ? 'task' : 'tasks'}`);
                return parts.join(', ');
              })()}
            </p>
          </div>
        </button>

        {/* Sunday tools CTA */}
        <button
          onClick={() => onNavigate?.('sunday-prep')}
          className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-left transition-all hover:shadow-lg hover:scale-[1.01] shadow-sm"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <BookOpen className="text-white" size={20} />
              </div>
              <ArrowRight className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" size={18} />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Sunday Service Tools</h3>
            <p className="text-white/80 text-sm">
              Plan, schedule, and run this week’s service
            </p>
          </div>
        </button>
      </div>

      <div className="space-y-4 min-w-0 mb-6">
          {/* Card grid: giving / events / care / new members */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Giving by fund */}
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                    <DollarSign size={15} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Giving by fund</h2>
                </div>
                <button
                  onClick={onViewGiving}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  Impact Campaigns <ArrowRight size={12} />
                </button>
              </div>
              {fundTotalsMtd.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-dark-500 py-4 text-center">No giving recorded yet</p>
              ) : (
                <div className="space-y-2.5">
                  {fundTotalsMtd.map(({ fund, amount }) => {
                    const max = fundTotalsMtd[0].amount || 1;
                    return (
                      <div key={fund}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600 dark:text-dark-300 capitalize">{fund}</span>
                          <span className="font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                            ${amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(amount / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming events */}
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <CalendarDays size={15} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Upcoming events</h2>
                </div>
                <button
                  onClick={onViewCalendar}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  Calendar <ArrowRight size={12} />
                </button>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-dark-500 py-4 text-center">Nothing scheduled</p>
              ) : (
                <div className="space-y-1">
                  {upcomingEvents.map(event => (
                    <button
                      key={event.id}
                      onClick={onViewCalendar}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[9px] uppercase text-blue-600 dark:text-blue-400 leading-none">
                          {new Date(event.startDate).toLocaleString('default', { month: 'short' })}
                        </span>
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 leading-none mt-0.5">
                          {new Date(event.startDate).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{event.title}</p>
                        <p className="text-[11px] text-gray-400 dark:text-dark-500 truncate">
                          {event.allDay
                            ? 'All day'
                            : new Date(event.startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          {event.location ? ` · ${event.location}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent care requests */}
            <div data-tutorial="dashboard-tasks" className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-rose-50 dark:bg-rose-900/20 rounded-lg flex items-center justify-center">
                    <Heart size={15} className="text-rose-500" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Recent care requests</h2>
                </div>
                <button
                  onClick={() => onNavigate?.('pastoral-care')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  Crisis Center Dispatch <ArrowRight size={12} />
                </button>
              </div>
              {openCare.length === 0 ? (
                <div className="py-4 text-center">
                  <CheckCircle2 className="text-emerald-500 mx-auto mb-1" size={20} />
                  <p className="text-xs text-gray-400 dark:text-dark-500">No open member requests</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {openCare.slice(0, 4).map((conv) => {
                    const lastMessage = conv.messages[conv.messages.length - 1];
                    const person = conv.personId ? personMap.get(conv.personId) : undefined;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => onNavigate?.('pastoral-care')}
                        className="w-full p-2.5 rounded-lg bg-gray-50 dark:bg-dark-850 hover:bg-gray-100 dark:hover:bg-dark-750 transition-colors text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                            {conv.isAnonymous ? 'Anonymous' : person ? `${person.firstName} ${person.lastName}` : 'Member'}
                          </p>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              conv.priority === 'crisis'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                : conv.status === 'escalated'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                            }`}
                          >
                            {conv.priority === 'crisis' ? 'Crisis' : CARE_CATEGORY_LABELS[conv.category]}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-dark-400 truncate mt-0.5">
                          {lastMessage ? lastMessage.content : `${CARE_CATEGORY_LABELS[conv.category]} request`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* New members this week */}
            <div data-tutorial="dashboard-visitors" className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                    <UserPlus size={15} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">New members</h2>
                </div>
                <button
                  onClick={onViewPeople}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  Congregation <ArrowRight size={12} />
                </button>
              </div>
              {newMembersThisWeek.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-dark-500 py-4 text-center">No new members yet</p>
              ) : (
                <div className="space-y-1">
                  {newMembersThisWeek.map(person => (
                    <button
                      key={person.id}
                      onClick={() => onViewPerson(person.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/10 rounded-full flex items-center justify-center text-amber-700 dark:text-amber-400 text-xs font-medium">
                          {person.firstName[0]}{person.lastName[0]}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                            {person.firstName} {person.lastName}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-dark-500">
                            Joined {formatLocalDate(person.joinDate, 'recently')}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300 dark:text-dark-600 group-hover:text-gray-400 dark:group-hover:text-dark-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Links to Dedicated Pages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {onViewAnalytics && (
              <button
                onClick={onViewAnalytics}
                className="flex items-center gap-3 p-4 bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600 transition-all group shadow-sm"
              >
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">Analytics</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Growth metrics & member insights</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 dark:text-dark-600 group-hover:text-gray-500 dark:group-hover:text-dark-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            )}
            {onViewGiving && (
              <button
                onClick={onViewGiving}
                className="flex items-center gap-3 p-4 bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600 transition-all group shadow-sm"
              >
                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-slate-600 dark:text-slate-400" size={20} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">Impact Campaigns</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Campaigns, pledges & transaction history</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 dark:text-dark-600 group-hover:text-gray-500 dark:group-hover:text-dark-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            )}
          </div>
      </div>
    </div>
  );
}
