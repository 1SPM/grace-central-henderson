import { useState, useMemo } from 'react';
import {
  Shield,
  Star,
  Clock,
  MessageCircle,
  CheckCircle,
  Calendar,
  TrendingUp,
  Users,
  Heart,
  AlertCircle,
  ChevronRight,
  BarChart3,
  Bell,
  User,
  Phone,
  Video,
  MessageSquare,
} from 'lucide-react';
import type { LeaderProfile, PastoralSession, HelpRequest, HelpCategory } from '../../types';
import { VerifiedBadge } from '../pastoral/VerifiedBadge';

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  'marriage': 'Marriage', 'addiction': 'Recovery', 'grief': 'Grief',
  'faith-questions': 'Faith', 'crisis': 'Crisis', 'financial': 'Financial',
  'anxiety-depression': 'Mental Health', 'parenting': 'Parenting', 'general': 'General',
};

const CATEGORY_ICONS: Record<HelpCategory, typeof Heart> = {
  'marriage': Heart, 'addiction': Shield, 'grief': Heart,
  'faith-questions': Star, 'crisis': AlertCircle, 'financial': TrendingUp,
  'anxiety-depression': Heart, 'parenting': Users, 'general': MessageCircle,
};

type MinistryTab = 'overview' | 'sessions' | 'requests';

// Demo sessions for current leader
function getDemoSessions(leaderId: string): PastoralSession[] {
  return [
    {
      id: 'session-1',
      leaderId,
      personId: 'person-10',
      category: 'marriage',
      sessionType: 'video',
      startedAt: '2026-02-10T14:00:00Z',
      endedAt: '2026-02-10T15:00:00Z',
      durationMinutes: 60,
      status: 'completed',
      notes: 'Discussed communication patterns. Couple showing improvement.',
      followUpNeeded: true,
      followUpDate: '2026-02-17',
      rating: 5,
      feedback: 'Pastor was very helpful and attentive.',
      isAnonymous: false,
      createdAt: '2026-02-10T14:00:00Z',
    },
    {
      id: 'session-2',
      leaderId,
      personId: 'person-11',
      category: 'grief',
      sessionType: 'in-person',
      startedAt: '2026-02-09T10:00:00Z',
      endedAt: '2026-02-09T10:45:00Z',
      durationMinutes: 45,
      status: 'completed',
      notes: 'Processing loss of parent. Referred to grief support group.',
      followUpNeeded: true,
      followUpDate: '2026-02-16',
      rating: 4,
      isAnonymous: false,
      createdAt: '2026-02-09T10:00:00Z',
    },
    {
      id: 'session-3',
      leaderId,
      category: 'anxiety-depression',
      sessionType: 'chat',
      startedAt: '2026-02-11T09:00:00Z',
      status: 'active',
      followUpNeeded: false,
      isAnonymous: true,
      createdAt: '2026-02-11T09:00:00Z',
    },
    {
      id: 'session-4',
      leaderId,
      personId: 'person-12',
      category: 'faith-questions',
      sessionType: 'phone',
      startedAt: '2026-02-12T16:00:00Z',
      status: 'scheduled',
      followUpNeeded: false,
      isAnonymous: false,
      createdAt: '2026-02-08T12:00:00Z',
    },
    {
      id: 'session-5',
      leaderId,
      personId: 'person-13',
      category: 'parenting',
      sessionType: 'video',
      startedAt: '2026-02-07T11:00:00Z',
      endedAt: '2026-02-07T11:50:00Z',
      durationMinutes: 50,
      status: 'completed',
      followUpNeeded: false,
      rating: 5,
      feedback: 'Great practical advice!',
      isAnonymous: false,
      createdAt: '2026-02-07T11:00:00Z',
    },
  ];
}

const SESSION_TYPE_ICONS: Record<string, typeof Phone> = {
  'chat': MessageSquare,
  'video': Video,
  'phone': Phone,
  'in-person': User,
};

interface MyMinistryPageProps {
  leader?: LeaderProfile;
  helpRequests?: HelpRequest[];
  churchName?: string;
}

