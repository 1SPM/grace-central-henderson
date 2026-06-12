import { useState } from 'react';
import {
  BarChart3,
  Bot,
  ChevronLeft,
  HeartHandshake,
  Inbox,
  Settings2,
  Users,
} from 'lucide-react';
import type { LeaderProfile, PastoralSession } from '../../../types';
import type { LeaderOnboardingData } from '../LeaderOnboardingWizard';
import { LeaderManagement } from '../LeaderManagement';
import { DEMO_LEADERS } from '../../member/demoLeaders';
import { LeadersRoster } from './LeadersRoster';
import { LeaderProfileView } from './LeaderProfileView';
import { CareDispatch } from './CareDispatch';
import { LeaderInbox } from './LeaderInbox';
import { AICompanionConfig } from './AICompanionConfig';
import { LeaderAnalytics } from './LeaderAnalytics';
import { demoInbox } from './demoLeadersHub';

type HubTab = 'roster' | 'dispatch' | 'inbox' | 'companion' | 'analytics' | 'manage';

interface LeadersHubProps {
  leaders: LeaderProfile[];
  sessions: PastoralSession[];
  onAddLeader?: (data: LeaderOnboardingData) => void;
  onToggleLeaderAvailability?: (leaderId: string) => void;
  onDeleteLeader?: (leaderId: string) => void;
  onBack?: () => void;
  churchName?: string;
}

export function LeadersHub({
  leaders,
  sessions,
  onAddLeader,
  onToggleLeaderAvailability,
  onDeleteLeader,
  onBack,
  churchName,
}: LeadersHubProps) {
  const [tab, setTab] = useState<HubTab>('roster');
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);

  const roster = leaders.length > 0 ? leaders : DEMO_LEADERS;
  const selectedLeader = selectedLeaderId ? roster.find(l => l.id === selectedLeaderId) : null;
  const inboxAttention = demoInbox.filter(m => m.state !== 'ai-replied').length;

  const TABS: { id: HubTab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: 'roster', label: 'Roster', icon: Users },
    { id: 'dispatch', label: 'Care dispatch', icon: HeartHandshake },
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: inboxAttention },
    { id: 'companion', label: 'AI companion', icon: Bot },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'manage', label: 'Manage & applications', icon: Settings2 },
  ];

  // The Manage tab reuses the full existing management surface
  // (onboarding wizard, applications pipeline, stats).
  if (tab === 'manage') {
    return (
      <LeaderManagement
        leaders={leaders}
        sessions={sessions}
        onAddLeader={onAddLeader}
        onToggleLeaderAvailability={onToggleLeaderAvailability}
        onDeleteLeader={onDeleteLeader}
        onBack={() => setTab('roster')}
        churchName={churchName}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
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
          <h1 className="serif text-3xl text-slate-900 dark:text-dark-100 leading-none">Leaders</h1>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1.5">
            Your verified care team — live presence, AI companions, and dispatch
          </p>
        </div>
        <button
          onClick={() => setTab('manage')}
          className="px-3 py-2 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add leader
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-dark-700 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setSelectedLeaderId(null);
            }}
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

      {tab === 'roster' &&
        (selectedLeader ? (
          <LeaderProfileView leader={selectedLeader} onBack={() => setSelectedLeaderId(null)} />
        ) : (
          <LeadersRoster leaders={roster} onSelectLeader={setSelectedLeaderId} />
        ))}
      {tab === 'dispatch' && <CareDispatch sessions={sessions} leaders={roster} />}
      {tab === 'inbox' && <LeaderInbox />}
      {tab === 'companion' && <AICompanionConfig />}
      {tab === 'analytics' && <LeaderAnalytics leaders={roster} />}
    </div>
  );
}
