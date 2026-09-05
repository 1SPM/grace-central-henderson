import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Crown, Settings2, UserX } from 'lucide-react';
import type { LeaderProfile, PastoralSession, Person, View } from '../../../types';
import type { LeaderOnboardingData } from '../LeaderOnboardingWizard';
import { LeaderManagement } from '../LeaderManagement';
import { LEADERS } from '../../../config/leadersConfig';
import { useLeadershipActivity } from '../../../hooks/useLeadershipActivity';
import { useWorkOsPermissions } from '../../../hooks/useWorkOsPermissions';
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
  const { data: activity } = useLeadershipActivity();
  const { personId: myPersonId, isMasterAdmin, isLoading: permsLoading } = useWorkOsPermissions();

  const roster = leaders.length > 0 ? leaders : LEADERS;
  const fallbackLeaderId =
    roster.find(l => l.hasAiCompanion !== false)?.id ?? roster[0]?.id ?? null;
  const myLeader = myPersonId ? roster.find(l => l.personId === myPersonId) ?? null : null;

  // "Accessible individually by way of assignment": a leader who isn't the
  // master admin (the pastor — see is_master_admin in api/workos/_permissions.ts)
  // only ever sees their own profile here, never the roster or Manage tab,
  // regardless of what the URL hash asks for.
  useEffect(() => {
    if (permsLoading || isMasterAdmin) return;
    setTab('team');
    setSelectedLeaderId(myLeader?.id ?? null);
  }, [permsLoading, isMasterAdmin, myLeader]);

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

  // Non-admin guards mirror the useEffect above for the click path — the
  // effect can lag a render behind a click, and a permission gate that
  // only ever self-heals asynchronously is not a real gate.
  const selectTab = (next: HubTab) => {
    if (!isMasterAdmin) return;
    setTab(next);
    setSelectedLeaderId(null);
    window.history.replaceState(null, '', leadershipHash('team', next));
  };

  const selectLeader = (id: string) => {
    if (!isMasterAdmin && id !== myLeader?.id) return;
    setSelectedLeaderId(id);
    setTab('team');
    window.history.replaceState(null, '', leadershipHash('team', 'team', id, parseLeadershipProfileTab()));
  };

  const clearLeader = () => {
    if (!isMasterAdmin) return; // no roster to return to — see the useEffect above
    setSelectedLeaderId(null);
    window.history.replaceState(null, '', leadershipHash('team', tab));
  };

  // Enforced here, not just at the setters above: selectedLeaderId can also
  // change via syncFromHash (a URL hash is attacker-controlled input) and
  // the initialLeaderId prop, neither of which route through selectLeader.
  // A non-admin's effective selection is always their own leader id,
  // regardless of what put selectedLeaderId into the wrong state.
  const effectiveLeaderId = isMasterAdmin ? selectedLeaderId : (myLeader?.id ?? null);
  const selectedLeader = effectiveLeaderId ? roster.find(l => l.id === effectiveLeaderId) : null;
  const badges = countLeadershipBadges(roster);

  const TABS: { id: HubTab; label: string; icon: typeof Crown }[] = isMasterAdmin
    ? [{ id: 'team', label: 'Team', icon: Crown }, { id: 'manage', label: 'Manage', icon: Settings2 }]
    : [{ id: 'team', label: 'Team', icon: Crown }];

  if (tab === 'manage' && isMasterAdmin) {
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
          {isMasterAdmin && (
            <button
              type="button"
              onClick={() => selectTab('manage')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add leader
            </button>
          )}
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Leadership team</h2>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
              {isMasterAdmin
                ? `${badges.staff} staff · ${badges.aiDeployed} AI companions · ${badges.humanOnly} human-only`
                : 'Your leadership profile'}
            </p>
          </div>
          {isMasterAdmin && (
            <button
              type="button"
              onClick={() => selectTab('manage')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-lg transition-colors"
            >
              + Add leader
            </button>
          )}
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
            onBack={clearLeader}
            onNavigate={onNavigate}
          />
        ) : isMasterAdmin ? (
          <LeadersRoster leaders={roster} activity={activity} onSelectLeader={selectLeader} />
        ) : !permsLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <UserX size={28} className="text-gray-300 dark:text-dark-600" />
            <p className="text-sm font-medium text-gray-600 dark:text-dark-300">
              You don't have a public leader profile yet
            </p>
            <p className="text-xs text-gray-400 dark:text-dark-500 max-w-xs">
              Ask your Senior Pastor to link your staff account to a Verified Leader profile.
            </p>
          </div>
        ) : null)}
    </div>
  );
}

/** Standalone leaders page (legacy route — prefer LeadershipPage). */
export function LeadersHub(props: LeadersHubContentProps) {
  return <LeadersHubContent {...props} />;
}
