import { useMemo, useState } from 'react';
import { Activity, Brain, Play, Radio, Zap } from 'lucide-react';
import type { LeaderProfile } from '../../../types';
import {
  CENTRAL_HENDERSON_COMPANION_CONFIG,
  getLeaderCompanionConfig,
} from '../../../config/centralHendersonLeaders';
import { demoCompanionConfig } from './demoLeadersHub';
import { SampleDataNotice } from '../../SampleDataNotice';
import { buildBrainState } from './companionBrainState';
import { CompanionBrainPanel } from './CompanionBrainPanel';
import { DidStudioModal } from './DidStudioModal';

type ConfigTab = 'brain' | 'triggers' | 'channels' | 'activity';

const TABS: { id: ConfigTab; label: string; icon: typeof Brain }[] = [
  { id: 'brain', label: 'Brain', icon: Brain },
  { id: 'triggers', label: 'Triggers', icon: Zap },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'activity', label: 'Activity', icon: Activity },
];

interface AICompanionConfigProps {
  leader: LeaderProfile;
  embedded?: boolean;
  showHeader?: boolean;
  studioOpen?: boolean;
  onStudioOpenChange?: (open: boolean) => void;
}

export function AICompanionConfig({
  leader,
  embedded = false,
  showHeader = true,
  studioOpen: controlledStudioOpen,
  onStudioOpenChange,
}: AICompanionConfigProps) {
  const [tab, setTab] = useState<ConfigTab>('brain');
  const [triggers, setTriggers] = useState(demoCompanionConfig.triggers);
  const [channels, setChannels] = useState(demoCompanionConfig.channels);
  const [internalStudioOpen, setInternalStudioOpen] = useState(false);
  const studioOpen = controlledStudioOpen ?? internalStudioOpen;
  const setStudioOpen = onStudioOpenChange ?? setInternalStudioOpen;

  const companion = useMemo(() => getLeaderCompanionConfig(leader.id), [leader.id]);
  const resolvedCompanion = companion ?? CENTRAL_HENDERSON_COMPANION_CONFIG[leader.id];
  const [brain, setBrain] = useState(() => buildBrainState(resolvedCompanion, leader));

  if (!resolvedCompanion) {
    return (
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <p className="text-sm text-gray-600 dark:text-dark-300">
          No AI companion is configured for {leader.displayName}.
        </p>
      </div>
    );
  }

  const studioGreeting = brain.greetings[0]?.trim() || resolvedCompanion.greeting;

  return (
    <div className="space-y-4">
      <SampleDataNotice label="Activity and config data below are samples — not live" />
      {showHeader && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">
                {embedded ? `${leader.displayName} — AI companion` : 'AI companion configuration'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                Persona, escalation triggers, channels, and avatar session for this verified leader.
              </p>
              <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-2">
                {leader.title} · {leader.isAvailable ? 'Live / reachable' : 'AI on duty'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStudioOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
            >
              <Play size={14} /> Launch avatar conversation
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              tab === id
                ? 'border-slate-900 dark:border-dark-100 bg-slate-900 text-white dark:bg-dark-100 dark:text-dark-900'
                : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-850'
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {tab === 'brain' && (
        <CompanionBrainPanel value={brain} onChange={setBrain} leader={leader} />
      )}

      {tab === 'triggers' && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-1">Escalation triggers</h3>
          <p className="text-xs text-gray-500 dark:text-dark-400 mb-4">
            When the AI twin detects these signals it hands off according to the rule
          </p>
          <div className="space-y-2">
            {triggers.map((trigger, i) => (
              <label
                key={trigger.label}
                className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-dark-850 rounded-lg cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{trigger.label}</p>
                  <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5">→ {trigger.action}</p>
                </div>
                <input
                  type="checkbox"
                  checked={trigger.enabled}
                  onChange={e =>
                    setTriggers(prev => prev.map((t, j) => (j === i ? { ...t, enabled: e.target.checked } : t)))
                  }
                  className="w-4 h-4 accent-slate-900 flex-shrink-0"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {tab === 'channels' && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">Active channels</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {channels.map((channel, i) => (
              <label
                key={channel.label}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  channel.enabled
                    ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/15'
                    : 'border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-850'
                }`}
              >
                <span className="text-sm text-gray-900 dark:text-dark-100">{channel.label}</span>
                <input
                  type="checkbox"
                  checked={channel.enabled}
                  onChange={e =>
                    setChannels(prev => prev.map((c, j) => (j === i ? { ...c, enabled: e.target.checked } : c)))
                  }
                  className="w-4 h-4 accent-slate-900 flex-shrink-0"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">
            Session log — {leader.displayName}
          </h3>
          <div className="space-y-3">
            {demoCompanionConfig.activity.map(entry => (
              <div key={entry.time + entry.event} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-900 dark:text-dark-100">{entry.event}</p>
                  <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-0.5">{entry.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DidStudioModal
        leader={leader}
        companion={resolvedCompanion}
        greeting={studioGreeting}
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
      />
    </div>
  );
}
