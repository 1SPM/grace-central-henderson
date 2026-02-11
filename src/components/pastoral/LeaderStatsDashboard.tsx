import { useState, useMemo } from 'react';
import {
  Clock,
  Star,
  Users,
  MessageCircle,
  CheckCircle,
  ChevronLeft,
  Filter,
} from 'lucide-react';
import type { LeaderProfile, LeaderStats, PastoralSession, HelpCategory } from '../../types';
import { VerifiedBadge } from './VerifiedBadge';

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  'marriage': 'Marriage',
  'addiction': 'Recovery',
  'grief': 'Grief',
  'faith-questions': 'Faith',
  'crisis': 'Crisis',
  'financial': 'Financial',
  'anxiety-depression': 'Mental Health',
  'parenting': 'Parenting',
  'general': 'General',
};

const CATEGORY_COLORS: Record<HelpCategory, string> = {
  'marriage': 'bg-pink-500',
  'addiction': 'bg-orange-500',
  'grief': 'bg-blue-500',
  'faith-questions': 'bg-violet-500',
  'crisis': 'bg-red-500',
  'financial': 'bg-emerald-500',
  'anxiety-depression': 'bg-cyan-500',
  'parenting': 'bg-amber-500',
  'general': 'bg-gray-500',
};

interface LeaderStatsDashboardProps {
  leaders: LeaderProfile[];
  sessions: PastoralSession[];
  onBack?: () => void;
  onViewLeader?: (leaderId: string) => void;
}

