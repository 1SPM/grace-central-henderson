import { useState } from 'react';
import { ArrowLeft, Clock, HeartHandshake, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import type { LeaderProfile } from '../../../types';
import { getLeaderHubStats } from './demoLeadersHub';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface LeaderProfileViewProps {
  leader: LeaderProfile;
  onBack: () => void;
}

export function LeaderProfileView({ leader, onBack }: LeaderProfileViewProps) {
  const stats = getLeaderHubStats(leader);
  const [liveOverride, setLiveOverride] = useState(stats.liveOverride);
  const initials = leader.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200 transition-colors"
      >
        <ArrowLeft size={15} /> Roster
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile column */}
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 self-start">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative shrink-0">
              {leader.photo ? (
                <img src={leader.photo} alt={leader.displayName} className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-dark-700 flex items-center justify-center text-base font-semibold text-slate-700 dark:text-dark-200">
                  {initials}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-500 border-2 border-stone-100 dark:border-dark-800 flex items-center justify-center">
                <ShieldCheck size={11} className="text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-dark-100">{leader.displayName}</h2>
              <p className="text-xs text-gray-500 dark:text-dark-400">{leader.title}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400 mb-4">{leader.bio}</p>

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
            <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-850 rounded-lg cursor-pointer">
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-dark-100">Live override</p>
                <p className="text-[10px] text-gray-500 dark:text-dark-400">
                  Route everything to me live, pause the AI twin
                </p>
              </div>
              <input
                type="checkbox"
                checked={liveOverride}
                onChange={e => setLiveOverride(e.target.checked)}
                className="w-4 h-4 accent-slate-900"
              />
            </label>
          </div>
        </div>

        {/* Middle + right */}
        <div className="lg:col-span-2 space-y-4">
          {/* Today's blessing */}
          <div className="rounded-xl p-5 bg-gradient-to-br from-amber-50 to-stone-100 dark:from-amber-900/20 dark:to-dark-800 border border-amber-200 dark:border-amber-800/40">
            <p className="section-eyebrow mb-2 flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-500" /> Today's blessing
            </p>
            <p className="serif text-base text-slate-900 dark:text-dark-100 leading-relaxed">{stats.todaysBlessing}</p>
            <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-2">
              Shared with {stats.blessings} members this month
            </p>
          </div>

          {/* Weekly availability */}
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">Weekly availability</h3>
              <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-dark-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Live</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> AI twin</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-dark-600" /> Off</span>
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

          {/* Care assignments */}
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3 flex items-center gap-1.5">
              <HeartHandshake size={14} className="text-rose-500" /> Care assignments
            </h3>
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
  );
}
