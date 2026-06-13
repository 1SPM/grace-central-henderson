import { EyeOff, MessageCircle } from 'lucide-react';
import type { WatchChatMessage } from '../../lib/services/liveService';

interface LiveChatModerationPanelProps {
  chat: WatchChatMessage[];
  watchingNow: number;
  onHideMessage: (id: string) => void;
  onViewPerson?: (id: string) => void;
}

function timeLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function avatarInitials(name: string): string {
  const parts = name.replace(/\./g, '').split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

export function LiveChatModerationPanel({
  chat,
  watchingNow,
  onHideMessage,
  onViewPerson,
}: LiveChatModerationPanelProps) {
  return (
    <div className="flex flex-col h-full min-h-[320px] bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white text-sm font-semibold">
          <MessageCircle size={16} className="text-red-500" />
          Live chat
        </div>
        <span className="text-[10px] text-gray-400">{watchingNow.toLocaleString()} watching</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {chat.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-8">No chat messages yet.</p>
        ) : (
          chat.map(msg => (
            <div
              key={msg.id}
              className={`group flex gap-2.5 ${msg.isHidden ? 'opacity-40' : ''}`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-semibold text-gray-300 shrink-0">
                {avatarInitials(msg.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => msg.personId && onViewPerson?.(msg.personId)}
                    className="text-xs font-semibold text-white hover:text-red-400 transition-colors"
                  >
                    {msg.authorName}
                  </button>
                  <span className="text-[10px] text-gray-500">{timeLabel(msg.createdAt)}</span>
                  {msg.isHidden && (
                    <span className="text-[9px] uppercase tracking-wider text-amber-500 font-semibold">Hidden</span>
                  )}
                </div>
                <p className="text-xs text-gray-300 mt-0.5 break-words">{msg.body}</p>
              </div>
              {!msg.isHidden && (
                <button
                  type="button"
                  onClick={() => onHideMessage(msg.id)}
                  title="Hide message"
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-gray-800 transition-all shrink-0"
                >
                  <EyeOff size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-3 border-t border-gray-800">
        <p className="text-[10px] text-gray-500 text-center">
          Admin view — moderation only. Members chat from the Watch page.
        </p>
      </div>
    </div>
  );
}