function computeLeaderStats(leader: LeaderProfile, sessions: PastoralSession[]): LeaderStats {
  const leaderSessions = sessions.filter(s => s.leaderId === leader.id);
  const completed = leaderSessions.filter(s => s.status === 'completed');
  const active = leaderSessions.filter(s => s.status === 'active');
  const cancelled = leaderSessions.filter(s => s.status === 'cancelled');
  const noShows = leaderSessions.filter(s => s.status === 'no-show');

  const totalMinutes = completed.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const ratings = completed.filter(s => s.rating != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((sum, s) => sum + (s.rating || 0), 0) / ratings.length : 0;

  const categoryCounts: Record<string, number> = {};
  leaderSessions.forEach(s => {
    categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
  });

  const categoryBreakdown = Object.entries(categoryCounts).map(([cat, count]) => ({
    category: cat as HelpCategory,
    count,
    percentage: leaderSessions.length > 0 ? (count / leaderSessions.length) * 100 : 0,
  })).sort((a, b) => b.count - a.count);

  // Monthly activity for the last 6 months
  const monthlyActivity: { month: string; sessions: number; hours: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const monthSessions = completed.filter(s => {
      const sd = new Date(s.startedAt);
      return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
    });
    monthlyActivity.push({
      month: monthStr,
      sessions: monthSessions.length,
      hours: monthSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60,
    });
  }

  const followUpNeeded = completed.filter(s => s.followUpNeeded);
  const sortedSessions = [...leaderSessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return {
    leaderId: leader.id,
    leaderName: leader.displayName,
    leaderTitle: leader.title,
    totalSessions: leaderSessions.length,
    completedSessions: completed.length,
    activeSessions: active.length,
    cancelledSessions: cancelled.length,
    noShowSessions: noShows.length,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    averageSessionMinutes: completed.length > 0 ? Math.round(totalMinutes / completed.length) : 0,
    averageRating: Math.round(avgRating * 10) / 10,
    totalRatings: ratings.length,
    categoryBreakdown,
    monthlyActivity,
    responseRate: leaderSessions.length > 0 ? ((completed.length + active.length) / leaderSessions.length) * 100 : 0,
    followUpRate: completed.length > 0 ? (followUpNeeded.length / completed.length) * 100 : 0,
    isVerified: leader.isVerified,
    isAvailable: leader.isAvailable,
    lastSessionDate: sortedSessions[0]?.startedAt,
  };
}

export function LeaderStatsDashboard({ leaders, sessions, onBack }: LeaderStatsDashboardProps) {
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('all');

  const filteredSessions = useMemo(() => {
    if (timeRange === 'all') return sessions;
    const now = new Date();
    const cutoff = new Date(now);
    if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else cutoff.setFullYear(cutoff.getFullYear() - 1);
    return sessions.filter(s => new Date(s.startedAt) >= cutoff);
  }, [sessions, timeRange]);

  const allStats = useMemo(
    () => leaders.map(l => computeLeaderStats(l, filteredSessions)),
    [leaders, filteredSessions]
  );

  const selectedStats = selectedLeaderId ? allStats.find(s => s.leaderId === selectedLeaderId) : null;
  const selectedLeader = selectedLeaderId ? leaders.find(l => l.id === selectedLeaderId) : null;

  // Aggregate stats
  const totalSessions = filteredSessions.length;
  const completedSessions = filteredSessions.filter(s => s.status === 'completed').length;
  const totalHours = Math.round(filteredSessions.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60 * 10) / 10;
  const avgRating = (() => {
    const rated = filteredSessions.filter(s => s.rating != null);
    return rated.length > 0 ? Math.round(rated.reduce((sum, s) => sum + (s.rating || 0), 0) / rated.length * 10) / 10 : 0;
  })();
  const activeLeaderCount = leaders.filter(l => l.isActive && l.isAvailable).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100">Leader Analytics</h2>
            <p className="text-sm text-gray-500 dark:text-dark-400">Pastoral care team performance and insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 rounded-lg"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Sessions', value: totalSessions, icon: MessageCircle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Completed', value: completedSessions, icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'Total Hours', value: totalHours, icon: Clock, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
          { label: 'Avg Rating', value: avgRating > 0 ? `${avgRating}/5` : '---', icon: Star, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
          { label: 'Active Leaders', value: `${activeLeaderCount}/${leaders.length}`, icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                <stat.icon size={14} className={stat.color} />
              </div>
              <span className="text-xs text-gray-500 dark:text-dark-400">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Leader Performance Table */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-dark-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Leader Performance</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-dark-700">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Leader</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Sessions</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Hours</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Rating</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Response</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Top Category</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-dark-700/50">
              {allStats.map(stat => {
                const leader = leaders.find(l => l.id === stat.leaderId);
                const topCategory = stat.categoryBreakdown[0];
                return (
                  <tr
                    key={stat.leaderId}
                    onClick={() => setSelectedLeaderId(stat.leaderId === selectedLeaderId ? null : stat.leaderId)}
                    className={`cursor-pointer transition-colors ${
                      stat.leaderId === selectedLeaderId
                        ? 'bg-violet-50 dark:bg-violet-500/5'
                        : 'hover:bg-gray-50 dark:hover:bg-dark-750'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                          {stat.leaderName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900 dark:text-dark-100">{stat.leaderName}</span>
                            {stat.isVerified && <VerifiedBadge size="sm" />}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-dark-400">{stat.leaderTitle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-dark-100">{stat.completedSessions}</span>
                      <span className="text-xs text-gray-400 dark:text-dark-500">/{stat.totalSessions}</span>
                    </td>
                    <td className="text-center px-3 py-3 text-sm text-gray-700 dark:text-dark-300">{stat.totalHours}h</td>
                    <td className="text-center px-3 py-3">
                      {stat.averageRating > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-dark-100">{stat.averageRating}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-dark-500">---</span>
                      )}
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className={`text-sm font-medium ${
                        stat.responseRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                        stat.responseRate >= 50 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {Math.round(stat.responseRate)}%
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {topCategory ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[topCategory.category]}`} />
                          <span className="text-sm text-gray-700 dark:text-dark-300">{CATEGORY_LABELS[topCategory.category]}</span>
                          <span className="text-xs text-gray-400 dark:text-dark-500">({topCategory.count})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-dark-500">None yet</span>
                      )}
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        leader?.isAvailable
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${leader?.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {leader?.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Leader Detail */}
      {selectedStats && selectedLeader && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {selectedStats.leaderName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">{selectedStats.leaderName}</h3>
                  {selectedStats.isVerified && <VerifiedBadge size="sm" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-dark-400">{selectedStats.leaderTitle}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedLeaderId(null)}
              className="text-xs text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-300"
            >
              Close
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Avg Session', value: `${selectedStats.averageSessionMinutes}min`, color: 'text-blue-600 dark:text-blue-400' },
                { label: 'Follow-up Rate', value: `${Math.round(selectedStats.followUpRate)}%`, color: 'text-purple-600 dark:text-purple-400' },
                { label: 'Active Cases', value: selectedStats.activeSessions, color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'No-shows', value: selectedStats.noShowSessions, color: 'text-red-600 dark:text-red-400' },
              ].map(m => (
                <div key={m.label} className="text-center p-3 bg-gray-50 dark:bg-dark-850 rounded-lg">
                  <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Category Breakdown Bar */}
            {selectedStats.categoryBreakdown.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-3">Category Breakdown</h4>
                <div className="space-y-2">
                  {selectedStats.categoryBreakdown.map(cat => (
                    <div key={cat.category} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 dark:text-dark-300 w-24">{CATEGORY_LABELS[cat.category]}</span>
                      <div className="flex-1 h-5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${CATEGORY_COLORS[cat.category]} rounded-full transition-all`}
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-dark-400 w-16 text-right">{cat.count} ({Math.round(cat.percentage)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly Activity */}
            {selectedStats.monthlyActivity.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-3">Monthly Activity</h4>
                <div className="flex items-end gap-2 h-32">
                  {selectedStats.monthlyActivity.map(month => {
                    const maxSessions = Math.max(...selectedStats.monthlyActivity.map(m => m.sessions), 1);
                    const heightPct = (month.sessions / maxSessions) * 100;
                    return (
                      <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-dark-400">{month.sessions}</span>
                        <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-t-lg relative" style={{ height: '80px' }}>
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-violet-500 dark:bg-violet-400 rounded-t-lg transition-all"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-dark-500">{month.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
