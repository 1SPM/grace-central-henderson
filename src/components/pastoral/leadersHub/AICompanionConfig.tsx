import { useState } from 'react';
import { Activity, BookOpen, Brain, Mic, Radio, ShieldAlert, Zap } from 'lucide-react';
import { demoCompanionConfig } from './demoLeadersHub';

type ConfigTab = 'brain' | 'triggers' | 'channels' | 'activity';

const TABS: { id: ConfigTab; label: string; icon: typeof Brain }[] = [
  { id: 'brain', label: 'Brain', icon: Brain },
  { id: 'triggers', label: 'Triggers', icon: Zap },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'activity', label: 'Activity', icon: Activity },
];

export function AICompanionConfig() {
  const [tab, setTab] = useState<ConfigTab>('brain');
  const [triggers, setTriggers] = useState(demoCompanionConfig.triggers);
  const [channels, setChannels] = useState(demoCompanionConfig.channels);

  return (
    <div className="space-y-4">
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">AI companion configuration</h2>
        <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
          Each verified leader has a digital twin. Configure its persona, escalation triggers, channels, and review
          its session activity.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-2 flex items-center gap-1.5">
              <Brain size={14} className="text-violet-500" /> Persona
            </h3>
            <p className="text-xs text-gray-600 dark:text-dark-300 leading-relaxed">{demoCompanionConfig.brain.persona}</p>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-850 rounded-lg flex items-center gap-2.5">
              <Mic size={14} className="text-gray-400 flex-shrink-0" />
              <p className="text-[11px] text-gray-500 dark:text-dark-400">{demoCompanionConfig.brain.voiceModel}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3 flex items-center gap-1.5">
                <BookOpen size={14} className="text-blue-500" /> Knowledge base
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {demoCompanionConfig.brain.knowledgeBase.map(kb => (
                  <span key={kb} className="text-[11px] px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                    {kb}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3 flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-rose-500" /> Boundaries
              </h3>
              <ul className="space-y-1.5">
                {demoCompanionConfig.brain.boundaries.map(b => (
                  <li key={b} className="text-xs text-gray-600 dark:text-dark-300 flex gap-2">
                    <span className="text-rose-400 flex-shrink-0">•</span> {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
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
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">Session log</h3>
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
    </div>
  );
}
