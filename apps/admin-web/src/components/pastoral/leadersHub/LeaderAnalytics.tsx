import { Star } from 'lucide-react';
import type { LeaderProfile } from '../../../types';
import type { LeadershipActivityData } from '../../../lib/services/leadershipApi';
import { statsForLeader } from '../../../lib/services/leadershipApi';
import { getLeaderHubStats } from './demoLeadersHub';
import { LeaderAvatar } from './LeaderAvatar';

interface LeaderAnalyticsProps {
  leaders: LeaderProfile[];
  activity?: LeadershipActivityData | null;
  isLive?: boolean;
}

function formatLastActive(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function LeaderAnalytics({ leaders, activity, isLive }: LeaderAnalyticsProps) {
  const rows = leaders
    .filter(l => l.isActive)
    .map(l => {
      const live = statsForLeader(activity ?? null, l.id);
      const demo = getLeaderHubStats(l);
      const human = live?.humanMessages ?? Math.round(demo.dms * (1 - demo.aiPct / 100));
      const ai = live?.aiMessages ?? Math.round(demo.dms * (demo.aiPct / 100));
      const total = human + ai;
      const aiShare = total > 0 ? Math.round((ai / total) * 100) : demo.aiPct;
      return {
        leader: l,
        conversations: live?.conversations ?? demo.sessions,
        human,
        ai,
        aiShare,
        rating: demo.rating,
        blessings: demo.blessings,
        lastActive: live?.lastActiveAt,
      };
    })
    .sort((a, b) => b.conversations - a.conversations);

  return (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
      <div className="p-5 pb-3">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Leader performance — last 7 days</h2>
        <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
          {isLive ? 'Live care conversation rollups' : 'Demo stats — sign in with Supabase for live data'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 border-b border-gray-200 dark:border-dark-700">
              <th className="px-5 py-2 font-medium">Leader</th>
              <th className="px-3 py-2 font-medium text-right">Conversations</th>
              <th className="px-3 py-2 font-medium text-right">Human</th>
              <th className="px-3 py-2 font-medium text-right">AI</th>
              <th className="px-3 py-2 font-medium">AI share</th>
              <th className="px-3 py-2 font-medium text-right">Rating</th>
              <th className="px-3 py-2 font-medium text-right">Blessings</th>
              <th className="px-5 py-2 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ leader, conversations, human, ai, aiShare, rating, blessings, lastActive }) => (
                <tr key={leader.id} className="border-b border-gray-100 dark:border-dark-700 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <LeaderAvatar leader={leader} size="xs" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-dark-100 truncate">{leader.displayName}</p>
                        <p className="text-[10px] text-gray-400 dark:text-dark-500 truncate">{leader.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                    {conversations}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{human}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-violet-700 dark:text-violet-300">{ai}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${aiShare}%` }} />
                      </div>
                      <span className="text-[11px] text-gray-500 dark:text-dark-400 tabular-nums w-8">{aiShare}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="inline-flex items-center gap-0.5">
                      <Star size={11} className="text-amber-500" /> {rating.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-dark-300">
                    {blessings}/28
                  </td>
                  <td className="px-5 py-3 text-[11px] text-gray-500 dark:text-dark-400 whitespace-nowrap">
                    {formatLastActive(lastActive)}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
