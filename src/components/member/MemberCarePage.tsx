import { useState, useEffect } from 'react';
import {
  Heart,
  Shield,
  MessageCircle,
  ChevronRight,
  Clock,
  Star,
  Globe,
  Calendar,
  ArrowRight,
  ChevronLeft,
  UserPlus,
} from 'lucide-react';
import type { LeaderProfile, HelpRequest, HelpCategory, MemberPortalTab, PastoralConversation } from '../../types';
import { VerifiedBadge } from '../pastoral/VerifiedBadge';
import { HelpIntakeForm } from '../pastoral/HelpIntakeForm';
import { ChatWindow } from '../pastoral/ChatWindow';
import { DEMO_LEADERS } from './demoLeaders';

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  'marriage': 'Marriage', 'addiction': 'Recovery', 'grief': 'Grief',
  'faith-questions': 'Faith', 'crisis': 'Crisis', 'financial': 'Financial',
  'anxiety-depression': 'Mental Health', 'parenting': 'Parenting', 'general': 'General',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  crisis: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

type CareView = 'home' | 'leaders' | 'request' | 'my-requests' | 'chat';

interface MemberCarePageProps {
  leaders?: LeaderProfile[];
  helpRequests?: HelpRequest[];
  onCreateHelpRequest?: (request: { category: HelpCategory; description?: string; isAnonymous: boolean; leaderId?: string }) => void;
  onNavigate?: (tab: MemberPortalTab) => void;
  churchName?: string;
  conversations?: PastoralConversation[];
  activeConversation?: PastoralConversation;
  onSendMessage?: (conversationId: string, content: string) => void;
  showChat?: boolean;
  onCloseChat?: () => void;
}

