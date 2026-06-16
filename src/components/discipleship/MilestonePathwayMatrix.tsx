import { useState, useMemo } from 'react';
import {
  DoorOpen,
  BookOpen,
  Droplets,
  Users,
  Heart,
  Crown,
  Check,
  Search,
  Smartphone,
  MapPin,
  Star,
} from 'lucide-react';
import type { Person, DiscipleshipMilestone, MilestoneType } from '../../types';
import { DEFAULT_MILESTONE_DEFINITIONS } from '../../types';
import type { MemberEngagementRow } from '../../hooks/usePortalActivity';
import type { MemberActivityEvent } from '../../lib/database.types';

const MILESTONE_ICONS: Record<MilestoneType, typeof DoorOpen> = {
  first_visit: DoorOpen,
  attended_class: BookOpen,
  baptized: Droplets,
  joined_group: Users,
  serving: Heart,
  leading: Crown,
};

const MILESTONE_COLORS: Record<MilestoneType, string> = {
  first_visit: 'text-blue-500',
  attended_class: 'text-slate-500',
  baptized: 'text-cyan-500',
  joined_group: 'text-green-500',
  serving: 'text-amber-500',
  leading: 'text-rose-500',
};

type FilterStatus = 'all' | MilestoneType;

interface MilestonePathwayMatrixProps {
  people: Person[];
  milestones: DiscipleshipMilestone[];
  memberRollup: MemberEngagementRow[];
  portalEvents: MemberActivityEvent[];
  onAddMilestone: (data: { personId: string; milestoneType: MilestoneType; completedAt?: string }) => void;
  onRemoveMilestone: (id: string) => void;
  onViewPerson?: (id: string) => void;
}

