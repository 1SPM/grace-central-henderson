import { Bot, MessageSquare, ShieldCheck, Sparkles, Star } from 'lucide-react';
import type { HelpCategory, LeaderProfile } from '../../../types';
import { getLeaderHubStats } from './demoLeadersHub';

const CATEGORY_LABELS: Record<HelpCategory, string> = {
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

interface LeadersRosterProps {
  leaders: LeaderProfile[];
  onSelectLeader: (id: string) => void;
}

export function LeadersRoster({ leaders, onSelectLeader }: LeadersRosterProps) {
  const active = leaders.filter(l => l.isActive);
  const available = active.filter(l => l.isAvailable);
  const totals = active.reduce(
    (acc, l) => {
      const s = getLeaderHubStats(l);
      acc.sessions += s.sessions;
      acc.dms += s.dms;
      acc.blessings += s.blessings;
      return acc;
    },
    { sessions: 0, dms: 0, blessings: 0 },
  );

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Verified leaders', value: active.length, sub: `${available.length} available now` },
          { label: 'Sessions (30d)', value: totals.sessions, sub: 'live + AI companion' },
          { label: 'Member DMs (30d)', value: totals.dms, sub: 'across all leaders' },
          { label: 'Blessings shared', value: totals.blessings, sub: 'this month' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow">{kpi.label}</p>
            <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">{kpi.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Leader cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {active.map(leader => {
          const stats = getLeaderHubStats(leader);
          const initials = leader.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
          return (
            <button
              key={leader.id}
              onClick={() => onSelectLeader(leader.id)}
              className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 text-left hover:border-gray-300 dark:hover:border-dark-500 transition-colors"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="relative shrink-0">
                  {leader.photo ? (
                    <img src={leader.photo} alt={leader.displayName} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-dark-700 flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-dark-200">
                      {initials}
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-stone-100 dark:border-dark-800 flex items-center justify-center">
                    <ShieldCheck size={9} className="text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100 truncate">{leader.displayName}</p>
                  <p className="text-[11px] text-gray-500 dark:text-dark-400 truncate">{leader.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      <Sparkles size={9} /> AI twin
                    </span>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        leader.isAvailable
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400'
                      }`}
                    >
                      {leader.isAvailable ? 'Available' : 'Away'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {leader.expertiseAreas.slice(0, 3).map(area => (
                  <span key={area} className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200/70 dark:bg-dark-700 text-gray-600 dark:text-dark-300">
                    {CATEGORY_LABELS[area]}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1 pt-3 border-t border-gray-200 dark:border-dark-700 text-center">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">{stats.sessions}</p>
                  <p className="text-[9px] text-gray-400 dark:text-dark-500 uppercase tracking-wide">Sessions</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100 flex items-center justify-center gap-0.5">
                    <Star size={10} className="text-amber-500" /> {stats.rating.toFixed(1)}
                  </p>
                  <p className="text-[9px] text-gray-400 dark:text-dark-500 uppercase tracking-wide">Rating</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100 flex items-center justify-center gap-0.5">
                    <MessageSquare size={10} className="text-gray-400" /> {stats.dms}
                  </p>
                  <p className="text-[9px] text-gray-400 dark:text-dark-500 uppercase tracking-wide">DMs</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100 flex items-center justify-center gap-0.5">
                    <Bot size={10} className="text-violet-500" /> {stats.aiPct}%
                  </p>
                  <p className="text-[9px] text-gray-400 dark:text-dark-500 uppercase tracking-wide">AI</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
