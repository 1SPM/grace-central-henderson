import { useCallback, useEffect, useMemo, useState } from 'react';
import { HelpCircle, Crown } from 'lucide-react';
import { churchShortName } from '../../config/tenant';
import { HubPageHeader } from '../ui/HubPageHeader';
import { getViewHeaderMeta } from '../../lib/viewHeaderMeta';
import { LeadersHubContent } from '../pastoral/leadersHub/LeadersHub';
import { GraceAIFaq } from '../grace/GraceAIFaq';
import { useLeadershipRoster } from '../../hooks/useLeadershipRoster';
import {
  leadershipHash,
  parseLeadershipHubTab,
  parseLeadershipLeaderId,
  parseLeadershipWorkspaceTab,
  type LeadershipHubTab,
  type LeadershipWorkspaceTab,
} from '../../lib/leadershipNav';
import type { LeaderProfile, PastoralSession, Person } from '../../types';
import type { LeaderOnboardingData } from '../pastoral/LeaderOnboardingWizard';

interface LeadershipPageProps {
  churchName?: string;
  people: Person[];
  leaders: LeaderProfile[];
  sessions: PastoralSession[];
  defaultWorkspaceTab?: LeadershipWorkspaceTab;
  defaultHubTab?: LeadershipHubTab;
  onAddLeader?: (data: LeaderOnboardingData) => void;
  onToggleLeaderAvailability?: (leaderId: string) => void;
  onDeleteLeader?: (leaderId: string) => void;
  onNavigate?: (view: string) => void;
}

export function LeadershipPage({
  churchName = 'Central Henderson Church',
  people,
  leaders,
  sessions,
  defaultWorkspaceTab,
  defaultHubTab,
  onAddLeader,
  onToggleLeaderAvailability,
  onDeleteLeader,
  onNavigate,
}: LeadershipPageProps) {
  const initialHub = useMemo(() => defaultHubTab ?? parseLeadershipHubTab(), [defaultHubTab]);
  const initialWorkspace = useMemo(
    () => defaultWorkspaceTab ?? parseLeadershipWorkspaceTab(),
    [defaultWorkspaceTab],
  );
  const initialLeaderId = useMemo(() => parseLeadershipLeaderId(), []);

  const [hubTab, setHubTab] = useState<LeadershipHubTab>(initialHub);
  const shortName = churchShortName(churchName);
  const roster = useLeadershipRoster(leaders, people);

  useEffect(() => {
    if (defaultHubTab) setHubTab(defaultHubTab);
  }, [defaultHubTab]);

  useEffect(() => {
    if (defaultWorkspaceTab === 'manage' || defaultWorkspaceTab === 'team') {
      window.history.replaceState(null, '', leadershipHash('team', defaultWorkspaceTab));
    }
  }, [defaultWorkspaceTab]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const base = hash.split('?')[0].split('/')[0];
    if (base === 'grace' || base === 'leader-management') {
      window.history.replaceState(
        null,
        '',
        leadershipHash('team', parseLeadershipWorkspaceTab(), parseLeadershipLeaderId()),
      );
    }
  }, []);

  const syncFromHash = useCallback(() => {
    setHubTab(parseLeadershipHubTab());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, [syncFromHash]);

  const activeStaff = roster.filter(l => l.isActive);
  const humanCount = activeStaff.length;
  const aiDeployedCount = activeStaff.filter(l => l.hasAiCompanion !== false).length;

  const selectHubTab = (next: LeadershipHubTab) => {
    setHubTab(next);
    window.history.replaceState(null, '', leadershipHash(next));
  };

  const HUB_TABS: { id: LeadershipHubTab; label: string; icon: typeof Crown }[] = [
    { id: 'team', label: 'Team', icon: Crown },
    { id: 'faq', label: 'Help & FAQ', icon: HelpCircle },
  ];

  const headerMeta = getViewHeaderMeta('leadership');

  return (
    <div data-tutorial="leadership-hub" className="h-[calc(100vh-32px)] flex flex-col bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 overflow-hidden">
      <div className="shrink-0 border-b border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          <HubPageHeader
            icon={headerMeta.icon}
            title={headerMeta.title}
            subtitle={`Pastors, clergy, and AI companion deployments for ${shortName}`}
            iconBoxClassName={headerMeta.iconBoxClassName}
            iconClassName={headerMeta.iconClassName}
            size="sm"
            className="mb-3"
            trailing={
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
                <span className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                  {humanCount} staff
                </span>
                <span className="px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">
                  {aiDeployedCount} AI companions active
                </span>
              </div>
            }
          />

          <div className="flex items-center gap-1 overflow-x-auto">
            {HUB_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectHubTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  hubTab === id
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

      <div className="flex-1 min-h-0 overflow-hidden">
        {hubTab === 'team' && (
          <div className="h-full overflow-y-auto">
            <LeadersHubContent
              embedded
              leaders={roster}
              people={people}
              sessions={sessions}
              initialTab={initialWorkspace}
              initialLeaderId={initialLeaderId}
              onAddLeader={onAddLeader}
              onToggleLeaderAvailability={onToggleLeaderAvailability}
              onDeleteLeader={onDeleteLeader}
              onNavigate={onNavigate}
              churchName={churchName}
            />
          </div>
        )}

        {hubTab === 'faq' && (
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
