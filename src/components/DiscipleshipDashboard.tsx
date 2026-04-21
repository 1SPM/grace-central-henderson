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
  TrendingUp,
} from 'lucide-react';
import type { Person, DiscipleshipMilestone, MilestoneType } from '../types';
import { DEFAULT_MILESTONE_DEFINITIONS } from '../types';

interface DiscipleshipDashboardProps {
  people: Person[];
  milestones: DiscipleshipMilestone[];
  onAddMilestone: (data: { personId: string; milestoneType: MilestoneType; completedAt?: string }) => void;
  onRemoveMilestone: (id: string) => void;
  onViewPerson?: (id: string) => void;
}

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

export function DiscipleshipDashboard({ people, milestones, onAddMilestone, onRemoveMilestone, onViewPerson }: DiscipleshipDashboardProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Build milestone lookup: personId -> Set of milestoneTypes
  const milestonesByPerson = useMemo(() => {
    const map = new Map<string, Map<MilestoneType, DiscipleshipMilestone>>();
    milestones.forEach(m => {
      if (!map.has(m.personId)) map.set(m.personId, new Map());
      map.get(m.personId)!.set(m.milestoneType as MilestoneType, m);
    });
    return map;
  }, [milestones]);

  // Stats
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

  // Filtered people
  const filteredPeople = useMemo(() => {
    let list = people;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') {
      list = list.filter(p => {
        const personMilestones = milestonesByPerson.get(p.id);
        return personMilestones?.has(filterStatus);
      });
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-slate-600 rounded-xl flex items-center justify-center">
          <TrendingUp className="text-white" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Discipleship Pathways</h1>
          <p className="text-sm text-gray-500 dark:text-dark-400">Track spiritual growth across your congregation</p>
        </div>
      </div>

      {/* Stats Bar */}
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

      {/* Search */}
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

      {/* Matrix Table */}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
              {filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 dark:text-dark-500">
                    No people found
                  </td>
                </tr>
              ) : (
                filteredPeople.slice(0, 50).map(person => {
                  const personMilestones = milestonesByPerson.get(person.id);
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
                        return (
                          <td key={def.type} className="px-3 py-3 text-center">
                            <button
                              onClick={() => toggleMilestone(person.id, def.type)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                isCompleted
                                  ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/20'
                                  : 'bg-gray-100 dark:bg-dark-700 text-gray-300 dark:text-dark-600 hover:bg-gray-200 dark:hover:bg-dark-600 hover:text-gray-400'
                              }`}
                              title={isCompleted
                                ? `${def.label}: ${new Date(milestone!.completedAt).toLocaleDateString()}`
                                : `Mark ${def.label} as complete`
                              }
                            >
                              <Check size={14} />
                            </button>
                          </td>
                        );
                      })}
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
