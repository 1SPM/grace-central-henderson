import {
  Users,
  UserPlus,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Person, Task } from '../types';
import { PRIORITY_COLORS } from '../constants';

interface DashboardProps {
  people: Person[];
  tasks: Task[];
  onViewPerson: (id: string) => void;
  onViewTasks: () => void;
}

export function Dashboard({ people, tasks, onViewPerson, onViewTasks }: DashboardProps) {
  const visitors = people.filter(p => p.status === 'visitor');
  const inactive = people.filter(p => p.status === 'inactive');
  const pendingTasks = tasks.filter(t => !t.completed);

  const stats = [
    {
      label: 'Total People',
      value: people.length,
      icon: <Users className="text-indigo-600 dark:text-indigo-400" size={24} />,
      bg: 'bg-indigo-50 dark:bg-indigo-500/10'
    },
    {
      label: 'New Visitors',
      value: visitors.length,
      icon: <UserPlus className="text-amber-600 dark:text-amber-400" size={24} />,
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      highlight: visitors.length > 0
    },
    {
      label: 'Need Attention',
      value: inactive.length,
      icon: <AlertCircle className="text-red-500 dark:text-red-400" size={24} />,
      bg: 'bg-red-50 dark:bg-red-500/10',
      highlight: inactive.length > 0
    },
    {
      label: 'Pending Tasks',
      value: pendingTasks.length,
      icon: <Clock className="text-blue-600 dark:text-blue-400" size={24} />,
      bg: 'bg-blue-50 dark:bg-blue-500/10'
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">Welcome back. Here's what needs your attention.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              {stat.icon}
              {stat.highlight && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full">
                  Action needed
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">{stat.value}</p>
            <p className="text-sm text-gray-600 dark:text-dark-300 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Visitors */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Recent Visitors</h2>
            <span className="text-xs text-dark-400">Last 30 days</span>
          </div>

          {visitors.length === 0 ? (
            <p className="text-dark-400 text-sm py-8 text-center">No recent visitors</p>
          ) : (
            <div className="space-y-3">
              {visitors.slice(0, 5).map((person) => (
                <button
                  key={person.id}
                  onClick={() => onViewPerson(person.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-800 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-medium">
                      {person.firstName[0]}{person.lastName[0]}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900 dark:text-dark-100">{person.firstName} {person.lastName}</p>
                      <p className="text-sm text-dark-400">
                        First visit: {person.firstVisit ? new Date(person.firstVisit).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 dark:group-hover:text-dark-300" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority Tasks */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Priority Follow-Ups</h2>
            <button
              onClick={onViewTasks}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              View all
            </button>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto text-green-500" size={32} />
              <p className="text-dark-400 text-sm">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
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
                      className={`p-3 rounded-xl border ${isOverdue ? 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10' : 'border-gray-100 dark:border-dark-700'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-dark-100 text-sm">{task.title}</p>
                          {person && (
                            <p className="text-xs text-dark-400 mt-1">
                              {person.firstName} {person.lastName}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock size={12} className={isOverdue ? 'text-red-500' : 'text-dark-400'} />
                        <span className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-dark-400'}`}>
                          {isOverdue ? 'Overdue: ' : 'Due: '}
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Inactive Members Alert */}
      {inactive.length > 0 && (
        <div className="mt-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-500/10 dark:to-orange-500/10 rounded-2xl p-6 border border-red-100 dark:border-red-500/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-xl flex items-center justify-center">
              <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-dark-100">Members Need Care</h3>
              <p className="text-sm text-gray-600 dark:text-dark-300 mt-1">
                {inactive.length} {inactive.length === 1 ? 'person hasn\'t' : 'people haven\'t'} been active recently. Consider reaching out.
              </p>
              <div className="flex gap-2 mt-4">
                {inactive.slice(0, 3).map((person) => (
                  <button
                    key={person.id}
                    onClick={() => onViewPerson(person.id)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-200 hover:bg-gray-50 dark:hover:bg-dark-700 border border-gray-200 dark:border-dark-600"
                  >
                    {person.firstName} {person.lastName}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
