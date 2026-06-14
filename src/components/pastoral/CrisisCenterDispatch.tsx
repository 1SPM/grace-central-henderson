import { useState } from 'react';
import {
  ChevronLeft,
  Link2,
  Check,
} from 'lucide-react';
import { HubPageHeader } from '../ui/HubPageHeader';
import { getViewHeaderMeta } from '../../lib/viewHeaderMeta';
import type { LeaderProfile, HelpRequest, PastoralConversation, HelpCategory } from '../../types';
import { ChatWindow } from './ChatWindow';
import type { LeaderFormData } from './LeaderRegistrationForm';
import { CareDispatch } from './leadersHub/CareDispatch';

interface CrisisCenterDispatchProps {
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
  onBack?: () => void;
  churchName?: string;
}

export function CrisisCenterDispatch({
  leaders,
  conversations,
  activeConversation,
  activeLeader,
  activeConversationId,
  onSendMessage,
  onResolveConversation,
  onEscalateConversation,
  onSetActiveConversation,
  onBack,
}: CrisisCenterDispatchProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  if (activeConversationId && activeConversation) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ChatWindow
          conversation={activeConversation}
          leader={activeLeader}
          onSendMessage={onSendMessage}
          onBack={() => onSetActiveConversation(null)}
          onResolve={onResolveConversation}
          onEscalate={onEscalateConversation}
          isLeaderView
        />
      </div>
    );
  }

  const headerMeta = getViewHeaderMeta('pastoral-care');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <HubPageHeader
        icon={headerMeta.icon}
        title={headerMeta.title}
        subtitle="24-hour receiving line for member help requests — AI triage, crisis escalation, live handoff"
        iconBoxClassName={headerMeta.iconBoxClassName}
        iconClassName={headerMeta.iconClassName}
        leading={
          onBack ? (
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
          ) : undefined
        }
        trailing={
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?portal=pastor-signup`;
              navigator.clipboard.writeText(url).then(() => {
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              });
            }}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl transition-colors border ${
              linkCopied
                ? 'border-emerald-300 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
            }`}
            title="Copy pastor signup link to share"
          >
            {linkCopied ? <Check size={16} /> : <Link2 size={16} />}
            {linkCopied ? 'Copied!' : 'Signup Link'}
          </button>
        }
      />

      <CareDispatch
        conversations={conversations}
        leaders={leaders}
        onOpenConversation={onSetActiveConversation}
      />
    </div>
  );
}
