import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Cake, ListTodo, Mail, Radio, UserCheck, Zap } from 'lucide-react';
import { ActionFeed } from './ActionFeed';
import { MailInbox } from './MailInbox';
import { useMailInboxStats } from '../hooks/useMailInboxStats';
import { ListSkeleton } from './ui/ViewSkeleton';
import {
  actionCenterHash,
  parseActionCenterTab,
  type ActionCenterTab,
} from '../lib/actionCenterNav';
import type { ChurchProfile } from '../hooks/useChurchSettings';
import type { CalendarEvent, Person, PrayerRequest, Task, View } from '../types';
import { openCongregation } from '../lib/congregationNav';
import { openSunday } from '../lib/sundayNav';

const BirthdayCalendar = lazy(() => import('./BirthdayCalendar').then(m => ({ default: m.BirthdayCalendar })));
const LiveServiceDashboard = lazy(() =>
  import('./live-service/LiveServiceDashboard').then(m => ({ default: m.LiveServiceDashboard })),
);
const VolunteerScheduling = lazy(() => import('./VolunteerScheduling').then(m => ({ default: m.VolunteerScheduling })));

function birthdaysWithinDays(birthDate: string | undefined, days: number, now = new Date()): boolean {
  if (!birthDate) return false;
  const bday = new Date(birthDate);
  const year = now.getFullYear();
  let next = new Date(year, bday.getMonth(), bday.getDate());
  if (next < now) next = new Date(year + 1, bday.getMonth(), bday.getDate());
  const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= days;
}

interface VolunteerAssignment {
  id: string;
  eventId: string;
  roleId: string;
  personId: string;
  status: 'confirmed' | 'pending' | 'declined';
}

interface ActionCenterProps {
  churchId: string;
  churchName?: string;
  churchProfile?: ChurchProfile;
  timezone?: string;
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  events: CalendarEvent[];
  assignments: VolunteerAssignment[];
  onToggleTask: (taskId: string) => void;
  onSelectPerson: (personId: string) => void;
  onAssignVolunteer: (eventId: string, roleId: string, personId: string) => void;
  onUpdateVolunteerStatus: (assignmentId: string, status: VolunteerAssignment['status']) => void;
  onRemoveVolunteer: (assignmentId: string) => void;
  onNavigate?: (view: View) => void;
  defaultTab?: ActionCenterTab;
}

const TABS: { id: ActionCenterTab; label: string; icon: typeof ListTodo }[] = [
  { id: 'followups', label: 'Tasks & follow-ups', icon: ListTodo },
  { id: 'mail', label: 'Mail', icon: Mail },
  { id: 'birthdays', label: 'Birthdays', icon: Cake },
  { id: 'live', label: 'Live Service', icon: Radio },
  { id: 'volunteers', label: 'Volunteers', icon: UserCheck },
];

export function ActionCenter({
  churchId,
  churchName = 'Church',
  churchProfile,
  timezone,
  people,
  tasks,
  prayers,
  events,
  assignments,
  onToggleTask,
  onSelectPerson,
  onAssignVolunteer,
  onUpdateVolunteerStatus,
  onRemoveVolunteer,
  onNavigate,
  defaultTab,
}: ActionCenterProps) {
  const initial = useMemo(() => defaultTab ?? parseActionCenterTab(), [defaultTab]);
  const [tab, setTab] = useState<ActionCenterTab>(initial);
  const mailStats = useMailInboxStats();
  const mailBadge = mailStats.needsReview + mailStats.flagged;
  const birthdayBadge = useMemo(
    () => people.filter(p => birthdaysWithinDays(p.birthDate, 7)).length,
    [people],
  );
  const pendingVolunteers = useMemo(
    () => assignments.filter(a => a.status === 'pending').length,
    [assignments],
  );

  useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (defaultTab && defaultTab !== 'followups') {
      window.history.replaceState(null, '', actionCenterHash(defaultTab));
    }
  }, [defaultTab]);

  const syncTabFromHash = useCallback(() => {
    setTab(parseActionCenterTab());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncTabFromHash);
    window.addEventListener('popstate', syncTabFromHash);
    return () => {
      window.removeEventListener('hashchange', syncTabFromHash);
      window.removeEventListener('popstate', syncTabFromHash);
    };
  }, [syncTabFromHash]);

  const selectTab = (next: ActionCenterTab) => {
    setTab(next);
    window.history.replaceState(null, '', actionCenterHash(next));
  };

  return (
    <div className="flex flex-col min-h-full bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900">
      <div className="shrink-0 border-b border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
              <Zap className="text-amber-300" size={20} />
            </div>
            <div>
              <h1 className="serif text-2xl sm:text-3xl text-slate-900 dark:text-dark-100 leading-none">
                Action Center
              </h1>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                Tasks, follow-ups, mail, birthdays, live service & volunteers — one place for pastoral operations.
              </p>
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
                {id === 'mail' && mailBadge > 0 && (
                  <span
                    className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full ${
                      mailStats.flagged > 0 ? 'bg-brand-500 text-white' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {mailBadge}
                  </span>
                )}
                {id === 'birthdays' && birthdayBadge > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300">
                    {birthdayBadge}
                  </span>
                )}
                {id === 'volunteers' && pendingVolunteers > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    {pendingVolunteers}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'followups' && (
          <ActionFeed
            people={people}
            tasks={tasks}
            onToggleTask={onToggleTask}
            onSelectPerson={onSelectPerson}
            embedded
          />
        )}
        {tab === 'mail' && (
          <MailInbox embedded people={people} tasks={tasks} prayers={prayers} onSelectPerson={onSelectPerson} />
        )}
        {tab === 'birthdays' && (
          <Suspense fallback={<ListSkeleton />}>
            <BirthdayCalendar embedded people={people} onViewPerson={onSelectPerson} />
          </Suspense>
        )}
        {tab === 'live' && (
          <Suspense fallback={<ListSkeleton />}>
            <LiveServiceDashboard
              embedded
              churchId={churchId}
              churchName={churchName}
              churchProfile={churchProfile}
              timezone={timezone}
              people={people}
              onViewPerson={onSelectPerson}
              onOpenSundayArchive={onNavigate ? () => openSunday('archive', onNavigate) : undefined}
              onCtaNavigate={
                onNavigate
                  ? cta => {
                      if (cta === 'followJesus') onNavigate('connect-card');
                      else if (cta === 'getConnected') openCongregation('groups', onNavigate);
                      else if (cta === 'giveOnline') onNavigate('giving');
                    }
                  : undefined
              }
            />
          </Suspense>
        )}
        {tab === 'volunteers' && (
          <Suspense fallback={<ListSkeleton />}>
            <VolunteerScheduling
              embedded
              people={people}
              events={events}
              assignments={assignments}
              churchName={churchName}
              onAssign={onAssignVolunteer}
              onUpdateStatus={onUpdateVolunteerStatus}
              onRemove={onRemoveVolunteer}
              onViewPerson={onSelectPerson}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
