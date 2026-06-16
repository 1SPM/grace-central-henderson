/**
 * Notification center — live bell in the admin header (Phase D).
 * Backed by Supabase Realtime via useRealtimeNotifications.
 */

import { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Mail, Smartphone, CheckCheck, Bot } from 'lucide-react';
import { useRealtimeNotifications, type LiveNotification } from '../hooks/useRealtimeNotifications';

interface NotificationCenterProps {
  churchId?: string;
  onNavigate?: (view: string) => void;
}

function iconFor(kind: LiveNotification['kind']) {
  if (kind === 'crisis') return <AlertTriangle size={14} className="text-red-500" />;
  if (kind === 'inbox') return <Mail size={14} className="text-blue-500" />;
  if (kind === 'agent') return <Bot size={14} className="text-purple-500" />;
  return <Smartphone size={14} className="text-indigo-500" />;
}

function targetView(n: LiveNotification): string {
  if (n.kind === 'agent') return 'dashboard';
  if (n.id.startsWith('agent-')) return n.kind === 'crisis' ? 'pastoral-care' : 'dashboard';
  if (n.kind === 'inbox' || n.kind === 'crisis') return n.id.startsWith('inbox-') ? 'mail' : 'pastoral-care';
  return 'discipleship-engagement';
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function NotificationCenter({ churchId, onNavigate }: NotificationCenterProps) {
  const { notifications, unreadCount, connected, markAllRead } = useRealtimeNotifications(churchId);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!churchId) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open) markAllRead();
        }}
        className="relative p-2 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-lg transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={17} className="text-gray-500 dark:text-dark-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Notifications</h3>
              <span
                className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-600'}`}
                title={connected ? 'Live' : 'Reconnecting'}
              />
            </div>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 flex items-center gap-1"
              >
                <CheckCheck size={12} /> Mark read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={20} className="text-gray-300 dark:text-dark-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-dark-500">
                  {connected ? "You're all caught up" : 'Waiting for live updates…'}
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.(targetView(n));
                  }}
                  className={`w-full px-4 py-2.5 flex items-start gap-2.5 text-left hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors border-b border-gray-50 dark:border-dark-800 last:border-0 ${
                    !n.read ? 'bg-indigo-50/40 dark:bg-indigo-500/5' : ''
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{iconFor(n.kind)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-dark-100">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400 truncate">{n.body}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-dark-500 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
