import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Heart,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/validation';
import type { Person, PastoralConversation, HelpCategory } from '../../types';

const CARE_CATEGORY_LABELS: Record<HelpCategory, string> = {
  marriage: 'Marriage',
  addiction: 'Recovery',
  grief: 'Grief',
  'faith-questions': 'Faith',
  crisis: 'Crisis',
  financial: 'Financial',
  'anxiety-depression': 'Mental Health',
  parenting: 'Parenting',
  general: 'General',
};

interface DashboardDetailsProps {
  fundTotalsMtd: { fund: string; amount: number }[];
  openCare: PastoralConversation[];
  newMembersThisWeek: Person[];
  personMap: Map<string, Person>;
  sectionCount: number;
  onViewGiving?: () => void;
  onViewPastoralCare?: () => void;
  onViewPeople?: () => void;
  onViewPerson: (id: string) => void;
}

export function DashboardDetails({
  fundTotalsMtd,
  openCare,
  newMembersThisWeek,
  personMap,
  sectionCount,
  onViewGiving,
  onViewPastoralCare,
  onViewPeople,
  onViewPerson,
}: DashboardDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  if (sectionCount === 0) return null;

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 dark:border-dark-700 bg-white dark:bg-dark-850 hover:bg-stone-50 dark:hover:bg-dark-800 transition-colors text-left"
      >
        <span className="text-sm font-medium text-slate-800 dark:text-dark-100">
          More on your church
          <span className="text-gray-500 dark:text-dark-400 font-normal ml-2">
            ({sectionCount} section{sectionCount === 1 ? '' : 's'})
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {fundTotalsMtd.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-dark-700 p-4 bg-stone-50/50 dark:bg-dark-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Giving by fund</h2>
                </div>
                {onViewGiving && (
                  <button
                    type="button"
                    onClick={onViewGiving}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
                  >
                    Impact Campaigns <ArrowRight size={12} />
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                {fundTotalsMtd.map(({ fund, amount }) => {
                  const max = fundTotalsMtd[0].amount || 1;
                  return (
                    <div key={fund}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-dark-300 capitalize">{fund}</span>
                        <span className="font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                          ${amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${(amount / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {openCare.length > 0 && (
            <div data-tutorial="dashboard-tasks" className="rounded-xl border border-gray-200 dark:border-dark-700 p-4 bg-stone-50/50 dark:bg-dark-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Heart size={15} className="text-rose-500" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Recent care requests</h2>
                </div>
                {onViewPastoralCare && (
                  <button
                    type="button"
                    onClick={onViewPastoralCare}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
                  >
                    Dispatch <ArrowRight size={12} />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {openCare.slice(0, 4).map(conv => {
                  const lastMessage = conv.messages[conv.messages.length - 1];
                  const person = conv.personId ? personMap.get(conv.personId) : undefined;
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={onViewPastoralCare}
                      className="w-full p-2.5 rounded-lg bg-white dark:bg-dark-850 hover:bg-gray-50 dark:hover:bg-dark-750 border border-stone-200 dark:border-dark-700 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                          {conv.isAnonymous ? 'Anonymous' : person ? `${person.firstName} ${person.lastName}` : 'Member'}
                        </p>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            conv.priority === 'crisis'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                              : conv.status === 'escalated'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                          }`}
                        >
                          {conv.priority === 'crisis' ? 'Crisis' : CARE_CATEGORY_LABELS[conv.category]}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-dark-400 truncate mt-0.5">
                        {lastMessage ? lastMessage.content : `${CARE_CATEGORY_LABELS[conv.category]} request`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {newMembersThisWeek.length > 0 && (
            <div data-tutorial="dashboard-visitors" className="rounded-xl border border-gray-200 dark:border-dark-700 p-4 bg-stone-50/50 dark:bg-dark-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserPlus size={15} className="text-amber-600 dark:text-amber-400" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">New members</h2>
                </div>
                {onViewPeople && (
                  <button
                    type="button"
                    onClick={onViewPeople}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
                  >
                    Congregation <ArrowRight size={12} />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {newMembersThisWeek.map(person => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onViewPerson(person.id)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-dark-750 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/10 rounded-full flex items-center justify-center text-amber-700 dark:text-amber-400 text-xs font-medium">
                        {person.firstName[0]}
                        {person.lastName[0]}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-dark-500">
                          Joined {formatLocalDate(person.joinDate, 'recently')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 dark:text-dark-600 group-hover:text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
