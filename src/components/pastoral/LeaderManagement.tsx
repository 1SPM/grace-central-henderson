import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  Search,
  UserPlus,
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  MoreVertical,
  Star,
  BarChart3,
  BookOpen,
  Pause,
  Play,
  Trash2,
  FileText,
  Users,
} from 'lucide-react';
import type {
  LeaderProfile,
  LeaderApplication,
  LeaderApplicationStatus,
  BackgroundCheckStatus,
  PastoralSession,
  HelpCategory,
} from '../../types';
import { TRAINING_MODULES } from '../../types';
import { VerifiedBadge } from './VerifiedBadge';
import { LeaderOnboardingWizard } from './LeaderOnboardingWizard';
import type { LeaderOnboardingData } from './LeaderOnboardingWizard';
import { LeaderStatsDashboard } from './LeaderStatsDashboard';

type ManagementTab = 'active' | 'applications' | 'stats';

const STATUS_CONFIG: Record<LeaderApplicationStatus, { label: string; color: string; icon: typeof Clock }> = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', icon: Eye },
  interview: { label: 'Interview', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400', icon: Users },
  training: { label: 'Training', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400', icon: BookOpen },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', icon: CheckCircle },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', icon: ShieldCheck },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400', icon: Pause },
  rejected: { label: 'Rejected', color: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400', icon: XCircle },
};

const BG_CHECK_CONFIG: Record<BackgroundCheckStatus, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-500' },
  in_progress: { label: 'In Progress', color: 'text-amber-600 dark:text-amber-400' },
  passed: { label: 'Passed', color: 'text-emerald-600 dark:text-emerald-400' },
  failed: { label: 'Failed', color: 'text-red-600 dark:text-red-400' },
  waived: { label: 'Waived', color: 'text-blue-600 dark:text-blue-400' },
};

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  'marriage': 'Marriage', 'addiction': 'Recovery', 'grief': 'Grief',
  'faith-questions': 'Faith', 'crisis': 'Crisis', 'financial': 'Financial',
  'anxiety-depression': 'Mental Health', 'parenting': 'Parenting', 'general': 'General',
};

