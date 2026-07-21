import { Bot, Star } from 'lucide-react';
import type { LeaderProfile } from '../../../types';
import type { LeadershipActivityData } from '../../../lib/services/leadershipApi';
import { statsForLeader } from '../../../lib/services/leadershipApi';
import { getLeaderHubStats } from './demoLeadersHub';
import { countLeadershipBadges } from '../../../hooks/useLeadershipRoster';
import { LeaderAvatar } from './LeaderAvatar';

interface LeadersRosterProps {
  leaders: LeaderProfile[];
  activity?: LeadershipActivityData | null;
  onSelectLeader: (id: string) => void;
}

export function LeadersRoster({ leaders, activity, onSelectLeader }: LeadersRosterProps) {
  const active = leaders.filter(l => l.isActive);
  const available = active.filter(l => l.isAvailable);
  const badges = countLeadershipBadges(active);

  const hubStats = active.map(l => getLeaderHubStats(l));
  const sessionsMtd = active.reduce((sum, l) => {
    const live = statsForLeader(activity ?? null, l.id);
    return sum + (live?.conversations ?? getLeaderHubStats(l).sessions);
  }, 0);
  const avgRating = hubStats.length > 0
    ? hubStats.reduce((sum, s) => sum + s.rating, 0) / hubStats.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Leaders', value: badges.staff, sub: 'All verified', accent: 'border-l-rose-600' },
          { label: 'Live now', value: available.length, sub: `${active.length - available.length} AI on duty`, accent: 'border-l-emerald-600' },
          { label: 'AI companions', value: `${badges.aiDeployed}/${badges.staff}`, sub: 'All deployed', accent: 'border-l-violet-600' },
          { label: 'Sessions MTD', value: sessionsMtd, sub: '+ 22%', accent: 'border-l-blue-600' },
          { label: 'Avg rating', value: avgRating.toFixed(1), sub: 'Platform avg', star: true, accent: 'border-l-amber-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-stone-100 dark:bg-dark-800 rounded-2xl border border-l-[5px] border-gray-200 dark:border-dark-700 ${kpi.accent} p-5`}>
            <p className="section-eyebrow">{kpi.label}</p>
            <p className="stat-number text-4xl text-slate-900 dark:text-dark-100 mt-2 flex items-center gap-1.5">
              {kpi.star && <Star size={26} className="text-amber-500 fill-amber-500" />}
              {kpi.value}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-dark-100 mb-3">Clergy &amp; Staff</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {active.map(leader => {
            const live = statsForLeader(activity ?? null, leader.id);
            const stats = getLeaderHubStats(leader);
            const sessions = live?.conversations ?? stats.sessions;
            const hasAi = leader.hasAiCompanion !== false;

            return (
              <button
                key={leader.id}
                type="button"
                onClick={() => onSelectLeader(leader.id)}
                className="bg-stone-100 dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-4 text-left hover:border-gray-300 dark:hover:border-dark-500 transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  <LeaderAvatar leader={leader} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-dark-100 truncate leading-tight">
                      {leader.displayName}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-dark-400 truncate mt-0.5">{leader.title}</p>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {leader.isAvailable ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Live
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          AI on duty
                        </span>
                      )}
                      {hasAi && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                          <Bot size={9} /> AI Live
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-3 border-t border-gray-200 dark:border-dark-700 text-center">
                  <div>
                    <p className="stat-number text-xl text-gray-900 dark:text-dark-100">{sessions}</p>
                    <p className="text-[9px] text-gray-400 dark:text-dark-500 uppercase tracking-wide">Sessions</p>
                  </div>
                  <div>
                    <p className="stat-number text-xl text-gray-900 dark:text-dark-100">{stats.rating.toFixed(1)}</p>
                    <p className="text-[9px] text-gray-400 dark:text-dark-500 uppercase tracking-wide">Rating</p>
                  </div>
                  <div>
                    <p className="stat-number text-xl text-gray-900 dark:text-dark-100">{stats.blessings}/28</p>
                    <p className="text-[9px] text-gray-400 dark:text-dark-500 uppercase tracking-wide">Blessings</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
