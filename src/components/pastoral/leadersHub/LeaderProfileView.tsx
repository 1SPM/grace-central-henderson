import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bot, Clock, MessageSquare, Star, User } from 'lucide-react';
import type { LeaderProfile, Person, View } from '../../../types';
import {
  leadershipHash,
  parseLeadershipProfileTab,
  type LeadershipProfileTab,
} from '../../../lib/leadershipNav';
import { getLeaderHubStats } from './demoLeadersHub';
import { LeaderAvatar } from './LeaderAvatar';
import { LeaderContactTab } from './LeaderContactTab';
import { AICompanionConfig } from './AICompanionConfig';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PROFILE_TABS: { id: LeadershipProfileTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'companion', label: 'AI Companion' },
];

interface LeaderProfileViewProps {
  leader: LeaderProfile;
  people?: Person[];
  churchName?: string;
  onBack: () => void;
  onNavigate?: (view: View | string) => void;
}

export function LeaderProfileView({
  leader,
  people = [],
  churchName,
  onBack,
  onNavigate,
}: LeaderProfileViewProps) {
  const stats = getLeaderHubStats(leader);
  const [liveOverride, setLiveOverride] = useState(stats.liveOverride);
  const [profileTab, setProfileTab] = useState<LeadershipProfileTab>(() => parseLeadershipProfileTab());
  const hasAi = leader.hasAiCompanion !== false;

  const syncProfileTabFromHash = useCallback(() => {
    setProfileTab(parseLeadershipProfileTab());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncProfileTabFromHash);
    return () => window.removeEventListener('hashchange', syncProfileTabFromHash);
  }, [syncProfileTabFromHash]);

  const selectProfileTab = (next: LeadershipProfileTab) => {
    setProfileTab(next);
    window.history.replaceState(null, '', leadershipHash('team', 'team', leader.id, next));
  };

  const visibleTabs = PROFILE_TABS.filter(t => t.id !== 'companion' || hasAi);

  const kpiCards = [
    { label: 'Sessions', value: stats.sessions },
    { label: 'Rating', value: stats.rating.toFixed(1), star: true },
    { label: 'Blessings', value: `${stats.blessings}/28` },
    { label: 'Human replies', value: Math.round(stats.dms * (1 - stats.aiPct / 100)) },
  ] as const;

  const renderIdentityCard = (compact = false) => (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 self-start h-full">
      <div className={`flex flex-col items-center text-center w-full ${compact ? '' : 'max-w-lg mx-auto'}`}>
        <div className={`${compact ? 'w-28' : 'w-32'} mb-3`}>
          <LeaderAvatar leader={leader} size="hero" rounded="xl" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">{leader.displayName}</h2>
        <p className="text-sm text-gray-500 dark:text-dark-400 mt-0.5">{leader.title}</p>
        <div className="flex gap-1.5 mt-2 flex-wrap justify-center">
          {leader.isAvailable ? (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Live
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              AI on duty
            </span>
          )}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <User size={9} className="inline mr-0.5" /> Human
          </span>
          {hasAi && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              <Bot size={9} className="inline mr-0.5" /> AI companion
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-dark-400 mt-3 leading-relaxed">{leader.bio}</p>
      </div>
    </div>
  );

  const renderKpiGrid = (className = '') => (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {kpiCards.map(kpi => (
        <div
          key={kpi.label}
          className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4"
        >
          <p className="section-eyebrow">{kpi.label}</p>
          <p className="stat-number text-xl text-slate-900 dark:text-dark-100 mt-1 flex items-center gap-1">
            {'star' in kpi && kpi.star && <Star size={14} className="text-amber-500 fill-amber-500" />}
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200 transition-colors"
      >
        <ArrowLeft size={15} /> Team
      </button>

      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-dark-700 overflow-x-auto">
        {visibleTabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectProfileTab(id)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              profileTab === id
                ? 'border-slate-900 dark:border-dark-100 text-slate-900 dark:text-dark-100 font-medium'
                : 'border-transparent text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {profileTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            <div className="lg:col-span-2">{renderIdentityCard(true)}</div>
            <div className="lg:col-span-3 space-y-4">
              {renderKpiGrid()}
              <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">Weekly availability</h3>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-dark-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Live
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-violet-500" /> AI
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-dark-600" /> Off
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day, i) => {
                    const mode = stats.availability[i];
                    return (
                      <div
                        key={day}
                        className={`rounded-lg p-2.5 text-center border ${
                          mode === 'live'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
                            : mode === 'ai'
                              ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40'
                              : 'bg-gray-50 dark:bg-dark-850 border-gray-200 dark:border-dark-700 opacity-60'
                        }`}
                      >
                        <p className="text-[10px] font-medium text-gray-500 dark:text-dark-400">{day}</p>
                        <p
                          className={`text-[10px] font-semibold mt-1 ${
                            mode === 'live'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : mode === 'ai'
                                ? 'text-violet-700 dark:text-violet-300'
                                : 'text-gray-400 dark:text-dark-500'
                          }`}
                        >
                          {mode === 'live' ? 'Live' : mode === 'ai' ? 'AI' : 'Off'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <LeaderContactTab
                leader={leader}
                people={people}
                churchName={churchName}
                onNavigate={onNavigate}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 self-start">
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-dark-850 rounded-lg">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-dark-500 flex items-center gap-1 mb-1">
                  <MessageSquare size={11} /> DM threshold
                </p>
                <p className="text-xs text-gray-700 dark:text-dark-300">{stats.dmThreshold}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-dark-850 rounded-lg">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-dark-500 flex items-center gap-1 mb-1">
                  <Clock size={11} /> Hours
                </p>
                <p className="text-xs text-gray-700 dark:text-dark-300">{stats.hours}</p>
              </div>
              {hasAi && (
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-850 rounded-lg cursor-pointer">
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-dark-100">Live override</p>
                    <p className="text-[10px] text-gray-500 dark:text-dark-400">
                      Route everything live, pause AI companion
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={liveOverride}
                    onChange={e => setLiveOverride(e.target.checked)}
                    className="w-4 h-4 accent-slate-900"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">Care assignments</h3>
              <div className="space-y-2">
                {stats.careAssignments.map(assignment => (
                  <div
                    key={assignment}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-850 rounded-lg"
                  >
                    <span className="text-sm text-gray-700 dark:text-dark-300">{assignment}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {profileTab === 'companion' && hasAi && (
        <>
          {renderIdentityCard()}
          <AICompanionConfig leader={leader} embedded />
        </>
      )}
    </div>
  );
}
