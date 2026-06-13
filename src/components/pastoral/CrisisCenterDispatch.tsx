import { useState } from 'react';
import {
  ChevronLeft,
  Link2,
  Check,
  Radio,
} from 'lucide-react';
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Radio size={22} className="text-rose-600" />
              Crisis Center Dispatch
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              24-hour receiving line for member help requests — AI triage, crisis escalation, live handoff
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <CareDispatch
        conversations={conversations}
        leaders={leaders}
        onOpenConversation={onSetActiveConversation}
      />
    </div>
  );
}