export function MyMinistryPage({ leader, helpRequests = [], churchName = 'Grace Church' }: MyMinistryPageProps) {
  const [activeTab, setActiveTab] = useState<MinistryTab>('overview');

  // Use first demo leader if none provided
  const currentLeader: LeaderProfile = leader || {
    id: 'leader-1',
    displayName: 'Pastor Mike Davis',
    title: 'Senior Pastor — Marriage & Family',
    bio: 'Over 20 years of pastoral experience.',
    expertiseAreas: ['marriage', 'parenting', 'general'],
    credentials: ['M.Div — Dallas Theological Seminary', 'Certified Biblical Counselor (ACBC)'],
    yearsOfPractice: 22,
    personalityTraits: ['Warm', 'Patient', 'Scripture-focused'],
    spiritualFocusAreas: ['Prayer Ministry', 'Discipleship'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
  };

  const sessions = useMemo(() => getDemoSessions(currentLeader.id), [currentLeader.id]);

  const completed = sessions.filter(s => s.status === 'completed');
  const active = sessions.filter(s => s.status === 'active');
  const scheduled = sessions.filter(s => s.status === 'scheduled');
  const totalHours = Math.round(completed.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60 * 10) / 10;
  const rated = completed.filter(s => s.rating != null);
  const avgRating = rated.length > 0 ? Math.round(rated.reduce((sum, s) => sum + (s.rating || 0), 0) / rated.length * 10) / 10 : 0;
  const followUps = sessions.filter(s => s.followUpNeeded && s.followUpDate);
  const pendingRequests = helpRequests.filter(r => r.status === 'pending' && r.assignedLeaderId === currentLeader.id);

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      {/* Leader Profile Card */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
            {currentLeader.displayName.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold">{currentLeader.displayName}</h2>
              {currentLeader.isVerified && <VerifiedBadge size="sm" />}
            </div>
            <p className="text-sm text-violet-200">{currentLeader.title}</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
            currentLeader.isAvailable
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'bg-white/10 text-white/60'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${currentLeader.isAvailable ? 'bg-emerald-400' : 'bg-white/40'}`} />
            {currentLeader.isAvailable ? 'Available' : 'Unavailable'}
          </span>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Sessions', value: completed.length, icon: MessageCircle },
            { label: 'Hours', value: totalHours, icon: Clock },
            { label: 'Rating', value: avgRating > 0 ? avgRating : '---', icon: Star },
            { label: 'Active', value: active.length, icon: Heart },
          ].map(stat => (
            <div key={stat.label} className="text-center bg-white/10 rounded-xl py-2.5 px-2">
              <stat.icon size={16} className="mx-auto mb-1 text-violet-200" />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[10px] text-violet-200">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {(pendingRequests.length > 0 || followUps.length > 0) && (
        <div className="space-y-2">
          {pendingRequests.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl">
              <Bell size={18} className="text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{pendingRequests.length} pending care request{pendingRequests.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">New requests waiting for your response</p>
              </div>
              <ChevronRight size={16} className="text-amber-400" />
            </div>
          )}
          {followUps.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl">
              <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">{followUps.length} follow-up{followUps.length > 1 ? 's' : ''} scheduled</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Members needing continued support</p>
              </div>
              <ChevronRight size={16} className="text-blue-400" />
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-dark-850 rounded-xl p-1">
        {[
          { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
          { id: 'sessions' as const, label: 'Sessions', icon: MessageCircle },
          { id: 'requests' as const, label: 'Requests', icon: Bell },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 shadow-sm'
                : 'text-gray-500 dark:text-dark-400'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Upcoming Sessions */}
          {scheduled.length > 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-3">Upcoming Sessions</h3>
              <div className="space-y-2">
                {scheduled.map(session => {
                  const SessionIcon = SESSION_TYPE_ICONS[session.sessionType] || MessageCircle;
                  return (
                    <div key={session.id} className="flex items-center gap-3 p-3 bg-violet-50 dark:bg-violet-500/5 rounded-lg">
                      <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
                        <SessionIcon size={16} className="text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                          {CATEGORY_LABELS[session.category]} Session
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          {new Date(session.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {' '}&middot; {session.sessionType}
                          {session.isAnonymous && ' (Anonymous)'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 rounded-full text-[10px] font-medium">
                        Scheduled
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Sessions */}
          {active.length > 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-3">Active Sessions</h3>
              <div className="space-y-2">
                {active.map(session => (
                  <div key={session.id} className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-500/5 rounded-lg">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                      <MessageCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        {CATEGORY_LABELS[session.category]} — {session.isAnonymous ? 'Anonymous' : 'Active'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        Started {new Date(session.startedAt).toLocaleDateString()} &middot; {session.sessionType}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expertise Areas */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-3">Your Expertise</h3>
            <div className="flex flex-wrap gap-2">
              {currentLeader.expertiseAreas.map(area => {
                const AreaIcon = CATEGORY_ICONS[area] || Heart;
                return (
                  <div key={area} className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 dark:bg-violet-500/5 rounded-lg">
                    <AreaIcon size={14} className="text-violet-600 dark:text-violet-400" />
                    <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">{CATEGORY_LABELS[area]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Follow-ups Due */}
          {followUps.length > 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-3">Follow-ups Due</h3>
              <div className="space-y-2">
                {followUps.map(session => (
                  <div key={session.id} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-500/5 rounded-lg">
                    <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-dark-100">{CATEGORY_LABELS[session.category]} Follow-up</p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        Due {session.followUpDate ? new Date(session.followUpDate).toLocaleDateString() : 'TBD'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-dark-400">
              <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No sessions yet</p>
            </div>
          ) : (
            sessions
              .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
              .map(session => {
                const SessionIcon = SESSION_TYPE_ICONS[session.sessionType] || MessageCircle;
                const statusColors: Record<string, string> = {
                  scheduled: 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300',
                  active: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                  completed: 'bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400',
                  cancelled: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
                  'no-show': 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
                };

                return (
                  <div key={session.id} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                          <SessionIcon size={14} className="text-gray-500 dark:text-dark-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{CATEGORY_LABELS[session.category]}</p>
                          <p className="text-xs text-gray-500 dark:text-dark-400">
                            {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {session.durationMinutes && ` — ${session.durationMinutes} min`}
                            {session.isAnonymous && ' (Anonymous)'}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[session.status] || ''}`}>
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-xs text-gray-600 dark:text-dark-300 mt-2 pl-10">{session.notes}</p>
                    )}
                    {session.rating && (
                      <div className="flex items-center gap-1 mt-2 pl-10">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={i < session.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-dark-600'}
                          />
                        ))}
                        {session.feedback && <span className="text-[10px] text-gray-400 dark:text-dark-500 ml-2 italic">&quot;{session.feedback}&quot;</span>}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-dark-400">
              <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending requests</p>
              <p className="text-xs mt-1">All caught up! New care requests will appear here.</p>
            </div>
          ) : (
            pendingRequests.map(req => (
              <div key={req.id} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{CATEGORY_LABELS[req.category]} Request</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">
                      {req.isAnonymous ? 'Anonymous' : 'Member'} &middot; {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                    {req.description && <p className="text-xs text-gray-600 dark:text-dark-300 mt-1">{req.description}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    req.priority === 'crisis' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' :
                    req.priority === 'high' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' :
                    'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                  }`}>
                    {req.priority}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
