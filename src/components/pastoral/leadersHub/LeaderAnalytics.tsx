import { Star } from 'lucide-react';
import type { LeaderProfile } from '../../../types';
import { getLeaderHubStats } from './demoLeadersHub';

interface LeaderAnalyticsProps {
  leaders: LeaderProfile[];
}

export function LeaderAnalytics({ leaders }: LeaderAnalyticsProps) {
  const rows = leaders
    .filter(l => l.isActive)
    .map(l => ({ leader: l, stats: getLeaderHubStats(l) }))
    .sort((a, b) => b.stats.sessions - a.stats.sessions);

  return (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
      <div className="p-5 pb-3">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Leader performance — last 30 days</h2>
        <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
          Sessions across live and AI companion, member ratings, and engagement
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 border-b border-gray-200 dark:border-dark-700">
              <th className="px-5 py-2 font-medium">Leader</th>
              <th className="px-3 py-2 font-medium text-right">Sessions</th>
              <th className="px-3 py-2 font-medium">AI share</th>
              <th className="px-3 py-2 font-medium text-right">Rating</th>
              <th className="px-3 py-2 font-medium text-right">Blessings</th>
              <th className="px-5 py-2 font-medium text-right">DMs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ leader, stats }) => {
              const initials = leader.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <tr key={leader.id} className="border-b border-gray-100 dark:border-dark-700 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-dark-300 flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-dark-100 truncate">{leader.displayName}</p>
                        <p className="text-[10px] text-gray-400 dark:text-dark-500 truncate">{leader.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                    {stats.sessions}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${stats.aiPct}%` }} />
                      </div>
                      <span className="text-[11px] text-gray-500 dark:text-dark-400 tabular-nums w-8">{stats.aiPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="inline-flex items-center gap-1 font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                      <Star size={11} className="text-amber-500" /> {stats.rating.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600 dark:text-dark-300 tabular-nums">{stats.blessings}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-dark-300 tabular-nums">{stats.dms}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
