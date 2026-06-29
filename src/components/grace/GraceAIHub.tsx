import { useEffect, useMemo, useState } from 'react';
import { Bot, HelpCircle } from 'lucide-react';
import { churchShortName } from '../../config/centralHenderson';
import { getDefaultChurchName } from '../../config/tenant';
import { LeadersHubContent } from '../pastoral/leadersHub/LeadersHub';
import { GraceAIFaq } from './GraceAIFaq';
import type { LeaderProfile, PastoralSession } from '../../types';
import type { LeaderOnboardingData } from '../pastoral/LeaderOnboardingWizard';

type HubTab = 'clergy' | 'faq';

function parseGraceHubParams(): { tab: HubTab; leaderId: string | null } {
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  const params = qIndex >= 0
    ? new URLSearchParams(hash.slice(qIndex + 1))
    : new URLSearchParams(window.location.search);

  const tabParam = params.get('tab');
  const tab: HubTab = tabParam === 'faq' ? 'faq' : 'clergy';
  return { tab, leaderId: params.get('leader') };
}

interface GraceAIHubProps {
  churchName?: string;
  leaders: LeaderProfile[];
  sessions: PastoralSession[];
  defaultTab?: HubTab;
  onAddLeader?: (data: LeaderOnboardingData) => void;
  onToggleLeaderAvailability?: (leaderId: string) => void;
  onDeleteLeader?: (leaderId: string) => void;
}

export function GraceAIHub({
  churchName = getDefaultChurchName(),
  leaders,
  sessions,
  defaultTab,
  onAddLeader,
  onToggleLeaderAvailability,
  onDeleteLeader,
}: GraceAIHubProps) {
  const initial = useMemo(() => parseGraceHubParams(), []);
  const [tab, setTab] = useState<HubTab>(defaultTab ?? initial.tab);
  const shortName = churchShortName(churchName);

  useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  const TABS: { id: HubTab; label: string; icon: typeof Bot }[] = [
    { id: 'clergy', label: 'AI Clergy', icon: Bot },
    { id: 'faq', label: 'Help & FAQ', icon: HelpCircle },
  ];

  return (
    <div className="h-[calc(100vh-32px)] flex flex-col bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 overflow-hidden">
      {/* Header + tabs */}
      <div className="shrink-0 border-b border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h1 className="serif text-2xl sm:text-3xl text-slate-900 dark:text-dark-100 leading-none">AI Clergy</h1>
              <p className="text-[11px] font-medium text-sky-700 dark:text-sky-300 mt-1.5">
                Growth · Resource · Assistance · Community · Engagement
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                AI management center for {shortName} — clergy companions and member help.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
              <span className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                {leaders.filter(l => l.isActive).length} verified leaders
              </span>
              <span className="px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">
                {leaders.filter(l => l.isActive).length} AI companions
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tab === id
                    ? 'border-slate-900 dark:border-dark-100 text-slate-900 dark:text-dark-100 font-medium'
                    : 'border-transparent text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'clergy' && (
          <div className="h-full overflow-y-auto">
            <LeadersHubContent
              embedded
              leaders={leaders}
              sessions={sessions}
              initialLeaderId={initial.leaderId}
              onAddLeader={onAddLeader}
              onToggleLeaderAvailability={onToggleLeaderAvailability}
              onDeleteLeader={onDeleteLeader}
              churchName={churchName}
            />
          </div>
        )}

        {tab === 'faq' && (
          <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-3xl mx-auto">
              <GraceAIFaq audience="admin" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
