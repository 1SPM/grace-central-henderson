import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Church, Heart } from 'lucide-react';
import { CrisisCenterDispatch } from '../pastoral/CrisisCenterDispatch';
import { ListSkeleton } from '../ui/ViewSkeleton';
import { careHash, parseCareTab, type CareTab } from '../../lib/careNav';
import type { LeaderFormData } from '../pastoral/LeaderRegistrationForm';
import type {
  CalendarEvent,
  HelpCategory,
  HelpRequest,
  LeaderProfile,
  PastoralConversation,
  Person,
  View,
} from '../../types';

const LifeServices = lazy(() => import('../LifeServices').then(m => ({ default: m.LifeServices })));

interface CareHubProps {
  leaders: LeaderProfile[];
  helpRequests: HelpRequest[];
  conversations: PastoralConversation[];
  activeConversation?: PastoralConversation;
  activeLeader?: LeaderProfile;
  activeConversationId: string | null;
  onCreateHelpRequest: (request: { category: HelpCategory; description?: string; isAnonymous: boolean }) => void;
  onSendMessage: (conversationId: string, content: string) => void;
  onResolveConversation: (conversationId: string) => void;
  onEscalateConversation: (conversationId: string) => void;
  onSetActiveConversation: (id: string | null) => void;
  onAddLeader?: (data: LeaderFormData) => void;
  onUpdateLeader?: (leaderId: string, data: LeaderFormData) => void;
  onDeleteLeader?: (leaderId: string) => void;
  onToggleLeaderAvailability?: (leaderId: string) => void;
  churchName?: string;
  events: CalendarEvent[];
  people: Person[];
  onNavigate: (view: View) => void;
  defaultTab?: CareTab;
}

const TABS: { id: CareTab; label: string; icon: typeof Heart }[] = [
  { id: 'dispatch', label: 'Crisis Dispatch', icon: Heart },
  { id: 'life-services', label: 'Life Services', icon: Church },
];

export function CareHub({
  leaders,
  helpRequests,
  conversations,
  activeConversation,
  activeLeader,
  activeConversationId,
  onCreateHelpRequest,
  onSendMessage,
  onResolveConversation,
  onEscalateConversation,
  onSetActiveConversation,
  onAddLeader,
  onUpdateLeader,
  onDeleteLeader,
  onToggleLeaderAvailability,
  churchName,
  events,
  people,
  onNavigate,
  defaultTab,
}: CareHubProps) {
  const initial = useMemo(() => defaultTab ?? parseCareTab(), [defaultTab]);
  const [tab, setTab] = useState<CareTab>(initial);
  const openRequests = useMemo(
    () => conversations.filter(c => c.status !== 'resolved').length,
    [conversations],
  );

  useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (defaultTab && defaultTab !== 'dispatch') {
      window.history.replaceState(null, '', careHash(defaultTab));
    }
  }, [defaultTab]);

  const syncTabFromHash = useCallback(() => {
    setTab(parseCareTab());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncTabFromHash);
    window.addEventListener('popstate', syncTabFromHash);
    return () => {
      window.removeEventListener('hashchange', syncTabFromHash);
      window.removeEventListener('popstate', syncTabFromHash);
    };
  }, [syncTabFromHash]);

  const selectTab = (next: CareTab) => {
    setTab(next);
    window.history.replaceState(null, '', careHash(next));
  };

  const inConversation = tab === 'dispatch' && !!activeConversationId && !!activeConversation;

  return (
    <div data-tutorial="pastoral-care-hub" className="flex flex-col min-h-full bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900">
      {!inConversation && (
        <div className="shrink-0 border-b border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 pt-4 pb-0">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center">
                <Heart className="text-white" size={20} />
              </div>
              <div>
                <h1 className="serif text-2xl sm:text-3xl text-slate-900 dark:text-dark-100 leading-none">
                  Pastoral Care
                </h1>
                <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                  Crisis dispatch, member care handoffs, and life-event services — weddings, funerals & legacy planning.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
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
                  {id === 'dispatch' && openRequests > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                      {openRequests}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'dispatch' && (
          <CrisisCenterDispatch
            embedded
            leaders={leaders}
            helpRequests={helpRequests}
            conversations={conversations}
            activeConversation={activeConversation}
            activeLeader={activeLeader}
            activeConversationId={activeConversationId}
            onCreateHelpRequest={onCreateHelpRequest}
            onSendMessage={onSendMessage}
            onResolveConversation={onResolveConversation}
            onEscalateConversation={onEscalateConversation}
            onSetActiveConversation={onSetActiveConversation}
            onAddLeader={onAddLeader}
            onUpdateLeader={onUpdateLeader}
            onDeleteLeader={onDeleteLeader}
            onToggleLeaderAvailability={onToggleLeaderAvailability}
            churchName={churchName}
          />
        )}
        {tab === 'life-services' && (
          <Suspense fallback={<ListSkeleton />}>
            <LifeServices embedded onNavigate={onNavigate} events={events} people={people} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
