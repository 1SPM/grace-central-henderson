/**
 * MemberJourneyPage — "My Journey" tab in the member portal.
 *
 * Shows the signed-in member's personal spiritual milestone timeline,
 * mirroring what the admin sees in DiscipleshipTimeline but from the
 * member's perspective — encouraging rather than administrative.
 *
 * Data flows:
 *   Admin (DiscipleshipTimeline) → discipleship_milestones (Supabase)
 *                                         ↓
 *   Member (MemberJourneyPage) ← reads own rows via portal auth
 *
 * Portal activity events fired:
 *   journey_view           — on mount (admin Portal Activity captures engagement)
 *   milestone_step_request — when member taps "I'm interested" on a pending step
 */

import { useEffect, useState } from 'react';
import {
  DoorOpen, BookOpen, Droplets, Users, Heart, Crown,
  Check, ChevronRight, Star, Sparkles, MapPin,
} from 'lucide-react';
import type { DiscipleshipMilestone, MilestoneType } from '../../types';
import { DEFAULT_MILESTONE_DEFINITIONS } from '../../types';
import { logMemberActivity } from '../../lib/services/memberActivity';

interface MemberJourneyPageProps {
  milestones: DiscipleshipMilestone[];
  personId?: string | null;
  churchId?: string;
  memberName?: string;
}

const MILESTONE_ICONS: Record<MilestoneType, typeof DoorOpen> = {
  first_visit: DoorOpen,
  attended_class: BookOpen,
  baptized: Droplets,
  joined_group: Users,
  serving: Heart,
  leading: Crown,
};

const STEP_ENCOURAGEMENT: Record<MilestoneType, { description: string; cta: string }> = {
  first_visit: {
    description: 'Every great journey begins with a single step. Welcome!',
    cta: "I've attended",
  },
  attended_class: {
    description: 'Our membership class helps you connect, grow, and find your place in the GRACE family.',
    cta: "I'd like to attend a class",
  },
  baptized: {
    description: 'Baptism is a public declaration of your faith — a beautiful milestone in your walk with God.',
    cta: "I'm interested in baptism",
  },
  joined_group: {
    description: 'Small groups are where real community happens. Find your people.',
    cta: 'Help me find a group',
  },
  serving: {
    description: 'Using your gifts to serve is one of the most meaningful ways to grow.',
    cta: 'I want to serve',
  },
  leading: {
    description: 'As you lead others, you multiply the impact of everything God has done in your life.',
    cta: 'I feel called to lead',
  },
};

const MILESTONE_GRADIENTS: Record<MilestoneType, string> = {
  first_visit: 'from-blue-500 to-blue-600',
  attended_class: 'from-slate-500 to-slate-600',
  baptized: 'from-cyan-500 to-cyan-600',
  joined_group: 'from-green-500 to-green-600',
  serving: 'from-amber-500 to-amber-600',
  leading: 'from-rose-500 to-rose-600',
};

const MILESTONE_LIGHT: Record<MilestoneType, string> = {
  first_visit: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
  attended_class: 'bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30',
  baptized: 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30',
  joined_group: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
  serving: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
  leading: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30',
};

function JourneyProgressRing({ pct }: { pct: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8"
          className="stroke-gray-200 dark:stroke-dark-700" />
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-indigo-500 transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900 dark:text-dark-100">{pct}%</span>
        <span className="text-[10px] text-gray-400 dark:text-dark-500 font-medium">complete</span>
      </div>
    </div>
  );
}

