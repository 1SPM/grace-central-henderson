import { Bot, PhoneCall, Radio } from 'lucide-react';
import type { PastoralSession, LeaderProfile, HelpCategory } from '../../../types';
import { demoCareLog, demoDispatchMatrix, type CareLogEntry } from './demoLeadersHub';

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  marriage: 'Marriage',
  addiction: 'Recovery',
  grief: 'Grief',
  'faith-questions': 'Faith',
  crisis: 'Crisis',
  financial: 'Financial',
  'anxiety-depression': 'Mental health',
  parenting: 'Parenting',
  general: 'General',
};

interface CareDispatchProps {
  sessions: PastoralSession[];
  leaders: LeaderProfile[];
}

export function CareDispatch({ sessions, leaders }: CareDispatchProps) {
  // Real pastoral sessions feed the care log when present; demo rows
  // otherwise so the dispatch board always demonstrates the flow.
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => new Date(s.startedAt).toDateString() === today);
  const leaderName = (id: string) => leaders.find(l => l.id === id)?.displayName ?? 'Care team';

  const careLog: CareLogEntry[] =
    todaySessions.length > 0
      ? todaySessions.slice(0, 8).map(s => ({
          time: new Date(s.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          member: s.isAnonymous ? 'Anonymous' : 'Member',
          service: CATEGORY_LABELS[s.category],
          handledBy: s.sessionType === 'chat' ? 'AI' : 'Live',
          leader: leaderName(s.leaderId),
          outcome: s.status === 'completed' ? 'Completed' : s.status === 'active' ? 'In conversation now' : s.status,
        }))
      : demoCareLog;

  const aiHandled = careLog.filter(c => c.handledBy === 'AI').length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Care touches today', value: careLog.length, sub: 'all services' },
          { label: 'AI handled', value: aiHandled, sub: `${careLog.length ? Math.round((aiHandled / careLog.length) * 100) : 0}% of volume` },
          { label: 'Escalations', value: careLog.filter(c => c.outcome.toLowerCase().includes('escalat')).length || 1, sub: 'paged to live clergy' },
          { label: 'Avg first response', value: '38s', sub: 'AI triage on care line' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow">{kpi.label}</p>
            <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">{kpi.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Routing matrix */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="flex items-center gap-2 p-5 pb-3">
          <Radio size={15} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Care dispatch — service routing</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 border-b border-gray-200 dark:border-dark-700">
                <th className="px-5 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium">Leader AI</th>
                <th className="px-3 py-2 font-medium">Escalation rule</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {demoDispatchMatrix.map(route => (
                <tr key={route.service} className="border-b border-gray-100 dark:border-dark-700 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-gray-900 dark:text-dark-100">{route.service}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300">
                      <Bot size={12} /> {route.leaderAi}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-dark-400">{route.escalation}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        route.status === 'Live'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : route.status === 'Paused'
                            ? 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}
                    >
                      {route.status === 'Live' ? '● Live now' : route.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Today's care log */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="flex items-center gap-2 p-5 pb-3">
          <PhoneCall size={15} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Today's care log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 border-b border-gray-200 dark:border-dark-700">
                <th className="px-5 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Member</th>
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium">Handled by</th>
                <th className="px-3 py-2 font-medium">Leader</th>
                <th className="px-5 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {careLog.map((entry, i) => (
                <tr key={`${entry.time}-${i}`} className="border-b border-gray-100 dark:border-dark-700 last:border-0">
                  <td className="px-5 py-2.5 text-xs text-gray-500 dark:text-dark-400 whitespace-nowrap">{entry.time}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-dark-100">{entry.member}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-dark-300">{entry.service}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        entry.handledBy === 'AI'
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}
                    >
                      {entry.handledBy}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-dark-300">{entry.leader}</td>
                  <td className="px-5 py-2.5 text-xs text-gray-500 dark:text-dark-400">{entry.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
