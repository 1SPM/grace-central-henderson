import { useMemo, useState } from 'react';
import {
  Users,
  BarChart3,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Activity,
  UserPlus,
  Heart,
  Clock,
  TrendingUp,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import type { Person, MemberStatus, Task, Giving, PrayerRequest, CalendarEvent, Interaction } from '../types';

interface AnalyticsProps {
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  prayers: PrayerRequest[];
  events: CalendarEvent[];
  interactions: Interaction[];
  onViewPerson?: (id: string) => void;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const statusColors: Record<MemberStatus, { bar: string; bg: string; text: string }> = {
  visitor: { bar: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  regular: { bar: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  member: { bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400' },
  leader: { bar: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  inactive: { bar: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400' },
};

const statusLabels: Record<MemberStatus, string> = {
  visitor: 'Visitors',
  regular: 'Regulars',
  member: 'Members',
  leader: 'Leaders',
  inactive: 'Inactive',
};

const activeStatuses: MemberStatus[] = ['visitor', 'regular', 'member', 'leader'];

function getDateThreshold(range: TimeRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/** Simple donut chart ring */
function DonutRing({ value, max, color, size = 80, strokeWidth = 7 }: { value: number; max: number; color: string; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className="text-gray-200 dark:text-dark-700" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" className={color} strokeDasharray={`${pct * circumference} ${circumference}`} style={{ transition: 'stroke-dasharray 0.6s ease-out' }} />
    </svg>
  );
}

/** Simple horizontal mini-bar used in tables */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-24 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%`, transition: 'width 0.5s ease-out' }} />
    </div>
  );
}

const activityIconMap: Record<string, { icon: typeof UserPlus; color: string; bg: string }> = {
  new_person: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-500/10' },
  task_completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-500/10' },
  interaction: { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-500/10' },
  prayer: { icon: Heart, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-500/10' },
  giving: { icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
};

export function Analytics({ people, tasks, giving, prayers, events, interactions, onViewPerson }: AnalyticsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  const metrics = useMemo(() => {
    const threshold = getDateThreshold(timeRange);

    // People metrics
    const statusCounts: Record<MemberStatus, number> = { visitor: 0, regular: 0, member: 0, leader: 0, inactive: 0 };
    let newPeopleInRange = 0;
    people.forEach(p => {
      statusCounts[p.status]++;
      const addedDate = p.firstVisit || p.joinDate;
      if (threshold && addedDate && new Date(addedDate) >= threshold) newPeopleInRange++;
    });
    const totalActive = activeStatuses.reduce((s, st) => s + statusCounts[st], 0);
    const conversionRate = totalActive > 0 ? Math.round(((statusCounts.member + statusCounts.leader) / totalActive) * 100) : 0;
    const maxStatusCount = Math.max(...Object.values(statusCounts), 1);

    // Giving metrics
    const givingInRange = threshold ? giving.filter(g => new Date(g.date) >= threshold) : giving;
    const totalGiving = givingInRange.reduce((s, g) => s + g.amount, 0);
    const avgGiving = givingInRange.length > 0 ? totalGiving / givingInRange.length : 0;
    const givingByFund: Record<string, number> = {};
    const givingByMethod: Record<string, number> = {};
    givingInRange.forEach(g => {
      givingByFund[g.fund] = (givingByFund[g.fund] || 0) + g.amount;
      givingByMethod[g.method] = (givingByMethod[g.method] || 0) + g.amount;
    });
    const recurringGiving = givingInRange.filter(g => g.isRecurring);
    const recurringTotal = recurringGiving.reduce((s, g) => s + g.amount, 0);
    const uniqueDonors = new Set(givingInRange.filter(g => g.personId).map(g => g.personId)).size;

    // Task metrics
    const tasksInRange = threshold ? tasks.filter(t => new Date(t.createdAt) >= threshold) : tasks;
    const completedTasks = tasksInRange.filter(t => t.completed);
    const taskCompletionRate = tasksInRange.length > 0 ? Math.round((completedTasks.length / tasksInRange.length) * 100) : 0;
    const overdueTasks = tasks.filter(t => !t.completed && new Date(t.dueDate) < new Date());
    const tasksByCategory: Record<string, number> = {};
    tasksInRange.forEach(t => {
      tasksByCategory[t.category] = (tasksByCategory[t.category] || 0) + 1;
    });
    const tasksByPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };
    tasks.filter(t => !t.completed).forEach(t => {
      tasksByPriority[t.priority]++;
    });

    // Prayer metrics
    const prayersInRange = threshold ? prayers.filter(p => new Date(p.createdAt) >= threshold) : prayers;
    const answeredPrayers = prayersInRange.filter(p => p.isAnswered);
    const activePrayers = prayers.filter(p => !p.isAnswered);

    // Interaction metrics
    const interactionsInRange = threshold ? interactions.filter(i => new Date(i.createdAt) >= threshold) : interactions;
    const interactionsByType: Record<string, number> = {};
    interactionsInRange.forEach(i => {
      interactionsByType[i.type] = (interactionsByType[i.type] || 0) + 1;
    });
    const totalInteractions = interactionsInRange.length;

    // Event metrics
    const upcomingEvents = events.filter(e => new Date(e.startDate) >= new Date());

    // Giving trend by month (last 6 months)
    const givingByMonth: { label: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const amount = giving.filter(g => g.date.startsWith(monthKey)).reduce((s, g) => s + g.amount, 0);
      givingByMonth.push({ label, amount });
    }
    const maxMonthlyGiving = Math.max(...givingByMonth.map(m => m.amount), 1);

    // Growth trend by month (last 6 months — people added)
    const growthByMonth: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const count = people.filter(p => {
        const dateStr = p.firstVisit || p.joinDate;
        return dateStr && dateStr.startsWith(monthKey);
      }).length;
      growthByMonth.push({ label, count });
    }
    const maxMonthlyGrowth = Math.max(...growthByMonth.map(m => m.count), 1);

    // Congregation Health Score (0-100)
    const retentionScore = totalActive > 0 ? Math.min(((totalActive - statusCounts.inactive) / (totalActive + statusCounts.inactive)) * 100, 100) : 0;
    const engagementScore = people.length > 0 ? Math.min((totalInteractions / people.length) * 25, 100) : 0;
    const givingScore = people.length > 0 ? Math.min((uniqueDonors / people.length) * 100, 100) : 0;
    const taskScore = taskCompletionRate;
    const healthScore = Math.round((retentionScore + engagementScore + givingScore + taskScore) / 4);

    return {
      statusCounts, maxStatusCount, totalActive, conversionRate, newPeopleInRange,
      totalGiving, avgGiving, givingByFund, givingByMethod, recurringTotal, uniqueDonors, givingByMonth, maxMonthlyGiving,
      tasksInRange, completedTasks, taskCompletionRate, overdueTasks, tasksByCategory, tasksByPriority,
      prayersInRange, answeredPrayers, activePrayers,
      totalInteractions, interactionsByType,
      upcomingEvents,
      growthByMonth, maxMonthlyGrowth,
      healthScore, retentionScore, engagementScore, givingScore, taskScore,
    };
  }, [people, tasks, giving, prayers, events, interactions, timeRange]);

  // Activity feed items
  const activities = useMemo(() => {
    const items: { id: string; type: string; title: string; subtitle?: string; timestamp: Date; personId?: string }[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    people.forEach(p => {
      const dateStr = p.firstVisit || p.joinDate;
      const addedDate = dateStr ? new Date(dateStr) : null;
      if (addedDate && addedDate > thirtyDaysAgo) {
        items.push({ id: `person-${p.id}`, type: 'new_person', title: `${p.firstName} ${p.lastName} was added`, subtitle: p.status === 'visitor' ? 'New visitor' : 'New member', timestamp: addedDate, personId: p.id });
      }
    });

    tasks.forEach(t => {
      if (t.completed) {
        const taskDate = new Date(t.createdAt);
        if (taskDate > sevenDaysAgo) {
          const person = t.personId ? personMap.get(t.personId) : null;
          items.push({ id: `task-${t.id}`, type: 'task_completed', title: t.title, subtitle: person ? `${person.firstName} ${person.lastName}` : undefined, timestamp: taskDate, personId: t.personId });
        }
      }
    });

    interactions.forEach(i => {
      const date = new Date(i.createdAt);
      if (date > sevenDaysAgo) {
        const person = personMap.get(i.personId);
        if (person) {
          items.push({ id: `interaction-${i.id}`, type: 'interaction', title: `${i.type.charAt(0).toUpperCase() + i.type.slice(1)} with ${person.firstName}`, subtitle: i.content?.substring(0, 50) || undefined, timestamp: date, personId: i.personId });
        }
      }
    });

    prayers.forEach(pr => {
      const date = new Date(pr.createdAt);
      if (date > fourteenDaysAgo) {
        const person = personMap.get(pr.personId);
        items.push({ id: `prayer-${pr.id}`, type: 'prayer', title: pr.content.substring(0, 60) + (pr.content.length > 60 ? '...' : ''), subtitle: person ? `From ${person.firstName}` : undefined, timestamp: date, personId: pr.personId });
      }
    });

    giving.forEach(g => {
      const date = new Date(g.date);
      if (date > sevenDaysAgo && g.personId) {
        const person = personMap.get(g.personId);
        if (person) {
          items.push({ id: `giving-${g.id}`, type: 'giving', title: `$${g.amount.toFixed(0)} donation`, subtitle: `${person.firstName} ${person.lastName}`, timestamp: date, personId: g.personId });
        }
      }
    });

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 15);
  }, [people, tasks, interactions, prayers, giving, personMap]);

  const fundLabels: Record<string, string> = { tithe: 'Tithe', offering: 'Offering', missions: 'Missions', building: 'Building', benevolence: 'Benevolence', other: 'Other' };
  const methodLabels: Record<string, string> = { cash: 'Cash', check: 'Check', card: 'Card', online: 'Online', bank: 'Bank Transfer' };
  const categoryLabels: Record<string, string> = { 'follow-up': 'Follow-Up', care: 'Care', admin: 'Admin', outreach: 'Outreach' };
  const interactionLabels: Record<string, string> = { note: 'Notes', call: 'Calls', email: 'Emails', visit: 'Visits', text: 'Texts', prayer: 'Prayer' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Insights into your congregation's health and growth</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
          {([['7d', '7 Days'], ['30d', '30 Days'], ['90d', '90 Days'], ['all', 'All Time']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                timeRange === value
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Congregation Health Score */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="relative flex-shrink-0">
            <DonutRing value={metrics.healthScore} max={100} color="text-white" size={100} strokeWidth={8} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold">{metrics.healthScore}</span>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-1">Congregation Health Score</h2>
            <p className="text-white/70 text-sm mb-3">Based on retention, engagement, giving participation, and task completion</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <p className="text-xs text-white/60">Retention</p>
                <p className="text-lg font-bold">{Math.round(metrics.retentionScore)}%</p>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <p className="text-xs text-white/60">Engagement</p>
                <p className="text-lg font-bold">{Math.round(metrics.engagementScore)}%</p>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <p className="text-xs text-white/60">Giving</p>
                <p className="text-lg font-bold">{Math.round(metrics.givingScore)}%</p>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <p className="text-xs text-white/60">Follow-Ups</p>
                <p className="text-lg font-bold">{Math.round(metrics.taskScore)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top-level KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Users size={20} />} label="Total People" value={people.length} sub={`${metrics.totalActive} active`} color="indigo" />
        <KpiCard icon={<UserPlus size={20} />} label="New People" value={metrics.newPeopleInRange} sub={timeRange === 'all' ? 'all time' : `last ${timeRange.replace('d', ' days')}`} color="emerald" trend={metrics.newPeopleInRange > 0 ? 'up' : undefined} />
        <KpiCard icon={<DollarSign size={20} />} label="Total Giving" value={formatCurrency(metrics.totalGiving)} sub={`${metrics.uniqueDonors} donors`} color="green" />
        <KpiCard icon={<CheckCircle2 size={20} />} label="Task Completion" value={`${metrics.taskCompletionRate}%`} sub={`${metrics.completedTasks.length}/${metrics.tasksInRange.length} tasks`} color="blue" trend={metrics.taskCompletionRate >= 70 ? 'up' : metrics.taskCompletionRate < 40 ? 'down' : undefined} />
      </div>

      {/* Row 2: People + Growth Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Distribution */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <SectionHeader icon={<BarChart3 size={18} />} title="Member Distribution" subtitle="By membership status" color="indigo" />
          <div className="space-y-3 mt-5">
            {activeStatuses.map(status => {
              const count = metrics.statusCounts[status];
              const pct = metrics.maxStatusCount > 0 ? (count / metrics.maxStatusCount) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${statusColors[status].text}`}>{statusLabels[status]}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-dark-100">{count}</span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div className={`h-full ${statusColors[status].bar} rounded-full`} style={{ width: `${pct}%`, transition: 'width 0.5s ease-out' }} />
                  </div>
                </div>
              );
            })}
            {metrics.statusCounts.inactive > 0 && (
              <div className="flex items-center gap-2 mt-3 p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                <AlertCircle size={16} className="text-amber-500 shrink-0" />
                <span className="text-sm text-amber-700 dark:text-amber-400">{metrics.statusCounts.inactive} inactive — consider outreach</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-dark-400">Conversion Rate (visitor → member)</span>
            <span className="text-lg font-bold text-gray-900 dark:text-dark-100">{metrics.conversionRate}%</span>
          </div>
        </div>

        {/* Growth Trend */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <SectionHeader icon={<TrendingUp size={18} />} title="Growth Trend" subtitle="New people per month" color="emerald" />
          <div className="mt-5 flex items-end gap-2 h-40">
            {metrics.growthByMonth.map((m, i) => {
              const pct = metrics.maxMonthlyGrowth > 0 ? (m.count / metrics.maxMonthlyGrowth) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{m.count > 0 ? m.count : ''}</span>
                  <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-t-lg overflow-hidden" style={{ height: '120px' }}>
                    <div className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t-lg" style={{ height: `${pct}%`, marginTop: `${100 - pct}%`, transition: 'height 0.5s ease-out, margin-top 0.5s ease-out' }} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{m.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700 grid grid-cols-3 gap-3">
            <MiniStat label="Total Active" value={String(metrics.totalActive)} />
            <MiniStat label="New This Period" value={String(metrics.newPeopleInRange)} />
            <MiniStat label="Conversion" value={`${metrics.conversionRate}%`} />
          </div>
        </div>
      </div>

      {/* Row 3: Giving Trend + Giving by Fund */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Giving Trend */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <SectionHeader icon={<DollarSign size={18} />} title="Giving Trend" subtitle="Last 6 months" color="green" />
          <div className="mt-5 flex items-end gap-2 h-40">
            {metrics.givingByMonth.map((m, i) => {
              const pct = metrics.maxMonthlyGiving > 0 ? (m.amount / metrics.maxMonthlyGiving) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{m.amount > 0 ? formatCurrency(m.amount) : ''}</span>
                  <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-t-lg overflow-hidden" style={{ height: '120px' }}>
                    <div className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg" style={{ height: `${pct}%`, marginTop: `${100 - pct}%`, transition: 'height 0.5s ease-out, margin-top 0.5s ease-out' }} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{m.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700 grid grid-cols-3 gap-3">
            <MiniStat label="Avg Donation" value={formatCurrency(metrics.avgGiving)} />
            <MiniStat label="Recurring" value={formatCurrency(metrics.recurringTotal)} />
            <MiniStat label="Donors" value={String(metrics.uniqueDonors)} />
          </div>
        </div>

        {/* Giving by Fund */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <SectionHeader icon={<PieChart size={18} />} title="Giving by Fund" subtitle="Where donations go" color="emerald" />
          <div className="mt-5 space-y-3">
            {Object.entries(metrics.givingByFund).sort((a, b) => b[1] - a[1]).map(([fund, amount]) => {
              const maxFund = Math.max(...Object.values(metrics.givingByFund), 1);
              return (
                <div key={fund} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-24 shrink-0">{fundLabels[fund] || fund}</span>
                  <MiniBar value={amount} max={maxFund} color="bg-emerald-500" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-dark-100 ml-auto">{formatCurrency(amount)}</span>
                </div>
              );
            })}
            {Object.keys(metrics.givingByFund).length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No giving data for this period</p>}
          </div>
          {Object.keys(metrics.givingByMethod).length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-dark-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">By Method</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(metrics.givingByMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                  <span key={method} className="px-3 py-1.5 bg-gray-50 dark:bg-dark-800 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300">
                    {methodLabels[method] || method}: {formatCurrency(amount)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Tasks + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Overview */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <SectionHeader icon={<CheckCircle2 size={18} />} title="Task Overview" subtitle="Follow-ups & action items" color="blue" />
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="relative flex flex-col items-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
              <div className="relative">
                <DonutRing value={metrics.taskCompletionRate} max={100} color="text-blue-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{metrics.taskCompletionRate}%</span>
                </div>
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mt-2">Completion</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex-1 flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl">
                <AlertCircle size={18} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-dark-100">{metrics.overdueTasks.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Overdue</p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                <Clock size={18} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-dark-100">{metrics.tasksByPriority.high}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">High Priority</p>
                </div>
              </div>
            </div>
          </div>
          {Object.keys(metrics.tasksByCategory).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">By Category</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(metrics.tasksByCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-800 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{categoryLabels[cat] || cat}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-dark-100">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Engagement / Interactions */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <SectionHeader icon={<Activity size={18} />} title="Engagement" subtitle="Interactions & outreach" color="violet" />
          <div className="mt-5">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalInteractions}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">total interactions</p>
            <div className="space-y-2">
              {Object.entries(metrics.interactionsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const maxType = Math.max(...Object.values(metrics.interactionsByType), 1);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-16 shrink-0">{interactionLabels[type] || type}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(count / maxType) * 100}%`, transition: 'width 0.5s ease-out' }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-dark-100 w-8 text-right">{count}</span>
                  </div>
                );
              })}
              {metrics.totalInteractions === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No interactions for this period</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: Prayer & Events + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prayer & Events */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <SectionHeader icon={<Heart size={18} />} title="Prayer & Events" subtitle="Spiritual life & community" color="pink" />
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="p-4 bg-pink-50 dark:bg-pink-500/10 rounded-xl text-center">
              <p className="text-3xl font-bold text-pink-600 dark:text-pink-400">{metrics.prayersInRange.length}</p>
              <p className="text-sm text-pink-700 dark:text-pink-400 mt-1">Prayer Requests</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-center">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.answeredPrayers.length}</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">Answered</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl">
            <Heart size={16} className="text-pink-500 shrink-0" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{metrics.activePrayers.length} active prayer requests</span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
              <Calendar size={18} className="text-indigo-500 shrink-0" />
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-dark-100">{metrics.upcomingEvents.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Upcoming events</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-center">
                  <Clock className="text-slate-600 dark:text-slate-400" size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-dark-100">Recent Activity</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">Latest updates across your church</p>
                </div>
              </div>
              <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">{activities.length}</span>
            </div>
          </div>
          <div className="p-4 space-y-1 max-h-[400px] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="text-gray-300 dark:text-dark-600 mx-auto mb-2" size={24} />
                <p className="text-gray-400 dark:text-dark-500 text-sm">No recent activity</p>
              </div>
            ) : (
              activities.map((activity) => {
                const { icon: Icon, color, bg } = activityIconMap[activity.type] || activityIconMap.interaction;
                return (
                  <button
                    key={activity.id}
                    onClick={() => activity.personId && onViewPerson?.(activity.personId)}
                    disabled={!activity.personId || !onViewPerson}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors text-left disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-dark-100 truncate">{activity.title}</p>
                      {activity.subtitle && (
                        <p className="text-xs text-gray-400 dark:text-dark-500 truncate">{activity.subtitle}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-dark-500 flex-shrink-0">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Reusable section header inside cards */
function SectionHeader({ icon, title, subtitle, color }: { icon: React.ReactNode; title: string; subtitle: string; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    green: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
    pink: 'bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400',
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.indigo}`}>{icon}</div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-dark-100">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-dark-400">{subtitle}</p>
      </div>
    </div>
  );
}

/** Top-level KPI card */
function KpiCard({ icon, label, value, sub, color, trend }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string; trend?: 'up' | 'down' }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    green: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
    blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  };
  return (
    <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.indigo}`}>{icon}</div>
        {trend && (
          <span className={`flex items-center text-xs font-medium ${trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label} · {sub}</p>
    </div>
  );
}

/** Small stat inside a card footer */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-dark-400">{label}</p>
    </div>
  );
}