export function MilestonePathwayMatrix({
  people,
  milestones,
  memberRollup,
  portalEvents,
  onAddMilestone,
  onRemoveMilestone,
  onViewPerson,
}: MilestonePathwayMatrixProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const engagementMap = useMemo(
    () => new Map(memberRollup.map(r => [r.personId, r])),
    [memberRollup],
  );

  const stepRequestsByPerson = useMemo(() => {
    const map = new Map<string, Set<string>>();
    portalEvents
      .filter(e => e.event_type === 'milestone_step_request' && e.person_id)
      .forEach(e => {
        const type = String(e.metadata?.milestone_type ?? '');
        if (!type) return;
        if (!map.has(e.person_id!)) map.set(e.person_id!, new Set());
        map.get(e.person_id!)!.add(type);
      });
    return map;
  }, [portalEvents]);

  const milestonesByPerson = useMemo(() => {
    const map = new Map<string, Map<MilestoneType, DiscipleshipMilestone>>();
    milestones.forEach(m => {
      if (!map.has(m.personId)) map.set(m.personId, new Map());
      map.get(m.personId)!.set(m.milestoneType as MilestoneType, m);
    });
    return map;
  }, [milestones]);

  const stats = useMemo(() => {
    const totalPeople = people.length;
    return DEFAULT_MILESTONE_DEFINITIONS.map(def => {
      const count = people.filter(p => milestonesByPerson.get(p.id)?.has(def.type)).length;
      return {
        ...def,
        count,
        pct: totalPeople > 0 ? Math.round((count / totalPeople) * 100) : 0,
      };
    });
  }, [people, milestonesByPerson]);

  const filteredPeople = useMemo(() => {
    let list = people;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
      );
    }

    if (filterStatus !== 'all') {
      list = list.filter(p => milestonesByPerson.get(p.id)?.has(filterStatus));
    }

    return list.sort((a, b) => {
      const aCount = milestonesByPerson.get(a.id)?.size || 0;
      const bCount = milestonesByPerson.get(b.id)?.size || 0;
      return bCount - aCount;
    });
  }, [people, search, filterStatus, milestonesByPerson]);

  const toggleMilestone = (personId: string, type: MilestoneType) => {
    const personMilestones = milestonesByPerson.get(personId);
    const existing = personMilestones?.get(type);

    if (existing) {
      onRemoveMilestone(existing.id);
    } else {
      onAddMilestone({ personId, milestoneType: type });
    }
  };

  return (
    <div>
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map(s => {
          const Icon = MILESTONE_ICONS[s.type];
          return (
            <button
              key={s.type}
              onClick={() => setFilterStatus(filterStatus === s.type ? 'all' : s.type)}
              className={`bg-stone-100 dark:bg-dark-850 rounded-xl border p-3 text-center transition-all ${
                filterStatus === s.type
                  ? 'border-indigo-500 ring-1 ring-indigo-500'
                  : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
              }`}
            >
              <Icon size={18} className={`mx-auto mb-1 ${MILESTONE_COLORS[s.type]}`} />
              <p className="text-lg font-bold text-gray-900 dark:text-dark-100">{s.pct}%</p>
              <p className="text-[10px] text-gray-500 dark:text-dark-400">{s.label}</p>
              <p className="text-[9px] text-gray-400 dark:text-dark-500">{s.count}/{people.length}</p>
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full pl-9 pr-4 py-2.5 bg-stone-100 dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-xl text-sm text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-stone-100 dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-dark-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider bg-gray-50 dark:bg-dark-800 sticky left-0 z-10">
                  Name
                </th>
                {DEFAULT_MILESTONE_DEFINITIONS.map(def => {
                  const Icon = MILESTONE_ICONS[def.type];
                  return (
                    <th key={def.type} className="px-3 py-3 text-center bg-gray-50 dark:bg-dark-800">
                      <div className="flex flex-col items-center gap-0.5">
                        <Icon size={14} className={MILESTONE_COLORS[def.type]} />
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-dark-400">{def.label}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-3 text-center bg-gray-50 dark:bg-dark-800 min-w-[120px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <Smartphone size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-dark-400">Portal Signals</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
              {filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400 dark:text-dark-500">
                    No people found
                  </td>
                </tr>
              ) : (
                filteredPeople.slice(0, 50).map(person => {
                  const personMilestones = milestonesByPerson.get(person.id);
                  const engagement = engagementMap.get(person.id);
                  const stepRequests = stepRequestsByPerson.get(person.id);
                  const hasStepRequests = stepRequests && stepRequests.size > 0;
                  return (
                    <tr key={person.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50">
                      <td className="px-4 py-3 sticky left-0 bg-stone-100 dark:bg-dark-850 z-10">
                        <button
                          onClick={() => onViewPerson?.(person.id)}
                          className="flex items-center gap-2.5 text-left hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-slate-500 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {person.firstName[0]}{person.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate max-w-[160px]">
                              {person.firstName} {person.lastName}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-dark-500 capitalize">{person.status}</p>
                          </div>
                        </button>
                      </td>
                      {DEFAULT_MILESTONE_DEFINITIONS.map(def => {
                        const milestone = personMilestones?.get(def.type);
                        const isCompleted = !!milestone;
                        const memberRequested = stepRequests?.has(def.type);
                        return (
                          <td key={def.type} className="px-3 py-3 text-center relative">
                            <button
                              onClick={() => toggleMilestone(person.id, def.type)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                isCompleted
                                  ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/20'
                                  : memberRequested
                                  ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/20 ring-1 ring-amber-400'
                                  : 'bg-gray-100 dark:bg-dark-700 text-gray-300 dark:text-dark-600 hover:bg-gray-200 dark:hover:bg-dark-600 hover:text-gray-400'
                              }`}
                              title={isCompleted
                                ? `${def.label}: ${new Date(milestone!.completedAt).toLocaleDateString()}`
                                : memberRequested
                                ? `${def.label}: Member has expressed interest — click to mark complete`
                                : `Mark ${def.label} as complete`
                              }
                            >
                              {memberRequested && !isCompleted ? <Star size={12} /> : <Check size={14} />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center">
                        {engagement ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <Smartphone size={11} className="text-indigo-500" />
                              <span className="text-xs font-semibold text-gray-700 dark:text-dark-300">
                                {engagement.eventCount30d}
                              </span>
                            </div>
                            {hasStepRequests && (
                              <div className="flex items-center gap-1">
                                <MapPin size={10} className="text-amber-500" />
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  Interested
                                </span>
                              </div>
                            )}
                            <span className="text-[9px] text-gray-400 dark:text-dark-600">
                              {engagement.byType?.journey_view
                                ? `${engagement.byType.journey_view} journey view${engagement.byType.journey_view > 1 ? 's' : ''}`
                                : 'No journey views'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300 dark:text-dark-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredPeople.length > 50 && (
          <div className="px-4 py-3 text-center text-xs text-gray-400 dark:text-dark-500 border-t border-gray-100 dark:border-dark-700">
            Showing 50 of {filteredPeople.length} people. Use search to narrow results.
          </div>
        )}
      </div>
    </div>
  );
}
