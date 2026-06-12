import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  ChevronDown,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import type { LeaderProfile, HelpCategory } from '../../types';
import { DEMO_LEADERS } from '../member/demoLeaders';

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

/**
 * Demo presence overlay for the right-rail panel. Keyed by leader id so
 * it works for both DEMO_LEADERS and real leader rows (which fall back
 * to availability-based status). Replace with realtime presence later.
 */
const DEMO_PRESENCE: Record<string, { live: boolean; aiOnDuty: boolean; twinLive: boolean }> = {
  'leader-1': { live: true, aiOnDuty: true, twinLive: true },
  'leader-2': { live: false, aiOnDuty: true, twinLive: true },
  'leader-3': { live: false, aiOnDuty: true, twinLive: false },
  'leader-4': { live: true, aiOnDuty: false, twinLive: true },
  'leader-5': { live: false, aiOnDuty: true, twinLive: true },
};

interface VerifiedLeadersPanelProps {
  leaders?: LeaderProfile[];
  onManageLeaders?: () => void;
}

export function VerifiedLeadersPanel({ leaders, onManageLeaders }: VerifiedLeadersPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const roster = (leaders && leaders.length > 0 ? leaders : DEMO_LEADERS).filter(
    l => l.isVerified && l.isActive,
  );

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-stone-200 dark:border-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-200 dark:border-dark-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
            <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-100 leading-tight">
              Verified Leaders
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-dark-400">
              {roster.length} on the care team
            </p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="xl:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-dark-300"
          aria-label={collapsed ? 'Expand leaders panel' : 'Collapse leaders panel'}
        >
          <ChevronDown size={16} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="divide-y divide-stone-200 dark:divide-dark-700">
            {roster.map(leader => {
              const presence = DEMO_PRESENCE[leader.id] ?? {
                live: leader.isAvailable,
                aiOnDuty: true,
                twinLive: false,
              };
              const initials = leader.displayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const topics = leader.expertiseAreas.slice(0, 3);

              return (
                <div key={leader.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      {leader.photo ? (
                        <img src={leader.photo} alt={leader.displayName} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-dark-700 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-dark-200">
                          {initials}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-dark-800 ${
                          presence.live ? 'bg-emerald-500' : presence.aiOnDuty ? 'bg-violet-500' : 'bg-gray-300 dark:bg-dark-600'
                        }`}
                        title={presence.live ? 'Live now' : presence.aiOnDuty ? 'AI on duty' : 'Offline'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-dark-100 truncate">
                        {leader.displayName}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-dark-400 truncate">{leader.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {presence.live ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            ● Live now
                          </span>
                        ) : presence.aiOnDuty ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            AI on duty
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400">
                            Offline
                          </span>
                        )}
                        {presence.twinLive && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            <Sparkles size={9} /> Digital twin live
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Topics */}
                  {topics.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <span className="text-[10px] text-gray-400 dark:text-dark-500">Connect on:</span>
                      {topics.map(t => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300"
                        >
                          {CATEGORY_LABELS[t]}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium bg-slate-900 hover:bg-slate-950 text-white rounded-md transition-colors">
                      <Bot size={11} /> Launch AI
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-gray-700 dark:text-dark-300 border border-gray-200 dark:border-dark-600 rounded-md hover:bg-stone-50 dark:hover:bg-dark-850 transition-colors">
                      <MessageSquare size={11} /> Message
                    </button>
                    <button
                      onClick={onManageLeaders}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-gray-700 dark:text-dark-300 border border-gray-200 dark:border-dark-600 rounded-md hover:bg-stone-50 dark:hover:bg-dark-850 transition-colors"
                    >
                      <User size={11} /> Profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-stone-50 dark:bg-dark-850 border-t border-stone-200 dark:border-dark-700 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-dark-400">
              <Phone size={12} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>
                <strong className="text-gray-700 dark:text-dark-200">24-hr care line</strong> — AI triage answers
                instantly, escalates to on-call clergy
              </span>
            </div>
            {onManageLeaders && (
              <button
                onClick={onManageLeaders}
                className="flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white"
              >
                Manage leaders <ArrowRight size={12} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