export function MemberCarePage({
  leaders = DEMO_LEADERS,
  helpRequests = [],
  onCreateHelpRequest,
  onNavigate,
  churchName = 'Grace Church',
  conversations = [],
  activeConversation,
  onSendMessage,
  showChat = false,
  onCloseChat,
}: MemberCarePageProps) {
  const [view, setView] = useState<CareView>('home');
  const [submitted, setSubmitted] = useState(false);

  // When showChat is triggered (e.g. from tapping a pastor story), switch to chat view
  useEffect(() => {
    if (showChat && activeConversation) {
      setView('chat');
    }
  }, [showChat, activeConversation]);

  const activeLeaders = leaders.filter(l => l.isActive);
  const availableLeaders = activeLeaders.filter(l => l.isAvailable);
  const myRequests = helpRequests.filter(r => r.status !== 'resolved');
  const activeConversations = conversations.filter(c => c.status === 'active');

  if (view === 'request') {
    if (submitted) {
      return (
        <div className="p-4 max-w-lg mx-auto text-center">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-8">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100 mb-2">
              Request Submitted
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-400 mb-6">
              A pastoral care leader will be connected with you soon. All conversations are confidential and private.
            </p>
            <button
              onClick={() => { setView('home'); setSubmitted(false); }}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Back to Care
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4">
        <HelpIntakeForm
          onSubmit={(req) => {
            onCreateHelpRequest?.(req);
            setSubmitted(true);
          }}
          onBack={() => setView('home')}
          churchName={churchName}
        />
      </div>
    );
  }

  if (view === 'chat') {
    // Find the conversation to display — prefer activeConversation, fall back to most recent
    const chatConversation = activeConversation || conversations.filter(c => c.status === 'active').slice(-1)[0];
    if (chatConversation && onSendMessage) {
      const chatLeader = leaders.find(l => l.id === chatConversation.leaderId);
      return (
        <div className="h-full">
          <ChatWindow
            conversation={chatConversation}
            leader={chatLeader}
            onSendMessage={onSendMessage}
            onBack={() => { setView('home'); onCloseChat?.(); }}
          />
        </div>
      );
    }
    // No conversation available — fall through to home view below
  }

  if (view === 'leaders') {
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <button
          onClick={() => setView('home')}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-dark-100">Our Care Leaders</h2>
          <p className="text-sm text-gray-500 dark:text-dark-400">
            Trained pastoral leaders ready to walk alongside you
          </p>
        </div>

        <div className="space-y-3">
          {activeLeaders.map(leader => (
            <LeaderCard key={leader.id} leader={leader} onGetHelp={() => setView('request')} />
          ))}
          {activeLeaders.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-dark-400">
              <Heart size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No leaders available at this time</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'my-requests') {
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <button
          onClick={() => setView('home')}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-dark-100">My Requests</h2>
          <p className="text-sm text-gray-500 dark:text-dark-400">
            Track the status of your pastoral care requests
          </p>
        </div>

        {myRequests.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
            <MessageCircle size={40} className="mx-auto mb-3 text-gray-300 dark:text-dark-600" />
            <p className="text-sm text-gray-500 dark:text-dark-400">No active requests</p>
            <button
              onClick={() => setView('request')}
              className="mt-3 text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline"
            >
              Submit a new request
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {myRequests.map(req => (
              <div key={req.id} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      {CATEGORY_LABELS[req.category]} Request
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
                      Submitted {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                    {req.description && (
                      <p className="text-xs text-gray-600 dark:text-dark-300 mt-2">{req.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_COLORS[req.priority]}`}>
                      {req.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      req.status === 'pending'
                        ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : req.status === 'active'
                        ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main care home view
  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={20} className="text-violet-200" />
            <span className="text-violet-200 text-sm font-medium">Pastoral Care</span>
          </div>
          <h1 className="text-xl font-bold mb-1">You're Not Alone</h1>
          <p className="text-violet-100 text-sm mb-4">
            {churchName}'s pastoral care team is here for you — confidential, compassionate support whenever you need it.
          </p>
          <button
            onClick={() => setView('request')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-violet-700 font-semibold text-sm rounded-xl hover:bg-violet-50 transition-colors"
          >
            Get Help Now
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView('request')}
          className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 text-left hover:shadow-md transition-shadow active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center mb-3">
            <MessageCircle size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm">Request Help</h3>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">Start a confidential conversation</p>
        </button>
        <button
          onClick={() => setView('leaders')}
          className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 text-left hover:shadow-md transition-shadow active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-3">
            <Shield size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm">Our Leaders</h3>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">Browse care team profiles</p>
        </button>
      </div>

      {/* Active Conversations */}
      {activeConversations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
              My Conversations
            </h2>
          </div>
          <div className="space-y-2">
            {activeConversations.slice(0, 3).map(conv => {
              const convLeader = leaders.find(l => l.id === conv.leaderId);
              const lastMessage = conv.messages[conv.messages.length - 1];
              return (
                <button
                  key={conv.id}
                  onClick={() => onSendMessage && setView('chat')}
                  className="w-full bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 flex items-center gap-3 text-left hover:shadow-md transition-shadow"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {convLeader?.displayName.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AI'}
                    </div>
                    {convLeader?.isAvailable && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-dark-800 bg-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                      {convLeader?.displayName || 'Care Conversation'}
                    </p>
                    {lastMessage && (
                      <p className="text-xs text-gray-500 dark:text-dark-400 truncate">{lastMessage.content}</p>
                    )}
                  </div>
                  <MessageCircle size={16} className="text-violet-500 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* My Requests (if any) */}
      {myRequests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
              My Active Requests
            </h2>
            <button
              onClick={() => setView('my-requests')}
              className="text-xs text-violet-600 dark:text-violet-400 font-medium flex items-center gap-1"
            >
              View All
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {myRequests.slice(0, 2).map(req => (
              <div key={req.id} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{CATEGORY_LABELS[req.category]}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400">{req.status} — {new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 dark:text-dark-600" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Leaders Preview */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
            Available Leaders
          </h2>
          <button
            onClick={() => setView('leaders')}
            className="text-xs text-violet-600 dark:text-violet-400 font-medium flex items-center gap-1"
          >
            View All
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="space-y-2">
          {availableLeaders.slice(0, 3).map(leader => (
            <div key={leader.id} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {leader.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-dark-800 bg-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-100 truncate">{leader.displayName}</h4>
                    {leader.isVerified && <VerifiedBadge size="sm" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-dark-400 truncate">{leader.title}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {leader.expertiseAreas.slice(0, 3).map(area => (
                      <span key={area} className="px-1.5 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full text-[10px] font-medium">
                        {CATEGORY_LABELS[area]}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setView('request')}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                >
                  Get Help
                </button>
              </div>
            </div>
          ))}
          {availableLeaders.length === 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 text-center">
              <Clock size={24} className="mx-auto mb-2 text-gray-300 dark:text-dark-600" />
              <p className="text-sm text-gray-500 dark:text-dark-400">No leaders online right now</p>
              <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">Submit a request and we'll connect you when someone is available</p>
            </div>
          )}
        </div>
      </div>

      {/* Become a Leader CTA */}
      {onNavigate && (
        <div className="bg-gray-50 dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <UserPlus size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Called to Serve?</h3>
              <p className="text-xs text-gray-500 dark:text-dark-400">Join our pastoral care team and help others</p>
            </div>
            <button
              onClick={() => onNavigate('pastor-signup')}
              className="px-3 py-1.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 text-xs font-medium rounded-lg hover:bg-white dark:hover:bg-dark-800 transition-colors flex items-center gap-1"
            >
              Apply
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Privacy Note */}
      <div className="flex items-center gap-2 justify-center text-xs text-gray-400 dark:text-dark-500 pb-4">
        <Shield size={12} />
        All conversations are private and confidential
      </div>
    </div>
  );
}

// Simplified leader card for the leaders list view
function LeaderCard({ leader, onGetHelp }: { leader: LeaderProfile; onGetHelp: () => void }) {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {leader.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-dark-800 ${
            leader.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 dark:text-dark-100">{leader.displayName}</h3>
            {leader.isVerified && <VerifiedBadge size="sm" />}
            {leader.isAvailable && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Available
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-0.5">{leader.title}</p>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-dark-500">
            {leader.yearsOfPractice && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {leader.yearsOfPractice} yrs
              </span>
            )}
            {leader.language && leader.language !== 'English' && (
              <span className="flex items-center gap-1">
                <Globe size={11} />
                {leader.language}
              </span>
            )}
            {leader.credentials.length > 0 && (
              <span className="flex items-center gap-1">
                <Star size={11} />
                {leader.credentials.length} credential{leader.credentials.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-dark-400 mt-3 line-clamp-2">{leader.bio}</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {leader.expertiseAreas.map(area => (
          <span key={area} className="px-2 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full text-[10px] font-medium">
            {CATEGORY_LABELS[area]}
          </span>
        ))}
      </div>

      {leader.personalityTraits.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {leader.personalityTraits.map(trait => (
            <span key={trait} className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-[10px] font-medium">
              {trait}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={onGetHelp}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <MessageCircle size={16} />
          Request a Conversation
        </button>
      </div>
    </div>
  );
}
