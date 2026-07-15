import { useState } from 'react';
import { Bot, Flag, Reply } from 'lucide-react';
import { demoInbox, type InboxMessage } from './demoLeadersHub';
import { SampleDataNotice } from '../../SampleDataNotice';

type InboxFilter = 'all' | 'needs-you' | 'ai-replied' | 'flagged';

const STATE_BADGE: Record<InboxMessage['state'], { cls: string; label: string }> = {
  flagged: { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', label: 'Flagged' },
  'needs-you': { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', label: 'Needs you' },
  'ai-replied': { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', label: 'AI replied' },
};

export function LeaderInbox() {
  const [filter, setFilter] = useState<InboxFilter>('all');
  const messages = demoInbox.filter(m => filter === 'all' || m.state === filter);

  const counts = {
    all: demoInbox.length,
    'needs-you': demoInbox.filter(m => m.state === 'needs-you').length,
    'ai-replied': demoInbox.filter(m => m.state === 'ai-replied').length,
    flagged: demoInbox.filter(m => m.state === 'flagged').length,
  };

  return (
    <div className="space-y-4">
      <SampleDataNotice />
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { id: 'all', label: 'All messages' },
            { id: 'flagged', label: 'Flagged' },
            { id: 'needs-you', label: 'Needs you' },
            { id: 'ai-replied', label: 'AI replied' },
          ] as const
        ).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              filter === f.id
                ? 'border-slate-900 dark:border-dark-100 bg-slate-900 text-white dark:bg-dark-100 dark:text-dark-900'
                : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-850'
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-60">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-dark-700">
          {messages.map(msg => {
            const badge = STATE_BADGE[msg.state];
            return (
              <div key={msg.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                    msg.state === 'flagged'
                      ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300'
                  }`}
                >
                  {msg.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{msg.from}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                      {msg.state === 'flagged' && <Flag size={9} className="inline mr-0.5 -mt-px" />}
                      {badge.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200/70 dark:bg-dark-700 text-gray-500 dark:text-dark-400">
                      {msg.topic}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-dark-500 ml-auto whitespace-nowrap">{msg.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-dark-400 mt-1 truncate">{msg.preview}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-950 text-white rounded-md transition-colors">
                      <Reply size={11} /> Reply live
                    </button>
                    <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 rounded-md hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                      <Bot size={11} /> {msg.state === 'ai-replied' ? 'Review AI reply' : 'Draft with AI'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
