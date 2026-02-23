import { useMemo, useState } from 'react';
import { formatLocalDate } from '../utils/validation';
import {
  Users,
  UserPlus,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Heart,
  LayoutDashboard,
  Church,
  ListTodo,
  LayoutGrid,
  List,
  Zap,
  BookOpen,
  BarChart3,
  DollarSign,
} from 'lucide-react';
import { Person, Task, Giving, Interaction, PrayerRequest, CalendarEvent } from '../types';
import { GivingWidget } from './GivingWidget';

import { SundayPrep } from './SundayPrep';
import { StatCard } from './ui/StatCard';
import { StatusBadge, priorityToVariant } from './ui/StatusBadge';
import { ProgressBar } from './ui/ProgressBar';
import { KanbanBoard } from './ui/KanbanBoard';
import { CalendarWidget } from './dashboard/CalendarWidget';

interface DashboardProps {
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
}

type DashboardTab = 'overview' | 'sunday-prep' | 'tasks';
type TaskViewMode = 'list' | 'kanban';

export function Dashboard({ people, tasks, events = [], giving = [], prayers = [], onViewPerson, onViewTasks, onViewGiving, onViewPeople, onViewVisitors, onViewInactive, onViewActions, onViewCalendar, onViewAnalytics }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('kanban');

  // Memoize filtered arrays to prevent recalculation on every render
  const { visitors, inactive, pendingTasks } = useMemo(() => ({
    visitors: people.filter(p => p.status === 'visitor'),
    inactive: people.filter(p => p.status === 'inactive'),
    pendingTasks: tasks.filter(t => !t.completed),
  }), [people, tasks]);

  // Memoize sorted pending tasks
  const sortedPendingTasks = useMemo(() =>
    [...pendingTasks].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }).slice(0, 5),
    [pendingTasks]
  );

  // Memoize person lookup map for O(1) access
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  // Generate trend data for sparklines (simulating weekly trends)
  const completedTasks = tasks.filter(t => t.completed).length;
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Mock sparkline data (in a real app, this would come from historical data)
  const peopleSparkline = [45, 48, 52, 50, 55, 58, people.length];
  const visitorsSparkline = [2, 4, 3, 5, 4, 6, visitors.length];
  const tasksSparkline = [8, 6, 9, 5, 7, 4, pendingTasks.length];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero Header with Photo */}
      <div className="mb-6 relative overflow-hidden rounded-2xl h-48">
        {/* Background Image - Church/Community themed */}
        <img
          src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=1200&h=400&fit=crop"
          alt="Church community"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-800/70 to-slate-900/60" />
        <div className="relative h-full p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="text-amber-300" size={18} />
                <span className="text-white/70 text-sm">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}!</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Welcome to Grace CRM</h1>
              <p className="text-white/60 mt-1 text-sm">Here's what needs your attention today.</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <Heart className="text-white/80" size={28} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-800 shadow-md'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/10'
              }`}
            >
              <LayoutDashboard size={16} />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tasks'
                  ? 'bg-white text-slate-800 shadow-md'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/10'
              }`}
            >
              <ListTodo size={16} />
              Tasks
            </button>
            <button
              onClick={() => setActiveTab('sunday-prep')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'sunday-prep'
                  ? 'bg-white text-slate-800 shadow-md'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/10'
              }`}
            >
              <Church size={16} />
              Sunday Prep
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'sunday-prep' ? (
        <SundayPrep people={people} prayers={prayers} onViewPerson={onViewPerson} />
      ) : activeTab === 'tasks' ? (
        <>
          {/* Tasks Header with View Toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                <ListTodo className="text-indigo-600 dark:text-indigo-400" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Board</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{tasks.length} total tasks, {pendingTasks.length} pending</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
              <button
                onClick={() => setTaskViewMode('kanban')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  taskViewMode === 'kanban'
                    ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <LayoutGrid size={14} />
                Board
              </button>
              <button
                onClick={() => setTaskViewMode('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  taskViewMode === 'list'
                    ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <List size={14} />
                List
              </button>
            </div>
          </div>

          {/* Task Progress */}
          {tasks.length > 0 && (
            <div className="mb-6 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{completedTasks}/{tasks.length} completed</span>
              </div>
              <ProgressBar value={completedTasks} max={tasks.length} color="emerald" size="lg" />
            </div>
          )}

          {/* Kanban or List View */}
          {taskViewMode === 'kanban' ? (
            <KanbanBoard
              tasks={tasks}
              people={people}
              onViewPerson={onViewPerson}
              onAddTask={onViewTasks}
            />
          ) : (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-dark-700">
                {tasks.length === 0 ? (
                  <div className="py-12 text-center">
                    <ListTodo className="text-gray-300 dark:text-gray-600 mx-auto mb-3" size={32} />
                    <p className="text-gray-400 dark:text-gray-500">No tasks yet</p>
                  </div>
                ) : (
                  tasks.map(task => {
                    const person = task.personId ? people.find(p => p.id === task.personId) : undefined;
                    const isOverdue = !task.completed && new Date(task.dueDate) < new Date();
                    return (
                      <div
                        key={task.id}
                        className={`p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors ${
                          task.completed ? 'opacity-60' : ''
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${
                          task.completed ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-amber-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-gray-900 dark:text-white ${
                            task.completed ? 'line-through' : ''
                          }`}>{task.title}</p>
                          {person && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">{person.firstName} {person.lastName}</p>
                          )}
                        </div>
                        <StatusBadge variant={priorityToVariant(task.priority)} icon>
                          {task.priority}
                        </StatusBadge>
                        <span className={`text-xs ${isOverdue ? 'text-rose-500 font-medium' : 'text-gray-400'}`}>
                          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
      {/* Stats Grid with Sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total People"
          value={people.length}
          icon={<Users size={20} />}
          change={12}
          changeLabel="vs last month"
          sparklineData={peopleSparkline}
          accentColor="blue"
          onClick={onViewPeople}
        />
        <StatCard
          label="New Visitors"
          value={visitors.length}
          icon={<UserPlus size={20} />}
          change={visitors.length > 0 ? 25 : 0}
          changeLabel="this week"
          sparklineData={visitorsSparkline}
          accentColor="amber"
          onClick={onViewVisitors}
        />
        <StatCard
          label="Need Attention"
          value={inactive.length}
          icon={<AlertCircle size={20} />}
          change={inactive.length > 0 ? -8 : 0}
          changeLabel="improving"
          invertTrend
          accentColor="rose"
          onClick={onViewInactive}
        />
        <StatCard
          label="Tasks Done"
          value={`${taskCompletionRate}%`}
          icon={<ListTodo size={20} />}
          change={15}
          changeLabel="this week"
          sparklineData={tasksSparkline}
          accentColor="emerald"
          onClick={onViewTasks}
        />
      </div>

      {/* Members Need Care Alert — positioned high for pastoral priority */}
      {inactive.length > 0 && (
        <div className="mb-6 bg-rose-50 dark:bg-rose-900/10 rounded-xl p-4 border border-rose-200 dark:border-rose-800/30 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
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
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-xs font-medium text-gray-700 dark:text-dark-300 hover:bg-rose-100 dark:hover:bg-dark-750 border border-gray-200 dark:border-dark-600 transition-colors shadow-sm"
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
          className="group relative overflow-hidden bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-5 text-left transition-all hover:shadow-lg hover:scale-[1.01] shadow-sm"
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
              {pendingTasks.filter(t => t.priority === 'high').length > 0
                ? `${pendingTasks.filter(t => t.priority === 'high').length} urgent, ${visitors.length} visitors, ${pendingTasks.length - pendingTasks.filter(t => t.priority === 'high').length} tasks`
                : `${visitors.length} visitors, ${pendingTasks.length} tasks`
              }
            </p>
          </div>
        </button>

        {/* Sermon Builder CTA */}
        <button
          onClick={() => setActiveTab('sunday-prep')}
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
            <h3 className="text-base font-semibold text-white mb-1">Sermon Builder</h3>
            <p className="text-white/80 text-sm">
              Prepare for Sunday with AI assistance
            </p>
          </div>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Recent Visitors */}
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden shadow-sm">
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
                  <UserPlus className="text-amber-600 dark:text-amber-400" size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-dark-100">Recent Visitors</h2>
                  <span className="text-xs text-gray-500 dark:text-dark-400">Last 30 days</span>
                </div>
              </div>
              {visitors.length > 0 && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {visitors.length} new
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {visitors.length === 0 ? (
              <p className="text-gray-400 dark:text-dark-500 text-sm py-6 text-center">No recent visitors</p>
            ) : (
              <div className="space-y-1">
                {visitors.slice(0, 5).map((person) => (
                  <button
                    key={person.id}
                    onClick={() => onViewPerson(person.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/10 rounded-full flex items-center justify-center text-amber-700 dark:text-amber-400 text-xs font-medium">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{person.firstName} {person.lastName}</p>
                        <p className="text-xs text-gray-500 dark:text-dark-500">
                          {formatLocalDate(person.firstVisit, 'Unknown')}
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

        {/* Priority Tasks */}
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden shadow-sm">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="text-indigo-600 dark:text-indigo-400" size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-dark-100">Priority Follow-Ups</h2>
                  <span className="text-xs text-gray-500 dark:text-dark-400">Tasks needing attention</span>
                </div>
              </div>
              <button
                onClick={onViewTasks}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                View all
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
          <div className="p-4">
            {pendingTasks.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="text-emerald-500" size={24} />
                </div>
                <p className="text-gray-500 dark:text-dark-400 text-sm font-medium">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedPendingTasks.map((task) => {
                  const person = task.personId ? personMap.get(task.personId) : undefined;
                  const isOverdue = new Date(task.dueDate) < new Date();

                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border ${isOverdue ? 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5' : 'border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-850'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{task.title}</p>
                          {person && (
                            <p className="text-xs text-gray-500 dark:text-dark-500 mt-0.5">
                              {person.firstName} {person.lastName}
                            </p>
                          )}
                        </div>
                        <StatusBadge variant={priorityToVariant(task.priority)} icon>
                          {task.priority}
                        </StatusBadge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Clock size={10} className={isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-dark-500'} />
                        <span className={`text-[10px] ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-dark-500'}`}>
                          {isOverdue ? 'Overdue' : 'Due'}: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Giving + Calendar Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Giving Widget — spans 2 columns */}
        {onViewGiving && (
          <div className="lg:col-span-2">
            <GivingWidget giving={giving} onViewGiving={onViewGiving} />
          </div>
        )}

        {/* Calendar Widget — compact, collapses when empty */}
        <div className="lg:col-span-1">
          <CalendarWidget events={events} onViewCalendar={onViewCalendar} />
        </div>
      </div>

      {/* Quick Links to Dedicated Pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {onViewAnalytics && (
          <button
            onClick={onViewAnalytics}
            className="flex items-center gap-3 p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600 transition-all group shadow-sm"
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
            className="flex items-center gap-3 p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600 transition-all group shadow-sm"
          >
            <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/20 rounded-lg flex items-center justify-center">
              <DollarSign className="text-violet-600 dark:text-violet-400" size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">Giving Details</p>
              <p className="text-xs text-gray-500 dark:text-dark-400">Full transaction history & reports</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 dark:text-dark-600 group-hover:text-gray-500 dark:group-hover:text-dark-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        )}
      </div>
      </>
      )}
    </div>
  );
}
