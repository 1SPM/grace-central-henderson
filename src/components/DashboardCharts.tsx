import { TrendingUp, Users, BarChart3 } from 'lucide-react';
import type { Person, MemberStatus } from '../types';

interface DashboardChartsProps {
  people: Person[];
}

const statusColors: Record<MemberStatus, { bar: string; text: string }> = {
  visitor: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  regular: { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  member: { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  leader: { bar: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
  inactive: { bar: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400' },
};

const statusLabels: Record<MemberStatus, string> = {
  visitor: 'Visitors',
  regular: 'Regulars',
  member: 'Members',
  leader: 'Leaders',
  inactive: 'Inactive',
};

export function DashboardCharts({ people }: DashboardChartsProps) {
  // Calculate counts by status
  const statusCounts: Record<MemberStatus, number> = {
    visitor: 0,
    regular: 0,
    member: 0,
    leader: 0,
    inactive: 0,
  };

  people.forEach((person) => {
    statusCounts[person.status]++;
  });

  const maxCount = Math.max(...Object.values(statusCounts), 1);
  const activeStatuses: MemberStatus[] = ['visitor', 'regular', 'member', 'leader'];

  // Calculate growth metrics (simulated for demo)
  const totalActive = activeStatuses.reduce((sum, status) => sum + statusCounts[status], 0);
  const conversionRate = totalActive > 0
    ? Math.round(((statusCounts.member + statusCounts.leader) / totalActive) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Status Distribution Chart */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-dark-100">Member Distribution</h3>
            <p className="text-sm text-gray-500 dark:text-dark-400">By membership status</p>
          </div>
        </div>

        <div className="space-y-4">
          {activeStatuses.map((status) => {
            const count = statusCounts[status];
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={status}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-sm font-medium ${statusColors[status].text}`}>
                    {statusLabels[status]}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-dark-100">
                    {count}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${statusColors[status].bar} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-dark-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-dark-400">Total Active</span>
            <span className="font-semibold text-gray-900 dark:text-dark-100">{totalActive}</span>
          </div>
        </div>
      </div>

      {/* Growth Metrics */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-dark-100">Growth Metrics</h3>
            <p className="text-sm text-gray-500 dark:text-dark-400">Conversion & engagement</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Conversion Rate */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 rounded-xl p-4">
            <div className="flex items-center justify-center mb-3">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-gray-200 dark:text-dark-700"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    className="text-green-500"
                    strokeDasharray={`${conversionRate * 2.2} 220`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    {conversionRate}%
                  </span>
                </div>
              </div>
            </div>
            <p className="text-center text-sm font-medium text-green-700 dark:text-green-400">
              Conversion Rate
            </p>
            <p className="text-center text-xs text-green-600/70 dark:text-green-400/70 mt-1">
              Visitor to Member
            </p>
          </div>

          {/* Member Engagement */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10 rounded-xl p-4">
            <div className="flex items-center justify-center mb-3">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-gray-200 dark:text-dark-700"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    className="text-purple-500"
                    strokeDasharray={`${statusCounts.leader > 0 ? Math.min(((statusCounts.leader / (statusCounts.member + statusCounts.leader || 1)) * 100) * 2.2, 220) : 0} 220`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {statusCounts.leader}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-center text-sm font-medium text-purple-700 dark:text-purple-400">
              Leaders
            </p>
            <p className="text-center text-xs text-purple-600/70 dark:text-purple-400/70 mt-1">
              Active in ministry
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl">
            <Users size={18} className="text-gray-400" />
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                {statusCounts.inactive}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400">Need outreach</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl">
            <TrendingUp size={18} className="text-gray-400" />
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                {people.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400">Total people</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
