import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Home, Sparkles, Users, Users2 } from 'lucide-react';
import { PeopleList } from './PeopleList';
import { Groups } from './Groups';
import { ListSkeleton } from './ui/ViewSkeleton';
import { CENTRAL_HENDERSON_LEADERS } from '../config/centralHendersonLeaders';
import { countLeadershipBadges } from '../hooks/useLeadershipRoster';

const SkillsDatabase = lazy(() => import('./SkillsDatabase').then(m => ({ default: m.SkillsDatabase })));
const Families = lazy(() => import('./Families').then(m => ({ default: m.Families })));
import {
  congregationHash,
  parseCongregationTab,
  type CongregationTab,
} from '../lib/congregationNav';
import type { Person, SmallGroup } from '../types';

interface CongregationProps {
  people: Person[];
  groups: SmallGroup[];
  churchId?: string;
  onViewPerson: (id: string) => void;
  onAddPerson: () => void;
  onBulkUpdateStatus?: (ids: string[], status: Person['status']) => void;
  onBulkAddTag?: (ids: string[], tag: string) => void;
  onImportCSV?: (people: Partial<Person>[]) => Promise<void>;
  onCreateGroup?: (group: Omit<SmallGroup, 'id'>) => void;
  onAddMember?: (groupId: string, personId: string) => void;
  onRemoveMember?: (groupId: string, personId: string) => void;
  onEmailGroup?: (groupId: string) => void;
  onUpdatePerson?: (person: Person) => Promise<void>;
  defaultTab?: CongregationTab;
}

const TABS: { id: CongregationTab; label: string; icon: typeof Users }[] = [
  { id: 'directory', label: 'Directory', icon: Users },
  { id: 'groups', label: 'Groups', icon: Users2 },
  { id: 'skills', label: 'Skills & Talents', icon: Sparkles },
  { id: 'families', label: 'Families', icon: Home },
];

export function Congregation({
  people,
  groups,
  churchId,
  onViewPerson,
  onAddPerson,
  onBulkUpdateStatus,
  onBulkAddTag,
  onImportCSV,
  onCreateGroup,
  onAddMember,
  onRemoveMember,
  onEmailGroup,
  onUpdatePerson,
  defaultTab,
}: CongregationProps) {
  const initial = useMemo(() => defaultTab ?? parseCongregationTab(), [defaultTab]);
  const [tab, setTab] = useState<CongregationTab>(initial);
  const activeGroupCount = useMemo(() => groups.filter(g => g.isActive).length, [groups]);
  const familyCount = useMemo(
    () => new Set(people.filter(p => p.familyId).map(p => p.familyId)).size,
    [people],
  );
  const centralStaffKpi = useMemo(() => countLeadershipBadges(CENTRAL_HENDERSON_LEADERS), []);

  useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (defaultTab === 'groups' || defaultTab === 'skills' || defaultTab === 'families') {
      window.history.replaceState(null, '', congregationHash(defaultTab));
    }
  }, [defaultTab]);

  const syncTabFromHash = useCallback(() => {
    setTab(parseCongregationTab());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncTabFromHash);
    window.addEventListener('popstate', syncTabFromHash);
    return () => {
      window.removeEventListener('hashchange', syncTabFromHash);
      window.removeEventListener('popstate', syncTabFromHash);
    };
  }, [syncTabFromHash]);

  const selectTab = (next: CongregationTab) => {
    setTab(next);
    window.history.replaceState(null, '', congregationHash(next));
  };

  return (
    <div className="flex flex-col min-h-full bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900">
      <div className="shrink-0 border-b border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 pt-4 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center">
                <Users className="text-white" size={20} />
              </div>
              <div>
                <h1 className="serif text-2xl sm:text-3xl text-slate-900 dark:text-dark-100 leading-none">
                  Congregation
                </h1>
                <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                  {people.length} people · {activeGroupCount} active groups · {familyCount} households
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
              <span className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                {centralStaffKpi.staff} central staff
              </span>
              <span className="px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">
                {centralStaffKpi.aiDeployed} AI companions active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tab === id
                    ? 'border-slate-900 dark:border-dark-100 text-slate-900 dark:text-dark-100 font-medium'
                    : 'border-transparent text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200'
                }`}
              >
                <Icon size={14} />
                {label}
                {id === 'groups' && activeGroupCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                    {activeGroupCount}
                  </span>
                )}
                {id === 'families' && familyCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    {familyCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'directory' && (
          <PeopleList
            embedded
            people={people}
            onViewPerson={onViewPerson}
            onAddPerson={onAddPerson}
            onBulkUpdateStatus={onBulkUpdateStatus}
            onBulkAddTag={onBulkAddTag}
            onImportCSV={onImportCSV}
          />
        )}
        {tab === 'groups' && (
          <Groups
            embedded
            groups={groups}
            people={people}
            churchId={churchId}
            onCreateGroup={onCreateGroup}
            onAddMember={onAddMember}
            onRemoveMember={onRemoveMember}
            onEmailGroup={onEmailGroup}
            onViewPerson={onViewPerson}
          />
        )}
        {tab === 'skills' && (
          <Suspense fallback={<ListSkeleton />}>
            <SkillsDatabase embedded people={people} onViewPerson={onViewPerson} />
          </Suspense>
        )}
        {tab === 'families' && onUpdatePerson && (
          <Suspense fallback={<ListSkeleton />}>
            <Families
              embedded
              people={people}
              onSelectPerson={onViewPerson}
              onUpdatePerson={onUpdatePerson}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
