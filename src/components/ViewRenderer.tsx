import { lazy, Suspense, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Dashboard } from './Dashboard';
import { ActionFeed } from './ActionFeed';
import { PeopleList } from './PeopleList';
import { PersonProfile } from './PersonProfile';
import { Tasks } from './Tasks';
import { NotFound } from './NotFound';
import { ErrorBoundary, CompactErrorFallback } from './ErrorBoundary';
import { ListSkeleton } from './ui/ViewSkeleton';
import { useChurchSettings } from '../hooks/useChurchSettings';
import { useRouteGuard } from '../hooks/useRouteGuard';
import type { View, Person, Task, Interaction, SmallGroup, PrayerRequest, CalendarEvent, Giving, Attendance, Campaign, Pledge, DonationBatch, GivingStatement, CharityBasket, BasketItem, BatchItem, LeaderProfile, HelpRequest, PastoralConversation, HelpCategory } from '../types';
import type { AgentConfig, LifeEventConfig, DonationProcessingConfig, NewMemberConfig, LifeEvent, AgentLog, AgentStats } from '../lib/agents/types';

// Lazy load less frequently used views for code splitting
const Calendar = lazy(() => import('./Calendar').then(m => ({ default: m.Calendar })));
const Groups = lazy(() => import('./Groups').then(m => ({ default: m.Groups })));
const Prayer = lazy(() => import('./Prayer').then(m => ({ default: m.Prayer })));
const GivingDashboard = lazy(() => import('./GivingDashboard').then(m => ({ default: m.GivingDashboard })));
const OnlineGivingForm = lazy(() => import('./OnlineGivingForm').then(m => ({ default: m.OnlineGivingForm })));
const BatchEntry = lazy(() => import('./BatchEntry').then(m => ({ default: m.BatchEntry })));
const PledgeManager = lazy(() => import('./PledgeManager').then(m => ({ default: m.PledgeManager })));
const GivingStatements = lazy(() => import('./GivingStatements').then(m => ({ default: m.GivingStatements })));
const Settings = lazy(() => import('./Settings').then(m => ({ default: m.Settings })));
const VisitorPipeline = lazy(() => import('./VisitorPipeline').then(m => ({ default: m.VisitorPipeline })));
const AttendanceCheckIn = lazy(() => import('./AttendanceCheckIn').then(m => ({ default: m.AttendanceCheckIn })));
const VolunteerScheduling = lazy(() => import('./VolunteerScheduling').then(m => ({ default: m.VolunteerScheduling })));
const TagsManager = lazy(() => import('./TagsManager').then(m => ({ default: m.TagsManager })));
const PrintableReports = lazy(() => import('./PrintableReports').then(m => ({ default: m.PrintableReports })));
const BirthdayCalendar = lazy(() => import('./BirthdayCalendar').then(m => ({ default: m.BirthdayCalendar })));
const CharityBaskets = lazy(() => import('./CharityBaskets').then(m => ({ default: m.CharityBaskets })));
const MemberDonationStats = lazy(() => import('./MemberDonationStats').then(m => ({ default: m.MemberDonationStats })));
const DonationTracker = lazy(() => import('./DonationTracker').then(m => ({ default: m.DonationTracker })));
const AgentDashboard = lazy(() => import('./AgentDashboard').then(m => ({ default: m.AgentDashboard })));
const ConnectCard = lazy(() => import('./ConnectCard').then(m => ({ default: m.ConnectCard })));
const MemberDirectory = lazy(() => import('./MemberDirectory').then(m => ({ default: m.MemberDirectory })));
const ChildCheckIn = lazy(() => import('./ChildCheckIn').then(m => ({ default: m.ChildCheckIn })));
const FormBuilder = lazy(() => import('./FormBuilder').then(m => ({ default: m.FormBuilder })));
const MemberPortalPreview = lazy(() => import('./member/MemberPortalPreview').then(m => ({ default: m.MemberPortalPreview })));
const SundayPrep = lazy(() => import('./SundayPrep').then(m => ({ default: m.SundayPrep })));
const Families = lazy(() => import('./Families').then(m => ({ default: m.Families })));
const SkillsDatabase = lazy(() => import('./SkillsDatabase').then(m => ({ default: m.SkillsDatabase })));
const EmailTemplateBuilder = lazy(() => import('./EmailTemplateBuilder').then(m => ({ default: m.EmailTemplateBuilder })));
const EventRegistration = lazy(() => import('./EventRegistration').then(m => ({ default: m.EventRegistration })));
const AutomatedReminders = lazy(() => import('./AutomatedReminders').then(m => ({ default: m.AutomatedReminders })));
const PlanningCenterImport = lazy(() => import('./PlanningCenterImport').then(m => ({ default: m.PlanningCenterImport })));
const QRCheckIn = lazy(() => import('./QRCheckIn').then(m => ({ default: m.QRCheckIn })));
const FollowUpAutomation = lazy(() => import('./FollowUpAutomation').then(m => ({ default: m.FollowUpAutomation })));
const PastoralCareDashboard = lazy(() => import('./pastoral/PastoralCareDashboard').then(m => ({ default: m.PastoralCareDashboard })));

