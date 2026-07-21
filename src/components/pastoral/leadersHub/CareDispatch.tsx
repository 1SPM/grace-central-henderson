import { Bot, PhoneCall, Radio } from 'lucide-react';
import type { LeaderProfile, HelpCategory, PastoralConversation } from '../../../types';
import { demoCareLog, demoDispatchMatrix, type CareLogEntry } from './demoLeadersHub';
import { SampleDataNotice } from '../../SampleDataNotice';

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

type DispatchLogEntry = CareLogEntry & { conversationId?: string };

interface CareDispatchProps {
  conversations: PastoralConversation[];
  leaders: LeaderProfile[];
  onOpenConversation: (id: string) => void;
  memberNames?: Map<string, string>;
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function sortDispatchQueue(conversations: PastoralConversation[]): PastoralConversation[] {
  const priorityOrder: Record<string, number> = { crisis: 0, high: 1, medium: 2, low: 3 };
  return [...conversations]
    .filter(c => c.status !== 'resolved' && c.status !== 'archived')
    .sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      if (!a.leaderId && b.leaderId) return -1;
      if (a.leaderId && !b.leaderId) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

function conversationToLogEntry(
  conv: PastoralConversation,
  leaders: LeaderProfile[],
  memberNames?: Map<string, string>,
): DispatchLogEntry {
  const leaderName = conv.leaderId
    ? leaders.find(l => l.id === conv.leaderId)?.displayName ?? 'Care team'
    : 'Unassigned';
  const lastMsg = conv.messages[conv.messages.length - 1];
  const handledBy: 'AI' | 'Live' =
    lastMsg?.sender === 'leader' ? 'Live' : lastMsg?.sender === 'ai' ? 'AI' : 'AI';
  const memberLabel = conv.isAnonymous
    ? 'Anonymous'
    : conv.personId && memberNames?.get(conv.personId)
      ? memberNames.get(conv.personId)!
      : 'Member';

  let outcome = 'In queue';
  if (conv.status === 'escalated') outcome = 'Escalated → live team';
  else if (conv.status === 'active' && lastMsg?.sender === 'leader') outcome = 'Live response sent';
  else if (conv.status === 'active' && lastMsg?.sender === 'ai') outcome = 'AI triage active';
  else if (conv.status === 'waiting') outcome = 'Awaiting response';
  else if (conv.priority === 'crisis') outcome = 'Crisis flagged';

  return {
    conversationId: conv.id,
    time: new Date(conv.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    member: memberLabel,
    service: CATEGORY_LABELS[conv.category],
    handledBy,
    leader: leaderName,
    outcome,
  };
}

export function CareDispatch({ conversations, leaders, onOpenConversation, memberNames }: CareDispatchProps) {
  const openQueue = sortDispatchQueue(conversations);
  const todayConversations = conversations.filter(c => isToday(c.createdAt) || isToday(c.updatedAt));

  const careLog: DispatchLogEntry[] =
    openQueue.length > 0
      ? openQueue.map(c => conversationToLogEntry(c, leaders, memberNames))
      : demoCareLog;

  const aiHandled = careLog.filter(c => c.handledBy === 'AI').length;
  const escalations = openQueue.filter(
    c => c.status === 'escalated' || c.priority === 'crisis',
  ).length;

  return (
    <div className="space-y-4">
      <SampleDataNotice />
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Care touches today',
            value: todayConversations.length || careLog.length,
            sub: 'member requests received',
          },
          {
            label: 'AI handled',
            value: aiHandled,
            sub: `${careLog.length ? Math.round((aiHandled / careLog.length) * 100) : 0}% of volume`,
          },
          {
            label: 'Escalations',
            value: escalations,
            sub: 'crisis / live handoff',
          },
          {
            label: 'Unassigned',
            value: openQueue.filter(c => !c.leaderId).length,
            sub: 'awaiting leader match',
          },
        ].map(kpi => (
          <div key={kpi.label} className="bg-stone-100 dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5">
            <p className="section-eyebrow">{kpi.label}</p>
            <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-2">{kpi.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Routing matrix */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="flex items-center gap-2 p-5 pb-3">
          <Radio size={15} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Crisis Center Dispatch — service routing</h2>
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

      {/* Open dispatch queue */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="flex items-center gap-2 p-5 pb-3">
          <PhoneCall size={15} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">
            Open dispatch queue
            {openQueue.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-dark-400">
                ({openQueue.length} active)
              </span>
            )}
          </h2>
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
              {careLog.map((entry, i) => {
                const isClickable = !!entry.conversationId;
                return (
                  <tr
                    key={entry.conversationId ?? `${entry.time}-${i}`}
                    onClick={isClickable ? () => onOpenConversation(entry.conversationId!) : undefined}
                    className={`border-b border-gray-100 dark:border-dark-700 last:border-0 ${
                      isClickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors' : ''
                    }`}
                  >
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