// Demo applications data
const DEMO_APPLICATIONS: LeaderApplication[] = [
  {
    id: 'app-1',
    displayName: 'Marcus Thompson',
    title: 'Associate Pastor — Youth Ministry',
    bio: '8 years working with youth and young adults. Passionate about helping the next generation navigate faith.',
    email: 'marcus@gracechurch.org',
    phone: '(555) 234-5678',
    expertiseAreas: ['faith-questions', 'anxiety-depression', 'general'],
    credentials: ['M.Div — Gordon-Conwell', 'Youth Ministry Certificate'],
    yearsOfPractice: 8,
    personalityTraits: ['Energetic', 'Relatable', 'Encouraging'],
    spiritualFocusAreas: ['Discipleship', 'Bible Study'],
    suitableFor: ['Youth', 'Young Adults'],
    language: 'English',
    anchorVerse: 'Let no one despise you for your youth — 1 Timothy 4:12',
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    status: 'submitted',
    backgroundCheckStatus: 'not_started',
    trainingCompleted: false,
    trainingModulesDone: [],
    references: [
      { name: 'Pastor David Lee', relationship: 'Senior Pastor', email: 'david@church.org' },
      { name: 'Dr. Amy Chen', relationship: 'Seminary Professor', email: 'achen@seminary.edu' },
    ],
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-05T10:00:00Z',
  },
  {
    id: 'app-2',
    displayName: 'Sister Grace Okafor',
    title: 'Women\'s Ministry Leader',
    bio: 'Leading women\'s prayer groups for 12 years. Certified counselor with focus on marriage and family.',
    email: 'grace.okafor@gracechurch.org',
    phone: '(555) 345-6789',
    expertiseAreas: ['marriage', 'parenting', 'grief'],
    credentials: ['Licensed Professional Counselor', 'Biblical Counseling Certificate'],
    yearsOfPractice: 12,
    personalityTraits: ['Warm', 'Empathetic', 'Scripture-focused'],
    spiritualFocusAreas: ['Prayer Ministry', 'Healing Ministry'],
    suitableFor: ['Women', 'Couples', 'Families'],
    language: 'English',
    anchorVerse: 'She is clothed with strength and dignity — Proverbs 31:25',
    sessionType: 'recurring',
    sessionFrequency: 'Bi-weekly',
    status: 'under_review',
    backgroundCheckStatus: 'in_progress',
    trainingCompleted: false,
    trainingModulesDone: ['Pastoral Ethics & Boundaries', 'Active Listening Skills'],
    references: [
      { name: 'Pastor Mike Davis', relationship: 'Senior Pastor', phone: '(555) 111-2222' },
    ],
    reviewedBy: 'user-1',
    reviewedAt: '2026-02-07T14:00:00Z',
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-02-07T14:00:00Z',
  },
  {
    id: 'app-3',
    displayName: 'Deacon Robert Flores',
    title: 'Community Outreach Coordinator',
    bio: 'Former social worker turned ministry leader. Deep experience with financial counseling and crisis support.',
    email: 'robert.flores@gracechurch.org',
    expertiseAreas: ['financial', 'crisis', 'addiction'],
    credentials: ['MSW — Columbia University', 'Certified Financial Counselor'],
    yearsOfPractice: 18,
    personalityTraits: ['Direct', 'Practical', 'Compassionate'],
    spiritualFocusAreas: ['Social Justice', 'Intercessory Prayer'],
    suitableFor: ['Adults', 'Men', 'Families'],
    language: 'English',
    sessionType: 'one-time',
    status: 'training',
    backgroundCheckStatus: 'passed',
    trainingCompleted: false,
    trainingModulesDone: [
      'Pastoral Ethics & Boundaries',
      'Crisis Intervention Basics',
      'Active Listening Skills',
      'Confidentiality & Privacy',
      'Mandatory Reporting Guidelines',
    ],
    references: [],
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-02-08T11:00:00Z',
  },
];

interface LeaderManagementProps {
  leaders: LeaderProfile[];
  sessions: PastoralSession[];
  onAddLeader?: (data: LeaderOnboardingData) => void;
  onToggleLeaderAvailability?: (leaderId: string) => void;
  onDeleteLeader?: (leaderId: string) => void;
  onBack?: () => void;
  churchName?: string;
}