/**
 * Wraps lazy-loaded views with both Suspense (for loading) and
 * ErrorBoundary (for render errors) so a failure in one view
 * doesn't crash the entire app.
 */
function SafeView({ children, skeleton }: { children: ReactNode; skeleton?: ReactNode }) {
  return (
    <ErrorBoundary fallback={<CompactErrorFallback />}>
      <Suspense fallback={skeleton || <ListSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
        <ShieldAlert className="text-red-500" size={32} />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100 mb-2">Access Denied</h2>
      <p className="text-gray-500 dark:text-dark-400 max-w-sm">{message}</p>
    </div>
  );
}

interface ViewRendererProps {
  view: View;
  setView: (view: View) => void;
  churchId: string;
  people: Person[];
  tasks: Task[];
  interactions: Interaction[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  events: CalendarEvent[];
  giving: Giving[];
  attendanceRecords: Attendance[];
  rsvps: { eventId: string; personId: string; status: 'yes' | 'no' | 'maybe'; guestCount: number }[];
  volunteerAssignments: { id: string; eventId: string; roleId: string; personId: string; status: 'confirmed' | 'pending' | 'declined' }[];
  selectedPerson?: Person;
  onOpenEmailSidebar?: (recipients?: string[], groupId?: string) => void;
  handlers: {
    viewPerson: (id: string) => void;
    backToPeople: () => void;
    addPerson: () => void;
    editPerson: (person: Person) => void;
    savePerson: (person: Omit<Person, 'id'> | Person) => Promise<void>;
    addInteraction: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => Promise<void>;
    addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
    toggleTask: (id: string) => Promise<void>;
    markPrayerAnswered: (id: string, testimony?: string) => Promise<void>;
    bulkUpdateStatus: (ids: string[], status: Person['status']) => Promise<void>;
    bulkAddTag: (ids: string[], tag: string) => Promise<void>;
    importCSV: (people: Partial<Person>[]) => Promise<void>;
    checkIn: (personId: string, eventType: Attendance['eventType'], eventName?: string) => void;
    rsvp: (eventId: string, personId: string, status: 'yes' | 'no' | 'maybe', guestCount?: number) => void;
    assignVolunteer: (eventId: string, roleId: string, personId: string) => void;
    updateVolunteerStatus: (assignmentId: string, status: 'confirmed' | 'pending' | 'declined') => void;
    removeVolunteer: (assignmentId: string) => void;
    updatePersonTags: (personId: string, tags: string[]) => Promise<void>;
    createGroup: (group: Omit<SmallGroup, 'id'>) => Promise<void>;
    addGroupMember: (groupId: string, personId: string) => Promise<void>;
    removeGroupMember: (groupId: string, personId: string) => Promise<void>;
    addEvent?: (event: {
      title: string;
      description?: string;
      startDate: string;
      endDate?: string;
      allDay: boolean;
      location?: string;
      category: CalendarEvent['category'];
    }) => Promise<void>;
    updateEvent?: (eventId: string, updates: Partial<CalendarEvent>) => Promise<void>;
    deleteEvent?: (eventId: string) => Promise<void>;
  };
  collectionMgmt: {
    campaigns: Campaign[];
    pledges: Pledge[];
    donationBatches: DonationBatch[];
    givingStatements: GivingStatement[];
    createBatch: (batch: Omit<DonationBatch, 'id'>) => void;
    addBatchItem: (item: Omit<BatchItem, 'id'>) => void;
    removeBatchItem: (itemId: string) => void;
    closeBatch: (batchId: string) => void;
    createCampaign: (campaign: Omit<Campaign, 'id'>) => void;
    updateCampaign: (id: string, updates: Partial<Campaign>) => void;
    createPledge: (pledge: Omit<Pledge, 'id'>) => void;
    updatePledge: (id: string, updates: Partial<Pledge>) => void;
    deletePledge: (id: string) => void;
    generateStatement: (personId: string, year: number) => void;
    sendStatement: (statementId: string, method: 'email' | 'print') => void;
  };
  charityBasketMgmt: {
    baskets: CharityBasket[];
    createBasket: (basket: Omit<CharityBasket, 'id' | 'createdAt' | 'items' | 'totalValue'>) => void;
    updateBasket: (id: string, updates: Partial<CharityBasket>) => void;
    deleteBasket: (id: string) => void;
    addItem: (basketId: string, item: Omit<BasketItem, 'id' | 'basketId' | 'donatedAt'>) => void;
    removeItem: (basketId: string, itemId: string) => void;
    distributeBasket: (basketId: string) => void;
  };
  agents: {
    lifeEventConfig: LifeEventConfig;
    donationConfig: DonationProcessingConfig;
    newMemberConfig: NewMemberConfig;
    upcomingLifeEvents: LifeEvent[];
    logs: AgentLog[];
    stats: { lifeEvent: AgentStats; donation: AgentStats; newMember: AgentStats };
    toggleAgent: (agentId: string, enabled: boolean) => void;
    updateConfig: (agentId: string, config: Partial<AgentConfig>) => void;
    runAgent: (agentId: string) => Promise<unknown>;
  };
  pastoralCare: {
    leaders: LeaderProfile[];
    helpRequests: HelpRequest[];
    conversations: PastoralConversation[];
    activeConversation?: PastoralConversation;
    activeLeader?: LeaderProfile;
    activeConversationId: string | null;
    createHelpRequest: (request: { category: HelpCategory; description?: string; isAnonymous: boolean }) => void;
    sendMessage: (conversationId: string, content: string) => void;
    resolveConversation: (conversationId: string) => void;
    escalateConversation: (conversationId: string) => void;
    setActiveConversationId: (id: string | null) => void;
    addLeader: (data: { displayName: string; title: string; bio: string; photo?: string; expertiseAreas: HelpCategory[]; credentials: string[]; yearsOfPractice?: number; personalityTraits: string[]; spiritualFocusAreas: string[]; language: string; sessionType: 'one-time' | 'recurring'; sessionFrequency: string; suitableFor: string[]; anchors: string }) => void;
    updateLeader: (leaderId: string, data: { displayName: string; title: string; bio: string; photo?: string; expertiseAreas: HelpCategory[]; credentials: string[]; yearsOfPractice?: number; personalityTraits: string[]; spiritualFocusAreas: string[]; language: string; sessionType: 'one-time' | 'recurring'; sessionFrequency: string; suitableFor: string[]; anchors: string }) => void;
    deleteLeader: (leaderId: string) => void;
    toggleLeaderAvailability: (leaderId: string) => void;
  };
}

export function ViewRenderer(props: ViewRendererProps) {
  const { view, setView, churchId, people, tasks, interactions, giving, groups, prayers, events,
    attendanceRecords, rsvps, volunteerAssignments, selectedPerson, handlers,
    collectionMgmt, charityBasketMgmt, agents, pastoralCare, onOpenEmailSidebar } = props;

  const { settings } = useChurchSettings(churchId);
  const churchName = settings?.profile?.name || 'Grace Church';
  const { getBlockedMessage } = useRouteGuard();

  // Role-based access check
  const blockedMessage = getBlockedMessage(view);
  if (blockedMessage) {
    return <AccessDenied message={blockedMessage} />;
  }

  // Core views (not lazy loaded for instant response)
  switch (view) {
    case 'dashboard':
      return (
        <Dashboard
          people={people}
          tasks={tasks}
          events={events}
          giving={giving}
          interactions={interactions}
          prayers={prayers}
          onViewPerson={handlers.viewPerson}
          onViewTasks={() => setView('tasks')}
          onViewGiving={() => setView('giving')}
          onViewPeople={() => setView('people')}
          onViewVisitors={() => setView('pipeline')}
          onViewInactive={() => setView('people')}
          onViewActions={() => setView('feed')}
          onViewCalendar={() => setView('calendar')}
        />
      );

    case 'feed':
      return (
        <ActionFeed
          people={people}
          tasks={tasks}
          onToggleTask={handlers.toggleTask}
          onSelectPerson={handlers.viewPerson}
        />
      );

    case 'people':
      return (
        <PeopleList
          people={people}
          onViewPerson={handlers.viewPerson}
          onAddPerson={handlers.addPerson}
          onBulkUpdateStatus={handlers.bulkUpdateStatus}
          onBulkAddTag={handlers.bulkAddTag}
          onImportCSV={handlers.importCSV}
        />
      );

    case 'person':
      if (!selectedPerson) {
        setView('people');
        return null;
      }
      return (
        <PersonProfile
          person={selectedPerson}
          interactions={interactions}
          tasks={tasks}
          giving={giving}
          groups={groups}
          onBack={handlers.backToPeople}
          onAddInteraction={handlers.addInteraction}
          onAddTask={handlers.addTask}
          onToggleTask={handlers.toggleTask}
          onEditPerson={handlers.editPerson}
          onViewAllGiving={() => setView('giving')}
          onAddToGroup={handlers.addGroupMember}
          onRemoveFromGroup={handlers.removeGroupMember}
          onSendEmail={onOpenEmailSidebar ? () => onOpenEmailSidebar([selectedPerson.id]) : undefined}
        />
      );

    case 'tasks':
      return <Tasks tasks={tasks} people={people} onToggleTask={handlers.toggleTask} onAddTask={handlers.addTask} />;
  }

  // Lazy-loaded views wrapped in SafeView (Suspense + ErrorBoundary)
  return (
    <SafeView>
      {renderLazyView()}
    </SafeView>
  );

  function renderLazyView() {
    switch (view) {
      case 'pipeline':
        return <VisitorPipeline people={people} onViewPerson={handlers.viewPerson} />;

      case 'attendance':
        return <AttendanceCheckIn people={people} attendance={attendanceRecords} onCheckIn={handlers.checkIn} />;

      case 'calendar':
        return (
          <Calendar
            events={events}
            people={people}
            rsvps={rsvps}
            churchName={churchName}
            onRSVP={handlers.rsvp}
            onAddEvent={handlers.addEvent}
            onUpdateEvent={handlers.updateEvent}
            onDeleteEvent={handlers.deleteEvent}
            onViewPerson={handlers.viewPerson}
          />
        );

      case 'volunteers':
        return (
          <VolunteerScheduling
            people={people}
            events={events}
            assignments={volunteerAssignments}
            onAssign={handlers.assignVolunteer}
            onUpdateStatus={handlers.updateVolunteerStatus}
            onRemove={handlers.removeVolunteer}
          />
        );

      case 'groups':
        return (
          <Groups
            groups={groups}
            people={people}
            onCreateGroup={handlers.createGroup}
            onAddMember={handlers.addGroupMember}
            onRemoveMember={handlers.removeGroupMember}
            onEmailGroup={onOpenEmailSidebar ? (groupId: string) => onOpenEmailSidebar([], groupId) : undefined}
          />
        );

      case 'families':
        return (
          <Families
            people={people}
            onSelectPerson={handlers.viewPerson}
            onUpdatePerson={handlers.savePerson}
          />
        );

      case 'skills':
        return (
          <SkillsDatabase
            people={people}
            onViewPerson={handlers.viewPerson}
          />
        );

      case 'prayer':
        return <Prayer prayers={prayers} people={people} onMarkAnswered={handlers.markPrayerAnswered} />;

      case 'giving':
        return (
          <GivingDashboard
            giving={giving}
            people={people}
            campaigns={collectionMgmt.campaigns}
            pledges={collectionMgmt.pledges}
            onNavigate={(subView) => setView(subView)}
          />
        );

      case 'online-giving':
        return <OnlineGivingForm churchName={churchName} onBack={() => setView('giving')} onSuccess={() => setView('giving')} />;

      case 'batch-entry':
        return (
          <BatchEntry
            people={people}
            batches={collectionMgmt.donationBatches}
            onCreateBatch={collectionMgmt.createBatch}
            onAddItem={collectionMgmt.addBatchItem}
            onRemoveItem={collectionMgmt.removeBatchItem}
            onCloseBatch={collectionMgmt.closeBatch}
            onBack={() => setView('giving')}
          />
        );

      case 'pledges':
      case 'campaigns':
        return (
          <PledgeManager
            people={people}
            campaigns={collectionMgmt.campaigns}
            pledges={collectionMgmt.pledges}
            onCreateCampaign={collectionMgmt.createCampaign}
            onUpdateCampaign={collectionMgmt.updateCampaign}
            onCreatePledge={collectionMgmt.createPledge}
            onUpdatePledge={collectionMgmt.updatePledge}
            onDeletePledge={collectionMgmt.deletePledge}
            onBack={() => setView('giving')}
          />
        );

      case 'statements':
        return (
          <GivingStatements
            giving={giving}
            people={people}
            statements={collectionMgmt.givingStatements}
            onGenerateStatement={collectionMgmt.generateStatement}
            onSendStatement={collectionMgmt.sendStatement}
            onBack={() => setView('giving')}
          />
        );

      case 'charity-baskets':
        return (
          <CharityBaskets
            baskets={charityBasketMgmt.baskets}
            people={people}
            onCreateBasket={charityBasketMgmt.createBasket}
            onUpdateBasket={charityBasketMgmt.updateBasket}
            onDeleteBasket={charityBasketMgmt.deleteBasket}
            onAddItem={charityBasketMgmt.addItem}
            onRemoveItem={charityBasketMgmt.removeItem}
            onDistributeBasket={charityBasketMgmt.distributeBasket}
            onBack={() => setView('giving')}
          />
        );

      case 'donation-tracker':
        return (
          <DonationTracker
            giving={giving}
            people={people}
            onBack={() => setView('giving')}
            onViewMemberStats={() => setView('member-stats')}
            onViewPerson={handlers.viewPerson}
          />
        );

      case 'member-stats':
        return <MemberDonationStats people={people} giving={giving} onViewPerson={handlers.viewPerson} onBack={() => setView('giving')} />;

      case 'tags':
        return <TagsManager people={people} onUpdatePersonTags={handlers.updatePersonTags} />;

      case 'reports':
        return <PrintableReports people={people} tasks={tasks} prayers={prayers} giving={giving} />;

      case 'birthdays':
        return <BirthdayCalendar people={people} onViewPerson={handlers.viewPerson} />;

      case 'agents':
        return (
          <div className="p-6 max-w-7xl mx-auto">
            <AgentDashboard
              lifeEventConfig={agents.lifeEventConfig}
              donationConfig={agents.donationConfig}
              newMemberConfig={agents.newMemberConfig}
              upcomingLifeEvents={agents.upcomingLifeEvents}
              recentLogs={agents.logs}
              stats={agents.stats}
              onToggleAgent={agents.toggleAgent}
              onUpdateConfig={agents.updateConfig}
              onRunAgent={agents.runAgent}
            />
          </div>
        );

      case 'settings':
        return (
          <Settings
            people={people}
            tasks={tasks}
            events={events}
            giving={giving}
            groups={groups}
            prayers={prayers}
            onNavigate={(subView) => setView(subView)}
          />
        );

      case 'connect-card':
        return <ConnectCard churchId={churchId} churchName={churchName} />;

      case 'directory':
        return <MemberDirectory people={people} onBack={() => setView('people')} onViewPerson={handlers.viewPerson} />;

      case 'child-checkin':
        return <ChildCheckIn people={people} onBack={() => setView('attendance')} />;

      case 'forms':
        return <FormBuilder onBack={() => setView('settings')} />;

      case 'email-templates':
        return <EmailTemplateBuilder onBack={() => setView('settings')} />;

      case 'member-portal':
      case 'member-directory':
      case 'member-giving':
      case 'member-events':
      case 'member-checkin':
        return (
          <MemberPortalPreview
            people={people}
            events={events}
            giving={giving}
            attendance={attendanceRecords}
            rsvps={rsvps}
            churchName={churchName}
            churchProfile={settings?.profile}
            onBack={() => setView('dashboard')}
            onRSVP={handlers.rsvp}
            onCheckIn={handlers.checkIn}
            onPastorSignup={pastoralCare.addLeader}
          />
        );

      case 'sunday-prep':
        return (
          <div className="p-6 max-w-6xl mx-auto">
            <SundayPrep people={people} prayers={prayers} onViewPerson={handlers.viewPerson} />
          </div>
        );

      case 'event-registration':
        return (
          <EventRegistration
            events={events}
            people={people}
            onAddEvent={handlers.addEvent}
            onUpdateEvent={handlers.updateEvent}
            onDeleteEvent={handlers.deleteEvent}
            onViewPerson={handlers.viewPerson}
            onBack={() => setView('calendar')}
          />
        );

      case 'reminders':
        return (
          <AutomatedReminders
            people={people}
            tasks={tasks}
            events={events}
            prayers={prayers}
            emailConfigured={false}
            smsConfigured={false}
            onBack={() => setView('settings')}
          />
        );

      case 'planning-center-import':
        return (
          <PlanningCenterImport
            existingPeople={people}
            existingGroups={groups}
            onImportPeople={handlers.importCSV}
            onBack={() => setView('people')}
          />
        );

      case 'qr-checkin':
        return (
          <QRCheckIn
            people={people}
            events={events}
            attendance={attendanceRecords}
            churchName={churchName}
            churchId={churchId}
            onCheckIn={handlers.checkIn}
            onBack={() => setView('attendance')}
          />
        );

      case 'follow-up-automation':
        return (
          <FollowUpAutomation
            people={people}
            tasks={tasks}
            interactions={interactions}
            onAddTask={handlers.addTask}
            onBack={() => setView('settings')}
          />
        );

      case 'pastoral-care':
        return (
          <PastoralCareDashboard
            leaders={pastoralCare.leaders}
            helpRequests={pastoralCare.helpRequests}
            conversations={pastoralCare.conversations}
            activeConversation={pastoralCare.activeConversation}
            activeLeader={pastoralCare.activeLeader}
            activeConversationId={pastoralCare.activeConversationId}
            onCreateHelpRequest={pastoralCare.createHelpRequest}
            onSendMessage={pastoralCare.sendMessage}
            onResolveConversation={pastoralCare.resolveConversation}
            onEscalateConversation={pastoralCare.escalateConversation}
            onSetActiveConversation={pastoralCare.setActiveConversationId}
            onAddLeader={pastoralCare.addLeader}
            onUpdateLeader={pastoralCare.updateLeader}
            onDeleteLeader={pastoralCare.deleteLeader}
            onToggleLeaderAvailability={pastoralCare.toggleLeaderAvailability}
            onBack={() => setView('dashboard')}
            churchName={churchName}
          />
        );

      default:
        return <NotFound onGoHome={() => setView('dashboard')} />;
    }
  }
}
