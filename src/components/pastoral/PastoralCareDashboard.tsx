import { useState } from 'react';
import {
  MessageCircle,
  ChevronLeft,
  Plus,
  ArrowRight,
  Link2,
  Check,
  UserPlus,
  Radio,
} from 'lucide-react';
import type { LeaderProfile, HelpRequest, PastoralConversation, HelpCategory } from '../../types';
import { HelpIntakeForm } from './HelpIntakeForm';
import { LeaderProfileCard } from './LeaderProfileCard';
import { ChatWindow } from './ChatWindow';
import { LeaderRegistrationForm } from './LeaderRegistrationForm';
import type { LeaderFormData } from './LeaderRegistrationForm';
import { CareDispatch } from './leadersHub/CareDispatch';

type DashboardTab = 'dispatch' | 'conversations' | 'leaders' | 'new-request' | 'add-leader' | 'edit-leader';

interface PastoralCareDashboardProps {
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

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  'marriage': 'Marriage',
  'addiction': 'Recovery',
  'grief': 'Grief',
  'faith-questions': 'Faith',
  'crisis': 'Crisis',
  'financial': 'Financial',
  'anxiety-depression': 'Mental Health',
  'parenting': 'Parenting',
  'general': 'General',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  crisis: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  waiting: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  escalated: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  resolved: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-500/10 dark:text-gray-500',
};

const TAB_LABELS: Record<'dispatch' | 'conversations' | 'leaders', string> = {
  dispatch: 'Dispatch',
  conversations: 'Conversations',
  leaders: 'Leaders',
};

export function PastoralCareDashboard({
  leaders,
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
  onBack,
  churchName,
}: PastoralCareDashboardProps) {
  const [tab, setTab] = useState<DashboardTab>('dispatch');
  const [editingLeader, setEditingLeader] = useState<LeaderProfile | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // If there's an active conversation, show the chat
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

  // New request form (staff manual intake — secondary)
  if (tab === 'new-request') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <HelpIntakeForm
          onSubmit={onCreateHelpRequest}
          onBack={() => setTab('conversations')}
          churchName={churchName}
        />
      </div>
    );
  }

  // Add leader form
  if (tab === 'add-leader' && onAddLeader) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <LeaderRegistrationForm
          onSubmit={(data) => {
            onAddLeader(data);
            setTab('leaders');
          }}
          onBack={() => setTab('leaders')}
        />
      </div>
    );
  }

  // Edit leader form
  if (tab === 'edit-leader' && editingLeader && onUpdateLeader) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <LeaderRegistrationForm
          onSubmit={(data) => {
            onUpdateLeader(editingLeader.id, data);
            setEditingLeader(null);
            setTab('leaders');
          }}
          onBack={() => {
            setEditingLeader(null);
            setTab('leaders');
          }}
          initialData={{
            displayName: editingLeader.displayName,
            title: editingLeader.title,
            bio: editingLeader.bio,
            photo: editingLeader.photo,
            expertiseAreas: editingLeader.expertiseAreas,
            credentials: editingLeader.credentials,
            yearsOfPractice: editingLeader.yearsOfPractice,
            personalityTraits: editingLeader.personalityTraits,
            spiritualFocusAreas: editingLeader.spiritualFocusAreas,
            language: editingLeader.language,
            sessionType: editingLeader.sessionType || 'one-time',
            sessionFrequency: editingLeader.sessionFrequency || 'Weekly',
            suitableFor: editingLeader.suitableFor || [],
            anchors: editingLeader.anchors || '',
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-dark-800 p-1 rounded-xl w-fit">
        {(['dispatch', 'conversations', 'leaders'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? 'bg-stone-100 dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'dispatch' && (
        <CareDispatch
          conversations={conversations}
          leaders={leaders}
          onOpenConversation={onSetActiveConversation}
        />
      )}

      {tab === 'conversations' && (
        <div className="space-y-3">
          {conversations.length === 0 ? (
            <div className="text-center py-16 bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50">
              <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No member requests yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Member help requests from the portal appear here automatically. Staff can also log a request manually.
              </p>
              <button
                onClick={() => setTab('new-request')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Plus size={16} />
                Log request manually
              </button>
            </div>
          ) : (
            conversations.map(conv => {
              const leader = leaders.find(l => l.id === conv.leaderId);
              const lastMessage = conv.messages[conv.messages.length - 1];
              return (
                <button
                  key={conv.id}
                  onClick={() => onSetActiveConversation(conv.id)}
                  className="w-full bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                      conv.priority === 'crisis' ? 'bg-red-500 animate-pulse' :
                      conv.status === 'active' ? 'bg-emerald-500' :
                      conv.status === 'escalated' ? 'bg-amber-500' :
                      conv.status === 'resolved' ? 'bg-gray-400' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {conv.isAnonymous ? 'Anonymous' : 'Member'}
                        </span>
                        <span className="text-xs text-gray-400">—</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{CATEGORY_LABELS[conv.category]}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[conv.priority]}`}>
                          {conv.priority}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[conv.status]}`}>
                          {conv.status}
                        </span>
                      </div>
                      {lastMessage && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          <span className="font-medium">{lastMessage.senderName}:</span> {lastMessage.content}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                        {leader && <span>Assigned to {leader.displayName}</span>}
                        <span>{conv.messages.length} messages</span>
                        <span>{new Date(conv.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {tab === 'leaders' && (
        <div className="space-y-4">
          {onAddLeader && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {leaders.filter(l => l.isActive).length} active leader{leaders.filter(l => l.isActive).length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => setTab('add-leader')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
              >
                <UserPlus size={16} />
                Add Leader
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leaders.filter(l => l.isActive).map(leader => {
              const leaderConvs = conversations.filter(c => c.leaderId === leader.id && c.status === 'active').length;
              return (
                <LeaderProfileCard
                  key={leader.id}
                  leader={leader}
                  onStartChat={() => {
                    setTab('new-request');
                  }}
                  onEdit={onUpdateLeader ? (l) => {
                    setEditingLeader(l);
                    setTab('edit-leader');
                  } : undefined}
                  onDelete={onDeleteLeader}
                  onToggleAvailability={onToggleLeaderAvailability}
                  activeConversations={leaderConvs}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