export function LeaderManagement({
  leaders,
  sessions,
  onAddLeader,
  onToggleLeaderAvailability,
  onDeleteLeader,
  onBack,
}: LeaderManagementProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>('active');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaderApplicationStatus | 'all'>('all');
  const [applications, setApplications] = useState<LeaderApplication[]>(DEMO_APPLICATIONS);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const filteredLeaders = useMemo(() => {
    return leaders.filter(l => {
      if (search) {
        const q = search.toLowerCase();
        return l.displayName.toLowerCase().includes(q) || l.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [leaders, search]);

  const filteredApps = useMemo(() => {
    return applications.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return a.displayName.toLowerCase().includes(q) || a.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [applications, statusFilter, search]);

  const updateApplicationStatus = (appId: string, newStatus: LeaderApplicationStatus, notes?: string) => {
    setApplications(prev => prev.map(a =>
      a.id === appId
        ? {
            ...a,
            status: newStatus,
            statusNotes: notes || a.statusNotes,
            reviewedAt: newStatus === 'under_review' ? new Date().toISOString() : a.reviewedAt,
            approvedAt: newStatus === 'approved' || newStatus === 'active' ? new Date().toISOString() : a.approvedAt,
            updatedAt: new Date().toISOString(),
          }
        : a
    ));
    setActionMenuId(null);
  };

  const updateBackgroundCheck = (appId: string, status: BackgroundCheckStatus) => {
    setApplications(prev => prev.map(a =>
      a.id === appId
        ? { ...a, backgroundCheckStatus: status, backgroundCheckDate: new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString() }
        : a
    ));
  };

  const toggleTrainingModule = (appId: string, moduleName: string) => {
    setApplications(prev => prev.map(a => {
      if (a.id !== appId) return a;
      const done = a.trainingModulesDone.includes(moduleName)
        ? a.trainingModulesDone.filter(m => m !== moduleName)
        : [...a.trainingModulesDone, moduleName];
      return {
        ...a,
        trainingModulesDone: done,
        trainingCompleted: done.length === TRAINING_MODULES.length,
        trainingCompletedDate: done.length === TRAINING_MODULES.length ? new Date().toISOString().split('T')[0] : a.trainingCompletedDate,
        updatedAt: new Date().toISOString(),
      };
    }));
  };

  const handleNewApplication = (data: LeaderOnboardingData) => {
    const newApp: LeaderApplication = {
      id: `app-${Date.now()}`,
      displayName: data.displayName,
      title: data.title,
      bio: data.bio,
      photo: data.photo,
      email: data.email,
      phone: data.phone,
      expertiseAreas: data.expertiseAreas,
      credentials: data.credentials,
      yearsOfPractice: data.yearsOfPractice,
      personalityTraits: data.personalityTraits,
      spiritualFocusAreas: data.spiritualFocusAreas,
      suitableFor: data.suitableFor,
      language: data.language,
      anchorVerse: data.anchors,
      sessionType: data.sessionType,
      sessionFrequency: data.sessionFrequency,
      status: 'submitted',
      backgroundCheckStatus: 'not_started',
      trainingCompleted: false,
      trainingModulesDone: [],
      references: data.references,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setApplications(prev => [newApp, ...prev]);
    setShowOnboarding(false);
    setActiveTab('applications');

    if (onAddLeader) {
      onAddLeader(data);
    }
  };

  if (showOnboarding) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <LeaderOnboardingWizard
          onSubmit={handleNewApplication}
          onBack={() => setShowOnboarding(false)}
        />
      </div>
    );
  }

  if (activeTab === 'stats') {
    return (
      <LeaderStatsDashboard
        leaders={leaders}
        sessions={sessions}
        onBack={() => setActiveTab('active')}
      />
    );
  }

  const appStatusCounts = applications.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100">Leader Management</h2>
            <p className="text-sm text-gray-500 dark:text-dark-400">Manage, onboard, and monitor pastoral care leaders</p>
          </div>
        </div>
        <button
          onClick={() => setShowOnboarding(true)}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <UserPlus size={16} />
          New Application
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-850 rounded-xl p-1">
        {[
          { id: 'active' as const, label: 'Active Leaders', count: leaders.length, icon: ShieldCheck },
          { id: 'applications' as const, label: 'Applications', count: applications.length, icon: FileText },
          { id: 'stats' as const, label: 'Analytics', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 shadow-sm'
                : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  : 'bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-dark-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab === 'active' ? 'leaders' : 'applications'}...`}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        {activeTab === 'applications' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeaderApplicationStatus | 'all')}
            className="px-3 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 rounded-xl text-sm"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label} {appStatusCounts[key] ? `(${appStatusCounts[key]})` : ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* Active Leaders Tab */}
      {activeTab === 'active' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeaders.map(leader => {
            const leaderSessions = sessions.filter(s => s.leaderId === leader.id);
            const completedCount = leaderSessions.filter(s => s.status === 'completed').length;
            const rated = leaderSessions.filter(s => s.rating != null);
            const avgRating = rated.length > 0 ? Math.round(rated.reduce((s, r) => s + (r.rating || 0), 0) / rated.length * 10) / 10 : 0;

            return (
              <div key={leader.id} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {leader.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-100">{leader.displayName}</h4>
                        {leader.isVerified && <VerifiedBadge size="sm" />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-dark-400">{leader.title}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setActionMenuId(actionMenuId === leader.id ? null : leader.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded"
                    >
                      <MoreVertical size={14} className="text-gray-400" />
                    </button>
                    {actionMenuId === leader.id && (
                      <div className="absolute right-0 top-8 w-48 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-lg z-10 py-1">
                        <button
                          onClick={() => { onToggleLeaderAvailability?.(leader.id); setActionMenuId(null); }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-750 flex items-center gap-2"
                        >
                          {leader.isAvailable ? <Pause size={14} /> : <Play size={14} />}
                          {leader.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
                        </button>
                        <button
                          onClick={() => { onDeleteLeader?.(leader.id); setActionMenuId(null); }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/5 flex items-center gap-2"
                        >
                          <Trash2 size={14} />
                          Remove Leader
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {leader.expertiseAreas.slice(0, 3).map(area => (
                    <span key={area} className="px-2 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full text-[10px] font-medium">
                      {CATEGORY_LABELS[area] || area}
                    </span>
                  ))}
                  {leader.expertiseAreas.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 rounded-full text-[10px]">
                      +{leader.expertiseAreas.length - 3}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-dark-700">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-dark-100">{completedCount}</p>
                    <p className="text-[10px] text-gray-500 dark:text-dark-400">Sessions</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <p className="text-lg font-bold text-gray-900 dark:text-dark-100">{avgRating || '---'}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-dark-400">Rating</p>
                  </div>
                  <div className="text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      leader.isAvailable
                        ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${leader.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {leader.isAvailable ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredLeaders.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-dark-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No leaders found</p>
            </div>
          )}
        </div>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Status pipeline summary */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['submitted', 'under_review', 'interview', 'training', 'approved', 'active'] as LeaderApplicationStatus[]).map(status => {
              const config = STATUS_CONFIG[status];
              const count = appStatusCounts[status] || 0;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-all ${
                    statusFilter === status
                      ? 'border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/5 text-violet-700 dark:text-violet-300'
                      : 'border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-600 dark:text-dark-400 hover:border-gray-300 dark:hover:border-dark-600'
                  }`}
                >
                  <config.icon size={14} />
                  {config.label}
                  <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 text-[10px]">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Application list */}
          {filteredApps.map(app => {
            const statusCfg = STATUS_CONFIG[app.status];
            const bgCfg = BG_CHECK_CONFIG[app.backgroundCheckStatus];
            const isExpanded = selectedAppId === app.id;

            return (
              <div key={app.id} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
                {/* App header */}
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors"
                  onClick={() => setSelectedAppId(isExpanded ? null : app.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                        {app.displayName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-100">{app.displayName}</h4>
                        <p className="text-xs text-gray-500 dark:text-dark-400">{app.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.color}`}>
                            <statusCfg.icon size={10} />
                            {statusCfg.label}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-dark-500">
                            Applied {new Date(app.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {app.expertiseAreas.slice(0, 2).map(area => (
                        <span key={area} className="px-2 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full text-[10px] font-medium">
                          {CATEGORY_LABELS[area]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-dark-700 p-5 space-y-5">
                    {/* Bio */}
                    {app.bio && (
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-1">About</h5>
                        <p className="text-sm text-gray-700 dark:text-dark-300">{app.bio}</p>
                      </div>
                    )}

                    {/* Contact & Experience */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-1">Contact</h5>
                        {app.email && <p className="text-sm text-gray-700 dark:text-dark-300">{app.email}</p>}
                        {app.phone && <p className="text-sm text-gray-500 dark:text-dark-400">{app.phone}</p>}
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-1">Experience</h5>
                        <p className="text-sm text-gray-700 dark:text-dark-300">{app.yearsOfPractice || 0} years</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-1">Background Check</h5>
                        <p className={`text-sm font-medium ${bgCfg.color}`}>{bgCfg.label}</p>
                      </div>
                    </div>

                    {/* Credentials */}
                    {app.credentials.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2">Credentials</h5>
                        <div className="flex flex-wrap gap-1.5">
                          {app.credentials.map(c => (
                            <span key={c} className="px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-xs">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* References */}
                    {app.references.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2">References</h5>
                        <div className="space-y-1.5">
                          {app.references.map((ref, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-sm">
                              <span className="text-gray-700 dark:text-dark-300 font-medium">{ref.name}</span>
                              <span className="text-gray-400 dark:text-dark-500">({ref.relationship})</span>
                              {ref.email && <span className="text-gray-400 dark:text-dark-500 text-xs">{ref.email}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Training Progress */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2">
                        Training Progress ({app.trainingModulesDone.length}/{TRAINING_MODULES.length})
                      </h5>
                      <div className="w-full h-2 bg-gray-100 dark:bg-dark-700 rounded-full mb-3 overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all"
                          style={{ width: `${(app.trainingModulesDone.length / TRAINING_MODULES.length) * 100}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {TRAINING_MODULES.map(mod => {
                          const done = app.trainingModulesDone.includes(mod);
                          return (
                            <button
                              key={mod}
                              onClick={(e) => { e.stopPropagation(); toggleTrainingModule(app.id, mod); }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all ${
                                done
                                  ? 'bg-emerald-50 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-gray-50 dark:bg-dark-850 text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700'
                              }`}
                            >
                              {done ? <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-dark-600 flex-shrink-0" />}
                              {mod}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-dark-700">
                      {app.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => updateApplicationStatus(app.id, 'under_review')}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <Eye size={14} />
                            Start Review
                          </button>
                          <button
                            onClick={() => updateApplicationStatus(app.id, 'rejected', 'Application did not meet requirements.')}
                            className="px-4 py-2 border border-gray-200 dark:border-dark-700 text-gray-600 dark:text-dark-400 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-dark-750 flex items-center gap-2"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </>
                      )}
                      {app.status === 'under_review' && (
                        <>
                          <button
                            onClick={() => updateApplicationStatus(app.id, 'interview')}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <Users size={14} />
                            Schedule Interview
                          </button>
                          <button
                            onClick={() => updateApplicationStatus(app.id, 'training')}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <BookOpen size={14} />
                            Move to Training
                          </button>
                        </>
                      )}
                      {app.status === 'interview' && (
                        <button
                          onClick={() => updateApplicationStatus(app.id, 'training')}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <BookOpen size={14} />
                          Move to Training
                        </button>
                      )}
                      {app.status === 'training' && (
                        <button
                          onClick={() => updateApplicationStatus(app.id, 'approved')}
                          disabled={!app.trainingCompleted}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <CheckCircle size={14} />
                          Approve Leader
                        </button>
                      )}
                      {app.status === 'approved' && (
                        <button
                          onClick={() => updateApplicationStatus(app.id, 'active')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <ShieldCheck size={14} />
                          Activate
                        </button>
                      )}

                      {/* Background Check Controls */}
                      {['submitted', 'under_review', 'interview', 'training'].includes(app.status) && (
                        <div className="ml-auto">
                          <select
                            value={app.backgroundCheckStatus}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateBackgroundCheck(app.id, e.target.value as BackgroundCheckStatus)}
                            className="px-3 py-2 text-xs border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 rounded-lg"
                          >
                            <option value="not_started">BG Check: Not Started</option>
                            <option value="in_progress">BG Check: In Progress</option>
                            <option value="passed">BG Check: Passed</option>
                            <option value="failed">BG Check: Failed</option>
                            <option value="waived">BG Check: Waived</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredApps.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-dark-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No applications found</p>
              <button
                onClick={() => setShowOnboarding(true)}
                className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create New Application
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
