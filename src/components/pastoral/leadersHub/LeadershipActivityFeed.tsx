import { useMemo, useState } from 'react';
import { Bot, Flag, Heart, Loader2, User } from 'lucide-react';
import type { LeadershipActivityData } from '../../../lib/services/leadershipApi';
import { demoInbox } from './demoLeadersHub';

type ActivityFilter = 'all' | 'human' | 'ai' | 'unassigned';

interface LeadershipActivityFeedProps {
  activity: LeadershipActivityData | null;
  loading: boolean;
  isLive: boolean;
  onNavigate?: (view: string) => void;
}

const EVENT_LABEL: Record<string, string> = {
  human_reply: 'Human reply',
  ai_reply: 'AI companion reply',
  help_request: 'Help request',
  care_message: 'Care message',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function LeadershipActivityFeed({
  activity,
  loading,
  isLive,
  onNavigate,
}: LeadershipActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const events = useMemo(() => {
    if (activity?.recentEvents?.length) {
      return activity.recentEvents.filter(ev => {
        if (filter === 'all') return true;
        if (filter === 'human') return ev.type === 'human_reply';
        if (filter === 'ai') return ev.type === 'ai_reply';
        if (filter === 'unassigned') return !ev.leaderId;
        return true;
      });
    }
    // Demo fallback when API unavailable
    return demoInbox.map(msg => ({
      at: new Date().toISOString(),
      type: msg.state === 'ai-replied' ? 'ai_reply' : 'human_reply',
      leaderId: msg.topic,
      memberName: msg.from,
      preview: msg.preview,
    }));
  }, [activity, filter]);

  const summary = activity?.summary;
  const goToCare = () => {
    if (onNavigate) onNavigate('pastoral-care');
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Active conversations', value: summary.activeConversations },
            { label: 'Human replies (24h)', value: summary.humanReplies24h },
            { label: 'AI replies (24h)', value: summary.aiReplies24h },
            { label: 'Unassigned', value: summary.unassigned },
          ].map(kpi => (
            <div key={kpi.label} className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <p className="section-eyebrow">{kpi.label}</p>
              <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'human', label: 'Human activity' },
              { id: 'ai', label: 'AI companion' },
              { id: 'unassigned', label: 'Unassigned' },
            ] as const
          ).map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                filter === f.id
                  ? 'border-slate-900 dark:border-dark-100 bg-slate-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-850'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          <span className="text-[11px] text-gray-500 dark:text-dark-400">
            {isLive ? 'Live from Care' : 'Demo preview'}
          </span>
          <button
            type="button"
            onClick={goToCare}
            className="text-xs font-medium text-slate-700 dark:text-dark-200 hover:underline"
          >
            Crisis Center Dispatch →
          </button>
        </div>
      </div>

      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-dark-700">
          {events.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-dark-400">
              No activity yet. Member conversations appear here when Care is in use.
            </div>
          ) : (
            events.map((ev, i) => {
              const isAi = ev.type === 'ai_reply';
              const isHuman = ev.type === 'human_reply';
              return (
                <div key={`${ev.at}-${i}`} className="flex items-start gap-3 px-5 py-4">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isAi
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                        : isHuman
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    }`}
                  >
                    {isAi ? <Bot size={16} /> : isHuman ? <User size={16} /> : <Flag size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        {EVENT_LABEL[ev.type] ?? ev.type}
                      </span>
                      {ev.memberName && (
                        <span className="text-xs text-gray-500 dark:text-dark-400">· {ev.memberName}</span>
                      )}
                      <span className="text-[10px] text-gray-400 dark:text-dark-500 ml-auto">{formatWhen(ev.at)}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-dark-300 mt-1 line-clamp-2">{ev.preview}</p>
                    {ev.leaderId && (
                      <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1">Leader: {ev.leaderId}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-xl border border-brand-200 dark:border-brand-900/40 bg-brand-50/80 dark:bg-brand-950/20 p-4 flex items-start gap-3">
        <Heart size={18} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-dark-100">Member conversations live in Care</p>
          <p className="text-xs text-gray-600 dark:text-dark-400 mt-0.5">
            This feed tracks human and AI companion activity. Open Crisis Center Dispatch to read threads and reply as staff.
          </p>
          <button
            type="button"
            onClick={goToCare}
            className="mt-2 text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
          >
            Crisis Center Dispatch
          </button>
        </div>
      </div>
    </div>
  );
}
