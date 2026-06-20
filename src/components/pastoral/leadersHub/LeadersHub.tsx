import { useCallback, useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, Crown, Settings2, Users } from 'lucide-react';
import type { LeaderProfile, PastoralSession, Person, View } from '../../../types';
import type { LeaderOnboardingData } from '../LeaderOnboardingWizard';
import { LeaderManagement } from '../LeaderManagement';
import { CENTRAL_HENDERSON_LEADERS } from '../../../config/centralHendersonLeaders';
import { useLeadershipActivity } from '../../../hooks/useLeadershipActivity';
import {
  leadershipHash,
  parseLeadershipLeaderId,
  parseLeadershipProfileTab,
  parseLeadershipWorkspaceTab,
  resolveLegacyLeadershipHash,
  type LeadershipWorkspaceTab,
} from '../../../lib/leadershipNav';
import { countLeadershipBadges } from '../../../hooks/useLeadershipRoster';
import { LeadersRoster } from './LeadersRoster';
import { LeaderProfileView } from './LeaderProfileView';
import { LeaderAnalytics } from './LeaderAnalytics';

export type HubTab = LeadershipWorkspaceTab;

export interface LeadersHubContentProps {
  leaders: LeaderProfile[];
  people?: Person[];
  sessions: PastoralSession[];
  onAddLeader?: (data: LeaderOnboardingData) => void;
  onToggleLeaderAvailability?: (leaderId: string) => void;
  onDeleteLeader?: (leaderId: string) => void;
  onBack?: () => void;
  onNavigate?: (view: View | string) => void;
  churchName?: string;
  embedded?: boolean;
  initialTab?: HubTab;
  initialLeaderId?: string | null;
}

export function LeadersHubContent({
  leaders,
  people = [],
  sessions,
  onAddLeader,
  onToggleLeaderAvailability,
  onDeleteLeader,
  onBack,
  onNavigate,
  churchName,
  embedded = false,
  initialTab = 'team',
  initialLeaderId = null,
}: LeadersHubContentProps) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(initialLeaderId);
  const { data: activity, isLive } = useLeadershipActivity();

  const roster = leaders.length > 0 ? leaders : CENTRAL_HENDERSON_LEADERS;
  const fallbackLeaderId =
    roster.find(l => l.hasAiCompanion !== false)?.id ?? roster[0]?.id ?? null;

  useEffect(() => {
    resolveLegacyLeadershipHash(fallbackLeaderId, onNavigate);
  }, [fallbackLeaderId, onNavigate]);

  useEffect(() => {
    if (initialLeaderId) {
      setSelectedLeaderId(initialLeaderId);
      setTab('team');
    }
  }, [initialLeaderId]);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const syncFromHash = useCallback(() => {
    setTab(parseLeadershipWorkspaceTab());
    setSelectedLeaderId(parseLeadershipLeaderId());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [syncFromHash]);

  const selectTab = (next: HubTab) => {
    setTab(next);
    setSelectedLeaderId(null);
    window.history.replaceState(null, '', leadershipHash('team', next));
  };

  const selectLeader = (id: string) => {
    setSelectedLeaderId(id);
    setTab('team');
    window.history.replaceState(null, '', leadershipHash('team', 'team', id, parseLeadershipProfileTab()));
  };

  const clearLeader = () => {
    setSelectedLeaderId(null);
    window.history.replaceState(null, '', leadershipHash('team', tab));
  };

  const selectedLeader = selectedLeaderId ? roster.find(l => l.id === selectedLeaderId) : null;
  const badges = countLeadershipBadges(roster);

  const TABS: { id: HubTab; label: string; icon: typeof Users }[] = [
    { id: 'team', label: 'Team', icon: Crown },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'manage', label: 'Manage', icon: Settings2 },
  ];

  if (tab === 'manage') {
    return (
      <LeaderManagement
        leaders={leaders}
        sessions={sessions}
        onAddLeader={onAddLeader}
        onToggleLeaderAvailability={onToggleLeaderAvailability}
        onDeleteLeader={onDeleteLeader}
        onBack={() => selectTab('team')}
        churchName={churchName}
      />
    );
  }

  const wrapperClass = embedded ? 'p-4 sm:p-6 max-w-7xl mx-auto' : 'p-6 max-w-7xl mx-auto';

  return (
    <div className={wrapperClass}>
      {!embedded && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200 mb-2 transition-colors"
              >
                <ChevronLeft size={15} /> Pastoral care
              </button>
            )}
            <h1 className="serif text-3xl text-slate-900 dark:text-dark-100 leading-none">Leadership</h1>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1.5">
              Pastors, clergy, and AI companion deployments
            </p>
          </div>
          <button
            type="button"
            onClick={() => selectTab('manage')}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Add leader
          </button>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Leadership team</h2>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
              {badges.staff} staff · {badges.aiDeployed} AI companions · {badges.humanOnly} human-only
            </p>
          </div>
          <button
            type="button"
            onClick={() => selectTab('manage')}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add leader
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-dark-700 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
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

      {tab === 'team' &&
        (selectedLeader ? (
          <LeaderProfileView
            leader={selectedLeader}
            people={people}
            churchName={churchName}
            onBack={clearLeader}
            onNavigate={onNavigate}
          />
        ) : (
          <LeadersRoster leaders={roster} activity={activity} onSelectLeader={selectLeader} />
        ))}
      {tab === 'analytics' && <LeaderAnalytics leaders={roster} activity={activity} isLive={isLive} />}
    </div>
  );
}

/** Standalone leaders page (legacy route — prefer LeadershipPage). */
export function LeadersHub(props: LeadersHubContentProps) {
  return <LeadersHubContent {...props} />;
}
