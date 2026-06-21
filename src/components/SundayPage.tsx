import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar as CalendarIcon, Church, Megaphone, UserCheck } from 'lucide-react';
import { SundayPrep } from './SundayPrep';
import { ListSkeleton } from './ui/ViewSkeleton';
import {
  parseSundayArchiveFilter,
  parseSundayTab,
  sundayHash,
  type SundayArchiveFilter,
  type SundayTab,
} from '../lib/sundayNav';
import type { ConnectSubjectKind } from '../config/sermonConnectSubjects';
import type { ChurchProfile } from '../hooks/useChurchSettings';
import type { Announcement, AnnouncementCategory, Attendance, CalendarEvent, Person, PrayerRequest } from '../types';
import type { RSVP } from './calendar/CalendarConstants';

const Calendar = lazy(() => import('./Calendar').then(m => ({ default: m.Calendar })));
const AttendanceCheckIn = lazy(() => import('./AttendanceCheckIn').then(m => ({ default: m.AttendanceCheckIn })));
const AnnouncementManager = lazy(() => import('./AnnouncementManager').then(m => ({ default: m.AnnouncementManager })));
const SermonArchive = lazy(() => import('./sunday/SermonArchive').then(m => ({ default: m.SermonArchive })));

interface SundayPageProps {
  churchId: string;
  people: Person[];
  prayers: PrayerRequest[];
  events: CalendarEvent[];
  rsvps: RSVP[];
  churchName?: string;
  churchProfile?: ChurchProfile;
  timezone?: string;
  onViewPerson: (personId: string) => void;
  onRSVP: (eventId: string, personId: string, status: RSVP['status'], guestCount?: number, source?: 'portal' | 'admin') => void;
  onAddEvent?: (event: {
    title: string;
    description?: string;
    startDate: string;
    endDate?: string;
    allDay: boolean;
    location?: string;
    category: CalendarEvent['category'];
  }) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (eventId: string) => void;
  defaultTab?: SundayTab;
  attendanceRecords?: Attendance[];
  onCheckIn?: (personId: string, eventType: Attendance['eventType'], eventName?: string) => void;
  announcements?: Announcement[];
  onAddAnnouncement?: (data: { title: string; body?: string; category: AnnouncementCategory; pinned: boolean; expiresAt?: string }) => void;
  onUpdateAnnouncement?: (id: string, data: Partial<Omit<Announcement, 'id' | 'churchId' | 'createdAt'>>) => void;
  onDeleteAnnouncement?: (id: string) => void;
}

const TABS: { id: SundayTab; label: string; icon: typeof Church }[] = [
  { id: 'prep', label: 'Sunday Prep', icon: Church },
  { id: 'archive', label: 'Archive', icon: BookOpen },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
];

export function SundayPage({
  churchId: _churchId,
  people,
  prayers,
  events,
  rsvps,
  churchName = 'Church',
  churchProfile: _churchProfile,
  timezone: _timezone,
  onViewPerson,
  onRSVP,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  defaultTab,
  attendanceRecords = [],
  onCheckIn,
  announcements = [],
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
}: SundayPageProps) {
  const initial = useMemo(() => defaultTab ?? parseSundayTab(), [defaultTab]);
  const [tab, setTab] = useState<SundayTab>(initial);
  const [archiveFilter, setArchiveFilter] = useState<SundayArchiveFilter>(() => parseSundayArchiveFilter());
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const upcomingCount = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.startDate) >= now).length;
  }, [events]);
  const todayAttendanceCount = useMemo(
    () => attendanceRecords.filter(a => a.date === today && a.eventType === 'sunday').length,
    [attendanceRecords, today],
  );

  useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (defaultTab === 'calendar' || defaultTab === 'attendance' || defaultTab === 'announcements') {
      window.history.replaceState(null, '', sundayHash(defaultTab));
    }
  }, [defaultTab]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const base = hash.split('?')[0].split('/')[0];
    if (base === 'attendance') {
      window.history.replaceState(null, '', sundayHash('attendance'));
      setTab('attendance');
    } else if (base === 'announcements') {
      window.history.replaceState(null, '', sundayHash('announcements'));
      setTab('announcements');
    }
  }, []);

  const syncTabFromHash = useCallback(() => {
    setTab(parseSundayTab());
    setArchiveFilter(parseSundayArchiveFilter());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncTabFromHash);
    window.addEventListener('popstate', syncTabFromHash);
    return () => {
      window.removeEventListener('hashchange', syncTabFromHash);
      window.removeEventListener('popstate', syncTabFromHash);
    };
  }, [syncTabFromHash]);

  const selectTab = (next: SundayTab, filter?: SundayArchiveFilter) => {
    setTab(next);
    if (next === 'archive') {
      const nextFilter = filter ?? {};
      setArchiveFilter(nextFilter);
      window.history.replaceState(null, '', sundayHash(next, nextFilter));
    } else {
      setArchiveFilter({});
      window.history.replaceState(null, '', sundayHash(next));
    }
  };

  const browseArchive = (kind: ConnectSubjectKind) => {
    selectTab('archive', { kind });
  };

  const clearArchiveFilter = () => {
    setArchiveFilter({});
    window.history.replaceState(null, '', sundayHash('archive'));
  };

  return (
    <div className="flex flex-col min-h-full bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900">
      <div className="shrink-0 border-b border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-700 rounded-xl flex items-center justify-center">
              <Church className="text-white" size={20} />
            </div>
            <div>
              <h1 className="serif text-2xl sm:text-3xl text-slate-900 dark:text-dark-100 leading-none">
                Sunday Service Tools
              </h1>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                Prep, archive, attendance, announcements & calendar · {upcomingCount} upcoming events
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
                {id === 'calendar' && events.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    {events.length}
                  </span>
                )}
                {id === 'attendance' && todayAttendanceCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300">
                    {todayAttendanceCount}
                  </span>
                )}
                {id === 'announcements' && announcements.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300">
                    {announcements.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'prep' && (
          <div className="p-6 max-w-6xl mx-auto">
            <SundayPrep
              embedded
              churchId={_churchId}
              people={people}
              prayers={prayers}
              onViewPerson={onViewPerson}
              onBrowseArchive={browseArchive}
            />
          </div>
        )}
        {tab === 'archive' && (
          <Suspense fallback={<ListSkeleton />}>
            <SermonArchive
              churchId={_churchId}
              initialKind={archiveFilter.kind}
              initialFilter={archiveFilter.filter}
              onClearFilter={clearArchiveFilter}
            />
          </Suspense>
        )}
        {tab === 'attendance' && onCheckIn && (
          <Suspense fallback={<ListSkeleton />}>
            <AttendanceCheckIn
              embedded
              people={people}
              attendance={attendanceRecords}
              onCheckIn={onCheckIn}
            />
          </Suspense>
        )}
        {tab === 'announcements' && onAddAnnouncement && onUpdateAnnouncement && onDeleteAnnouncement && (
          <Suspense fallback={<ListSkeleton />}>
            <AnnouncementManager
              embedded
              announcements={announcements}
              onAdd={onAddAnnouncement}
              onUpdate={onUpdateAnnouncement}
              onDelete={onDeleteAnnouncement}
            />
          </Suspense>
        )}
        {tab === 'calendar' && (
          <Suspense fallback={<ListSkeleton />}>
            <Calendar
              embedded
              events={events}
              people={people}
              rsvps={rsvps}
              churchName={churchName}
              onRSVP={onRSVP}
              onAddEvent={onAddEvent}
              onUpdateEvent={onUpdateEvent}
              onDeleteEvent={onDeleteEvent}
              onViewPerson={onViewPerson}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
