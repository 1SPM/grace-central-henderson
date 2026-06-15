import { useMemo } from 'react';
import type {
  Person,
  Task,
  Giving,
  Interaction,
  PrayerRequest,
  CalendarEvent,
  LeaderProfile,
  PastoralConversation,
} from '../types';
import type { ChurchSettings } from '../hooks/useChurchSettings';
import { TodayActionStrip } from './dashboard/TodayActionStrip';
import { ClockCalendarBanner } from './dashboard/ClockCalendarBanner';
import { DashboardCommandBar } from './dashboard/DashboardCommandBar';
import { DashboardPulse } from './dashboard/DashboardPulse';
import { DashboardDetails } from './dashboard/DashboardDetails';
import { GraceGettingStartedPanel } from './grace/GraceGettingStartedPanel';
import { MONDAY_BRIEF_PROMPT } from '../lib/grace-chat/adminQuickTags';
import { useGraceChat } from '../contexts/GraceChatContext';
import { useMailInboxStats } from '../hooks/useMailInboxStats';
import { usePortalActivity } from '../hooks/usePortalActivity';
import { useAuthContext } from '../contexts/AuthContext';
import { useChurchClock } from '../hooks/useChurchClock';
import { buildDashboardCalendarIndex } from '../lib/calendarEvents';
import { greetingWord, resolveAddressee } from '../lib/greeting';
import {
  buildDashboardMetricsFromInputs,
  buildHeroSubline,
  countDetailSections,
  findNextEventLabel,
} from '../lib/dashboardSummary';
import { CENTRAL_HENDERSON_TIMEZONE } from '../config/centralHenderson';

interface DashboardProps {
  churchId?: string;
  people: Person[];
  tasks: Task[];
  events?: CalendarEvent[];
  giving?: Giving[];
  interactions?: Interaction[];
  prayers?: PrayerRequest[];
  onViewPerson: (id: string) => void;
  onViewTasks: () => void;
  onViewGiving?: () => void;
  onViewPeople?: () => void;
  onViewVisitors?: () => void;
  onViewInactive?: () => void;
  onViewActions?: () => void;
  onViewCalendar?: () => void;
  onViewAnalytics?: () => void;
  churchSettings?: ChurchSettings;
  onNavigate?: (view: string) => void;
  onDismissGraceIntro?: () => void;
  onOpenTutorials?: () => void;
  leaders?: LeaderProfile[];
  onViewLeaders?: () => void;
  careConversations?: PastoralConversation[];
}

