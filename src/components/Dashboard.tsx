import {
  Users,
  UserPlus,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Person, Task, Giving } from '../types';
import { PRIORITY_COLORS } from '../constants';
import { DashboardCharts } from './DashboardCharts';
import { BirthdayWidget } from './BirthdayWidget';
import { GivingWidget } from './GivingWidget';

interface DashboardProps {
  people: Person[];
  tasks: Task[];
  giving?: Giving[];
  onViewPerson: (id: string) => void;
  onViewTasks: () => void;
  onViewGiving?: () => void;
}

export function Dashboard({ people, tasks, giving = [], onViewPerson, onViewTasks, onViewGiving }: DashboardProps) {
  const visitors = people.filter(p => p.status === 'visitor');
  const inactive = people.filter(p => p.status === 'inactive');
  const pendingTasks = tasks.filter(t => !t.completed);

  const stats = [
    {
      label: 'Total People',
      value: people.length,
      icon: <Users className="text-indigo-600 dark:text-indigo-400" size={18} />,
      bg: 'bg-indigo-100 dark:bg-indigo-500/10'
    },
    {
      label: 'New Visitors',
      value: visitors.length,
      icon: <UserPlus className="text-amber-600 dark:text-amber-400" size={18} />,
      bg: 'bg-amber-100 dark:bg-amber-500/10',
      highlight: visitors.length > 0
    },
    {
      label: 'Need Attention',
      value: inactive.length,
      icon: <AlertCircle className="text-red-500 dark:text-red-400" size={18} />,
      bg: 'bg-red-100 dark:bg-red-500/10',
      highlight: inactive.length > 0
    },
    {
      label: 'Pending Tasks',
      value: pendingTasks.length,
      icon: <Clock className="text-blue-600 dark:text-blue-400" size={18} />,
      bg: 'bg-blue-100 dark:bg-blue-500/10'
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-dark-400 mt-0.5">Welcome back. Here's what needs your attention.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center`}>
                {stat.icon}
              </div>
              {stat.highlight && (
                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
                  Action
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Visitors */}
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Recent Visitors</h2>
            <span className="text-xs text-gray-400 dark:text-dark-500">Last 30 days</span>
          </div>

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
                      <p className="text-xs text-gray-400 dark:text-dark-500">
                        {person.firstVisit ? new Date(person.firstVisit).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 dark:text-dark-600 group-hover:text-gray-400 dark:group-hover:text-dark-500" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority Tasks */}
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Priority Follow-Ups</h2>
            <button
              onClick={onViewTasks}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight size={12} />
            </button>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={24} />
              <p className="text-gray-400 dark:text-dark-500 text-sm">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTasks
                .sort((a, b) => {
                  const priorityOrder = { high: 0, medium: 1, low: 2 };
                  return priorityOrder[a.priority] - priorityOrder[b.priority];
                })
                .slice(0, 5)
                .map((task) => {
                  const person = people.find(p => p.id === task.personId);
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
                            <p className="text-xs text-gray-400 dark:text-dark-500 mt-0.5">
                              {person.firstName} {person.lastName}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Clock size={10} className={isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-dark-500'} />
                        <span className={`text-[10px] ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-dark-500'}`}>
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

      {/* Giving Widget */}
      {onViewGiving && (
        <div className="mt-4">
          <GivingWidget giving={giving} onViewGiving={onViewGiving} />
        </div>
      )}

      {/* Inactive Members Alert */}
      {inactive.length > 0 && (
        <div className="mt-4 bg-red-50 dark:bg-red-500/5 rounded-xl p-4 border border-red-100 dark:border-red-500/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="text-red-600 dark:text-red-400" size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">Members Need Care</h3>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
                {inactive.length} {inactive.length === 1 ? 'person hasn\'t' : 'people haven\'t'} been active recently.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {inactive.slice(0, 3).map((person) => (
                  <button
                    key={person.id}
                    onClick={() => onViewPerson(person.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-dark-800 rounded text-xs font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-750 border border-gray-200 dark:border-dark-600"
                  >
                    {person.firstName} {person.lastName}
                    <ChevronRight size={12} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">Analytics</h2>
        <DashboardCharts people={people} />
      </div>

      {/* Birthday Widget */}
      <div className="mt-6">
        <BirthdayWidget people={people} onViewPerson={onViewPerson} />
      </div>
    </div>
  );
}
