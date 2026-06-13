import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  ChevronLeft,
  Crown,
  Settings2,
  Users,
} from 'lucide-react';
import type { LeaderProfile, PastoralSession, View } from '../../../types';
import type { LeaderOnboardingData } from '../LeaderOnboardingWizard';
import { LeaderManagement } from '../LeaderManagement';
import { CENTRAL_HENDERSON_LEADERS } from '../../../config/centralHendersonLeaders';
import { useLeadershipActivity } from '../../../hooks/useLeadershipActivity';
import { leadershipHash, parseLeadershipWorkspaceTab, type LeadershipWorkspaceTab } from '../../../lib/leadershipNav';
import { countLeadershipBadges } from '../../../hooks/useLeadershipRoster';
import { LeadersRoster } from './LeadersRoster';
import { LeaderProfileView } from './LeaderProfileView';
import { LeadershipActivityFeed } from './LeadershipActivityFeed';
import { AICompanionConfig } from './AICompanionConfig';
import { LeaderAnalytics } from './LeaderAnalytics';

export type HubTab = LeadershipWorkspaceTab;

export interface LeadersHubContentProps {
  leaders: LeaderProfile[];
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
  const { data: activity, loading: activityLoading, isLive } = useLeadershipActivity();

  useEffect(() => {
    if (initialLeaderId) {
      setSelectedLeaderId(initialLeaderId);
      setTab('team');
    }
  }, [initialLeaderId]);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const syncTabFromHash = useCallback(() => {
    setTab(parseLeadershipWorkspaceTab());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, [syncTabFromHash]);

  const selectTab = (next: HubTab) => {
    setTab(next);
    setSelectedLeaderId(null);
    window.history.replaceState(null, '', leadershipHash('team', next));
  };

  const roster = leaders.length > 0 ? leaders : CENTRAL_HENDERSON_LEADERS;
  const selectedLeader = selectedLeaderId ? roster.find(l => l.id === selectedLeaderId) : null;
  const badges = countLeadershipBadges(roster);
  const unassignedCount = activity?.summary.unassigned ?? 0;

  const TABS: { id: HubTab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: 'team', label: 'Team', icon: Crown },
    { id: 'activity', label: 'Activity', icon: Activity, badge: unassignedCount || undefined },
    { id: 'companions', label: 'AI Companions', icon: Bot },
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
        {TABS.map(({ id, label, icon: Icon, badge }) => (
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
            {badge ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'team' &&
        (selectedLeader ? (
          <LeaderProfileView
            leader={selectedLeader}
            activity={activity}
            onBack={() => setSelectedLeaderId(null)}
            onNavigate={onNavigate}
          />
        ) : (
          <LeadersRoster
            leaders={roster}
            activity={activity}
            onSelectLeader={setSelectedLeaderId}
          />
        ))}
      {tab === 'activity' && (
        <LeadershipActivityFeed
          activity={activity}
          loading={activityLoading}
          isLive={isLive}
          onNavigate={onNavigate}
        />
      )}
      {tab === 'companions' && <AICompanionConfig leaders={roster} />}
      {tab === 'analytics' && <LeaderAnalytics leaders={roster} activity={activity} isLive={isLive} />}
    </div>
  );
}

/** Standalone leaders page (legacy route — prefer LeadershipPage). */
export function LeadersHub(props: LeadersHubContentProps) {
  return <LeadersHubContent {...props} />;
}