export function MemberJourneyPage({
  milestones,
  personId,
  churchId,
  memberName,
}: MemberJourneyPageProps) {
  const [requestedSteps, setRequestedSteps] = useState<Set<MilestoneType>>(new Set());

  // Log portal engagement on mount
  useEffect(() => {
    if (!churchId || !personId) return;
    logMemberActivity({
      churchId,
      personId,
      eventType: 'journey_view',
      entityType: 'page',
    });
  }, [churchId, personId]);

  const milestoneMap = new Map(milestones.map(m => [m.milestoneType, m]));
  const completedCount = DEFAULT_MILESTONE_DEFINITIONS.filter(d => milestoneMap.has(d.type)).length;
  const totalCount = DEFAULT_MILESTONE_DEFINITIONS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  // Find the next incomplete milestone
  const nextStep = DEFAULT_MILESTONE_DEFINITIONS.find(d => !milestoneMap.has(d.type));

  const handleStepRequest = (type: MilestoneType) => {
    if (requestedSteps.has(type)) return;
    setRequestedSteps(prev => new Set([...prev, type]));
    if (churchId && personId) {
      logMemberActivity({
        churchId,
        personId,
        eventType: 'milestone_step_request',
        entityType: 'milestone',
        metadata: { milestone_type: type },
      });
    }
  };

  return (
    <div className="p-4 pb-8 max-w-lg mx-auto space-y-5">

      {/* Hero header */}
      <div className="bg-gradient-to-br from-indigo-600 to-slate-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <JourneyProgressRing pct={progressPct} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin size={14} className="text-indigo-200" />
              <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">My Journey</span>
            </div>
            <h1 className="text-xl font-bold leading-tight mb-1">
              {memberName ? `${memberName}'s Story` : 'Your Spiritual Story'}
            </h1>
            <p className="text-sm text-indigo-200 leading-snug">
              {completedCount === 0
                ? 'Your journey is just beginning — every step matters.'
                : completedCount === totalCount
                ? "You've completed all milestones. Thank you for your faithfulness!"
                : `${completedCount} of ${totalCount} milestones complete. Keep going!`}
            </p>
          </div>
        </div>

        {/* Quick milestone dots */}
        <div className="flex gap-2 mt-4">
          {DEFAULT_MILESTONE_DEFINITIONS.map(def => {
            const done = milestoneMap.has(def.type);
            return (
              <div key={def.type}
                className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                  done ? 'bg-white' : 'bg-white/25'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Next step highlight */}
      {nextStep && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-0.5">
                Your next step
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-1">
                {nextStep.label}
              </p>
              <p className="text-xs text-gray-600 dark:text-dark-400 leading-relaxed">
                {STEP_ENCOURAGEMENT[nextStep.type].description}
              </p>
              {requestedSteps.has(nextStep.type) ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  <Check size={13} />
                  We'll be in touch soon!
                </div>
              ) : (
                <button
                  onClick={() => handleStepRequest(nextStep.type)}
                  className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-400 transition-colors"
                >
                  {STEP_ENCOURAGEMENT[nextStep.type].cta}
                  <ChevronRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All milestones */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-dark-500 uppercase tracking-wider px-1">
          All Milestones
        </h2>
        {DEFAULT_MILESTONE_DEFINITIONS.map((def, idx) => {
          const milestone = milestoneMap.get(def.type);
          const isCompleted = !!milestone;
          const isNext = !isCompleted && def.type === nextStep?.type;
          const Icon = MILESTONE_ICONS[def.type];
          const requested = requestedSteps.has(def.type);

          return (
            <div
              key={def.type}
              className={`rounded-2xl border p-4 transition-all ${
                isCompleted
                  ? MILESTONE_LIGHT[def.type]
                  : 'bg-stone-100 dark:bg-dark-850 border-gray-200 dark:border-dark-700'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Step number / icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? `bg-gradient-to-br ${MILESTONE_GRADIENTS[def.type]} shadow-sm`
                    : 'bg-gray-200 dark:bg-dark-700'
                }`}>
                  {isCompleted
                    ? <Check size={18} className="text-white" />
                    : <span className="text-sm font-bold text-gray-400 dark:text-dark-500">{idx + 1}</span>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon size={13} className={isCompleted
                      ? 'text-gray-600 dark:text-dark-400'
                      : 'text-gray-400 dark:text-dark-600'
                    } />
                    <span className={`text-sm font-semibold ${
                      isCompleted ? 'text-gray-900 dark:text-dark-100' : 'text-gray-500 dark:text-dark-500'
                    }`}>
                      {def.label}
                    </span>
                    {isNext && (
                      <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">
                        Next
                      </span>
                    )}
                  </div>

                  {isCompleted && milestone ? (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        Completed {new Date(milestone.completedAt).toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                      {milestone.notes && (
                        <p className="text-xs text-gray-600 dark:text-dark-300 italic leading-relaxed">
                          "{milestone.notes}"
                        </p>
                      )}
                      {milestone.verifiedBy && (
                        <p className="text-[11px] text-gray-400 dark:text-dark-500 flex items-center gap-1">
                          <Star size={10} />
                          Noted by {milestone.verifiedBy}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-dark-600 leading-relaxed">
                        {STEP_ENCOURAGEMENT[def.type].description}
                      </p>
                      {!requested ? (
                        <button
                          onClick={() => handleStepRequest(def.type)}
                          className="mt-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                        >
                          {STEP_ENCOURAGEMENT[def.type].cta}
                          <ChevronRight size={11} />
                        </button>
                      ) : (
                        <p className="mt-1.5 text-[11px] font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Check size={11} />
                          Request sent — we'll follow up soon
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed state celebration */}
      {completedCount === totalCount && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-5 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-1">
            All milestones complete!
          </h3>
          <p className="text-sm text-gray-500 dark:text-dark-400 leading-relaxed">
            Your faithfulness is an inspiration. Thank you for being a vital part of our GRACE family.
          </p>
        </div>
      )}
    </div>
  );
}