export function Dashboard({
  churchId,
  people,
  tasks,
  events = [],
  giving = [],
  prayers = [],
  onViewPerson,
  onViewTasks,
  onViewGiving,
  onViewPeople,
  onViewVisitors,
  onViewInactive,
  onViewActions,
  onViewCalendar,
  churchSettings,
  onNavigate,
  onDismissGraceIntro,
  onOpenTutorials,
  careConversations = [],
}: DashboardProps) {
  const grace = useGraceChat();
  const mailStats = useMailInboxStats();
  const portalActivity = usePortalActivity(churchId ?? '');
  const { user } = useAuthContext();
  const churchName = churchSettings?.profile?.name || 'Central Henderson Church';
  const timezone = churchSettings?.timezone || CENTRAL_HENDERSON_TIMEZONE;
  const { zoned, churchTodayKey } = useChurchClock(timezone);
  const greeting = greetingWord(zoned.hour24);
  const addressee = resolveAddressee(user?.firstName, user?.role);

  const calendarIndex = useMemo(
    () => buildDashboardCalendarIndex(events, zoned.year),
    [events, zoned.year],
  );

  const { visitors } = useMemo(
    () => ({
      visitors: people.filter(p => p.status === 'visitor'),
    }),
    [people],
  );

  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  const peopleSparkline = useMemo(() => {
    const now = new Date();
    const weeks = 7;
    const counts: number[] = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - w * 7);
      const weekEndStr = weekEnd.toISOString();
      counts.push(
        people.filter(p => (p.joinDate || p.firstVisit || '') <= weekEndStr).length || people.length,
      );
    }
    counts[weeks - 1] = people.length;
    return counts;
  }, [people]);

  const mailBacklog = mailStats.needsReview + mailStats.flagged;
  const metrics = useMemo(
    () =>
      buildDashboardMetricsFromInputs(people, tasks, giving, careConversations, {
        people,
        tasks,
        prayers,
        mailNeedsReview: mailStats.needsReview,
        mailFlagged: mailStats.flagged,
        hideMail: mailBacklog > 0,
      }),
    [people, tasks, giving, careConversations, prayers, mailStats, mailBacklog],
  );

  const heroSubline = useMemo(() => {
    const nextEvent = findNextEventLabel(calendarIndex.eventsByDay, churchTodayKey);
    return buildHeroSubline(metrics.attentionCount, nextEvent);
  }, [calendarIndex.eventsByDay, churchTodayKey, metrics.attentionCount]);

  const detailSectionCount = countDetailSections(
    metrics.fundTotalsMtd,
    metrics.openCare,
    metrics.newMembersThisWeek,
  );

  const portalActive7d = churchId && !portalActivity.isDemo ? portalActivity.summary.activeMembers7d : null;
  const portalLogins7d = churchId && !portalActivity.isDemo ? portalActivity.summary.logins7d : null;

  const workQueue = onViewActions ?? onViewTasks;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <DashboardCommandBar
        greeting={greeting}
        addressee={addressee}
        churchName={churchName}
        heroSubline={heroSubline}
        mailBacklog={mailBacklog}
        mailFlagged={mailStats.flagged}
        onAskGrace={() => grace.openPanel()}
        onBrief={() => grace.openPanel(MONDAY_BRIEF_PROMPT)}
        onAddPerson={onViewPeople}
        onWorkQueue={workQueue}
        onMail={() => onNavigate?.('mail')}
        onSundayPrep={() => onNavigate?.('sunday-prep')}
        onOpenTutorials={onOpenTutorials}
      />

      <ClockCalendarBanner
        className="mb-6"
        eventDays={calendarIndex.eventDays}
        eventsByDay={calendarIndex.eventsByDay}
        onOpenCalendar={onViewCalendar}
        timezone={timezone}
        actionStrip={
          <TodayActionStrip
            people={people}
            tasks={tasks}
            events={events}
            prayers={prayers}
            mailNeedsReview={mailStats.needsReview}
            mailFlagged={mailStats.flagged}
            hideMail={mailBacklog > 0}
            onViewTasks={workQueue}
            onViewAllActions={workQueue}
            onViewVisitors={onViewVisitors}
            onViewInactive={onViewInactive}
            onViewCalendar={onViewCalendar}
            onNavigate={onNavigate}
            variant="embedded"
          />
        }
      />

      {!churchSettings?.onboarding?.graceIntroDismissed && onDismissGraceIntro && (
        <GraceGettingStartedPanel churchName={churchName} onDismiss={onDismissGraceIntro} />
      )}

      <DashboardPulse
        metrics={metrics}
        peopleCount={people.length}
        visitorsCount={visitors.length}
        peopleSparkline={peopleSparkline}
        portalActive7d={portalActive7d}
        portalLogins7d={portalLogins7d}
        onViewPeople={onViewPeople}
        onViewGiving={onViewGiving}
        onViewPastoralCare={() => onNavigate?.('pastoral-care')}
        onViewPortalActivity={() => onNavigate?.('portal-activity')}
      />

      <DashboardDetails
        fundTotalsMtd={metrics.fundTotalsMtd}
        openCare={metrics.openCare}
        newMembersThisWeek={metrics.newMembersThisWeek}
        personMap={personMap}
        sectionCount={detailSectionCount}
        onViewGiving={onViewGiving}
        onViewPastoralCare={() => onNavigate?.('pastoral-care')}
        onViewPeople={onViewPeople}
        onViewPerson={onViewPerson}
      />
    </div>
  );
}
