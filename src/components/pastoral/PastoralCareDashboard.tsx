import { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Users,
  ChevronLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  ArrowRight,
  BarChart3,
  Shield,
  Link2,
  Check,
  UserPlus,
} from 'lucide-react';
import type { LeaderProfile, HelpRequest, PastoralConversation, HelpCategory } from '../../types';
import { HelpIntakeForm } from './HelpIntakeForm';
import { LeaderProfileCard } from './LeaderProfileCard';
import { ChatWindow } from './ChatWindow';
import { LeaderRegistrationForm } from './LeaderRegistrationForm';
import type { LeaderFormData } from './LeaderRegistrationForm';

type DashboardTab = 'overview' | 'conversations' | 'leaders' | 'new-request' | 'add-leader' | 'edit-leader';

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

export function PastoralCareDashboard({
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
  onBack,
  churchName,
}: PastoralCareDashboardProps) {
  const [tab, setTab] = useState<DashboardTab>('overview');
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

  // New request form
  if (tab === 'new-request') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <HelpIntakeForm
          onSubmit={onCreateHelpRequest}
          onBack={() => setTab('overview')}
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

  // Stats
  const activeCount = conversations.filter(c => c.status === 'active').length;
  const pendingRequests = helpRequests.filter(r => r.status === 'pending').length;
  const waitingCount = pendingRequests + conversations.filter(c => c.status === 'waiting' || c.status === 'escalated').length;
  const crisisCount = conversations.filter(c => c.priority === 'crisis' && c.status !== 'resolved').length;
  const resolvedCount = conversations.filter(c => c.status === 'resolved').length;
  const availableLeaders = leaders.filter(l => l.isAvailable && l.isActive).length;

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
              <Heart size={22} className="text-violet-600" />
              Pastoral Care
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI-assisted pastoral support — 24/7 confidential care
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
          <button
            onClick={() => setTab('new-request')}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            <Plus size={16} />
            New Help Request
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-dark-800 p-1 rounded-xl w-fit">
        {(['overview', 'conversations', 'leaders'] as DashboardTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
              tab === t
                ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard icon={MessageCircle} label="Active" value={activeCount} color="text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" />
            <StatCard icon={Clock} label="Waiting" value={waitingCount} color="text-amber-500 bg-amber-50 dark:bg-amber-500/10" />
            <StatCard icon={AlertTriangle} label="Crisis" value={crisisCount} color="text-red-500 bg-red-50 dark:bg-red-500/10" />
            <StatCard icon={CheckCircle} label="Resolved" value={resolvedCount} color="text-gray-500 bg-gray-50 dark:bg-gray-500/10" />
            <StatCard icon={Users} label="Leaders Online" value={availableLeaders} color="text-violet-500 bg-violet-50 dark:bg-violet-500/10" />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Conversations */}
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Conversations</h2>
                <button
                  onClick={() => setTab('conversations')}
                  className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight size={12} />
                </button>
              </div>
              {conversations.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No conversations yet</p>
                  <button
                    onClick={() => setTab('new-request')}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline mt-1"
                  >
                    Create a help request
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.slice(0, 5).map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => onSetActiveConversation(conv.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-left"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        conv.priority === 'crisis' ? 'bg-red-500 animate-pulse' :
                        conv.status === 'active' ? 'bg-emerald-500' :
                        conv.status === 'escalated' ? 'bg-amber-500' :
                        'bg-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {conv.isAnonymous ? 'Anonymous' : 'Member'}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[conv.priority]}`}>
                            {conv.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {CATEGORY_LABELS[conv.category]} — {conv.messages.length} messages
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[conv.status]}`}>
                        {conv.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Available Leaders */}
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Leader Status</h2>
                <button
                  onClick={() => setTab('leaders')}
                  className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                {leaders.filter(l => l.isActive).map(leader => (
                  <div key={leader.id} className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                        {leader.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-dark-800 ${
                        leader.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{leader.displayName}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{leader.title}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      leader.isAvailable
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-500/10 text-gray-500 dark:text-gray-400'
                    }`}>
                      {leader.isAvailable ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Stats</h2>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                const count = conversations.filter(c => c.category === cat).length;
                return (
                  <div key={cat} className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{count}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'conversations' && (
        <div className="space-y-3">
          {conversations.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50">
              <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No conversations yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Start by creating a help request to begin a pastoral care conversation.
              </p>
              <button
                onClick={() => setTab('new-request')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Plus size={16} />
                New Help Request
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
                  className="w-full bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4 hover:shadow-md transition-all text-left"
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
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
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

// Small stat card helper
function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof MessageCircle;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        <Icon size={16} />
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
