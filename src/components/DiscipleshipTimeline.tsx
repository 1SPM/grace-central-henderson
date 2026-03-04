import { useState } from 'react';
import {
  DoorOpen,
  BookOpen,
  Droplets,
  Users,
  Heart,
  Crown,
  Check,
  X,
} from 'lucide-react';
import type { DiscipleshipMilestone, MilestoneType } from '../types';
import { DEFAULT_MILESTONE_DEFINITIONS } from '../types';

interface DiscipleshipTimelineProps {
  personId: string;
  milestones: DiscipleshipMilestone[];
  onAddMilestone: (data: { personId: string; milestoneType: MilestoneType; completedAt?: string; notes?: string }) => void;
  onRemoveMilestone?: (id: string) => void;
}

const MILESTONE_ICONS: Record<MilestoneType, typeof DoorOpen> = {
  first_visit: DoorOpen,
  attended_class: BookOpen,
  baptized: Droplets,
  joined_group: Users,
  serving: Heart,
  leading: Crown,
};

const MILESTONE_COLORS: Record<string, { bg: string; ring: string; text: string; fill: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/10', ring: 'ring-blue-500', text: 'text-blue-600 dark:text-blue-400', fill: 'bg-blue-500' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-500/10', ring: 'ring-purple-500', text: 'text-purple-600 dark:text-purple-400', fill: 'bg-purple-500' },
  cyan: { bg: 'bg-cyan-100 dark:bg-cyan-500/10', ring: 'ring-cyan-500', text: 'text-cyan-600 dark:text-cyan-400', fill: 'bg-cyan-500' },
  green: { bg: 'bg-green-100 dark:bg-green-500/10', ring: 'ring-green-500', text: 'text-green-600 dark:text-green-400', fill: 'bg-green-500' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-500/10', ring: 'ring-amber-500', text: 'text-amber-600 dark:text-amber-400', fill: 'bg-amber-500' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-500/10', ring: 'ring-rose-500', text: 'text-rose-600 dark:text-rose-400', fill: 'bg-rose-500' },
};

export function DiscipleshipTimeline({ personId, milestones, onAddMilestone, onRemoveMilestone }: DiscipleshipTimelineProps) {
  const [activePopover, setActivePopover] = useState<MilestoneType | null>(null);
  const [markDate, setMarkDate] = useState('');
  const [markNotes, setMarkNotes] = useState('');

  const milestoneMap = new Map(milestones.map(m => [m.milestoneType, m]));
  const completedCount = DEFAULT_MILESTONE_DEFINITIONS.filter(d => milestoneMap.has(d.type)).length;
  const totalCount = DEFAULT_MILESTONE_DEFINITIONS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const handleMark = (type: MilestoneType) => {
    onAddMilestone({
      personId,
      milestoneType: type,
      completedAt: markDate || new Date().toISOString(),
      notes: markNotes || undefined,
    });
    setActivePopover(null);
    setMarkDate('');
    setMarkNotes('');
  };

  return (
    <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Spiritual Journey</h2>
        <span className="text-xs font-medium text-gray-500 dark:text-dark-400 bg-gray-100 dark:bg-dark-700 px-2 py-1 rounded-full">
          {completedCount}/{totalCount} · {progressPct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 dark:bg-dark-700 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 dark:bg-dark-700" />

        <div className="relative flex justify-between">
          {DEFAULT_MILESTONE_DEFINITIONS.map((def) => {
            const milestone = milestoneMap.get(def.type);
            const isCompleted = !!milestone;
            const colors = MILESTONE_COLORS[def.color];
            const Icon = MILESTONE_ICONS[def.type];
            const isActive = activePopover === def.type;

            return (
              <div key={def.type} className="flex flex-col items-center relative" style={{ width: `${100 / totalCount}%` }}>
                {/* Circle */}
                <button
                  onClick={() => {
                    if (isCompleted) {
                      setActivePopover(isActive ? null : def.type);
                    } else {
                      setActivePopover(isActive ? null : def.type);
                    }
                  }}
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? `${colors.fill} text-white ring-2 ${colors.ring} ring-offset-2 ring-offset-white dark:ring-offset-dark-850 shadow-sm`
                      : 'bg-gray-200 dark:bg-dark-600 text-gray-400 dark:text-dark-500 hover:bg-gray-300 dark:hover:bg-dark-500'
                  }`}
                >
                  {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                </button>

                {/* Label */}
                <span className={`text-[10px] font-medium mt-2 text-center leading-tight ${
                  isCompleted ? colors.text : 'text-gray-400 dark:text-dark-500'
                }`}>
                  {def.label}
                </span>

                {/* Date */}
                {isCompleted && milestone && (
                  <span className="text-[9px] text-gray-400 dark:text-dark-500 mt-0.5">
                    {new Date(milestone.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}

                {/* Popover */}
                {isActive && (
                  <div className="absolute top-14 z-20 w-56 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-600 shadow-xl p-3" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-100">{def.label}</h4>
                      <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded">
                        <X size={14} className="text-gray-400" />
                      </button>
                    </div>

                    {isCompleted && milestone ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          Completed {new Date(milestone.completedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        {milestone.notes && (
                          <p className="text-xs text-gray-600 dark:text-dark-300 bg-gray-50 dark:bg-dark-700 p-2 rounded-lg">{milestone.notes}</p>
                        )}
                        {milestone.verifiedBy && (
                          <p className="text-[10px] text-gray-400 dark:text-dark-500">Verified by {milestone.verifiedBy}</p>
                        )}
                        {onRemoveMilestone && (
                          <button
                            onClick={() => { onRemoveMilestone(milestone.id); setActivePopover(null); }}
                            className="text-xs text-red-500 hover:text-red-600 mt-1"
                          >
                            Remove milestone
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={markDate}
                          onChange={e => setMarkDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg text-xs text-gray-900 dark:text-dark-100"
                        />
                        <input
                          type="text"
                          value={markNotes}
                          onChange={e => setMarkNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg text-xs text-gray-900 dark:text-dark-100"
                        />
                        <button
                          onClick={() => handleMark(def.type)}
                          className="w-full px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                        >
                          Mark Complete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
