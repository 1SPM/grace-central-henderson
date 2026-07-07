import { lazy, Suspense, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Dashboard } from './Dashboard';
import { ActionCenter } from './ActionCenter';
import { LeadershipPage } from './leadership/LeadershipPage';
import { Congregation } from './Congregation';
import { SettingsHub } from './settings/SettingsHub';
import { SundayPage } from './SundayPage';
import { CareHub } from './care/CareHub';
import { navigateView } from '../lib/actionCenterNav';
import type { ActionCenterTab } from '../lib/actionCenterNav';
import type { CareTab } from '../lib/careNav';
import { openCare } from '../lib/careNav';
import { openSunday, type SundayTab } from '../lib/sundayNav';
import type { SettingsTab } from '../lib/settingsNav';
import { settingsTabFromView } from '../lib/settingsNav';
import type { CongregationTab } from '../lib/congregationNav';
import { PersonProfile } from './PersonProfile';
import { Tasks } from './Tasks';
import { NotFound } from './NotFound';
import { ErrorBoundary, CompactErrorFallback } from './ErrorBoundary';
import { ListSkeleton } from './ui/ViewSkeleton';
import { useChurchSettings } from '../hooks/useChurchSettings';
import { useRouteGuard } from '../hooks/useRouteGuard';
import { useTutorial } from '../contexts/TutorialContext';
import type { View, Person, Task, Interaction, SmallGroup, PrayerRequest, CalendarEvent, Giving, Attendance, Campaign, Pledge, DonationBatch, GivingStatement, CharityBasket, BasketItem, BatchItem, LeaderProfile, HelpRequest, PastoralConversation, PastoralSession, HelpCategory, Announcement, AnnouncementCategory, DiscipleshipMilestone, MilestoneType } from '../types';
import type { AgentConfig, LifeEventConfig, DonationProcessingConfig, NewMemberConfig, LifeEvent, AgentLog, AgentStats } from '../lib/agents/types';

// Lazy load less frequently used views for code splitting
const Prayer = lazy(() => import('./Prayer').then(m => ({ default: m.Prayer })));
const GivingHub = lazy(() => import('./giving/GivingHub').then(m => ({ default: m.GivingHub })));
const WalletsView = lazy(() => import('./financial/WalletsView').then(m => ({ default: m.WalletsView })));
const OnlineGivingForm = lazy(() => import('./OnlineGivingForm').then(m => ({ default: m.OnlineGivingForm })));
const BatchEntry = lazy(() => import('./BatchEntry').then(m => ({ default: m.BatchEntry })));
const PledgeManager = lazy(() => import('./PledgeManager').then(m => ({ default: m.PledgeManager })));
const GivingStatements = lazy(() => import('./GivingStatements').then(m => ({ default: m.GivingStatements })));
const VisitorPipeline = lazy(() => import('./VisitorPipeline').then(m => ({ default: m.VisitorPipeline })));
const CharityBaskets = lazy(() => import('./CharityBaskets').then(m => ({ default: m.CharityBaskets })));
const MemberDonationStats = lazy(() => import('./MemberDonationStats').then(m => ({ default: m.MemberDonationStats })));
const DonationTracker = lazy(() => import('./DonationTracker').then(m => ({ default: m.DonationTracker })));
const ConnectCard = lazy(() => import('./ConnectCard').then(m => ({ default: m.ConnectCard })));
const MemberDirectory = lazy(() => import('./MemberDirectory').then(m => ({ default: m.MemberDirectory })));
const GraceMobilePreview = lazy(() => import('./mobile/GraceMobilePreview').then(m => ({ default: m.GraceMobilePreview })));
const EventRegistration = lazy(() => import('./EventRegistration').then(m => ({ default: m.EventRegistration })));
const QRCheckIn = lazy(() => import('./QRCheckIn').then(m => ({ default: m.QRCheckIn })));
const DiscipleshipEngagementHub = lazy(() =>
  import('./discipleship/DiscipleshipEngagementHub').then(m => ({ default: m.DiscipleshipEngagementHub })),
);
const EstatePlanning = lazy(() => import('./EstatePlanning').then(m => ({ default: m.EstatePlanning })));
const WeddingServices = lazy(() => import('./WeddingServices').then(m => ({ default: m.WeddingServices })));
const FuneralServices = lazy(() => import('./FuneralServices').then(m => ({ default: m.FuneralServices })));

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
      <div className="w-16 h-16 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
        <ShieldAlert className="text-amber-500" size={32} />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100 mb-2">Restricted Area</h2>
      <p className="text-gray-500 dark:text-dark-400 max-w-sm">{message}</p>
      <p className="text-sm text-gray-400 dark:text-dark-500 mt-2">Contact your church administrator to request access.</p>
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
  selectedPersonId?: string | null;
  setSelectedPersonId?: (id: string | null) => void;
  onOpenEmailSidebar?: (recipients?: string[], groupId?: string) => void;
  onReopenWizard?: () => void;
  /** Staff member name/role for GRACE Mobile preview header. */
  userName?: string;
  roleLabel?: string;
  /** Renders an arbitrary admin View — used by the GRACE Mobile preview to embed live hubs. */
  renderMobileView?: (view: View, setView: (v: View) => void) => ReactNode;
  handlers: {
    viewPerson: (id: string) => void;
    backToPeople: () => void;
    addPerson: () => void;
    editPerson: (person: Person) => void;
    savePerson: (person: Omit<Person, 'id'> | Person) => Promise<void>;
    addInteraction: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => Promise<void>;
    addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
    addPrayer: (prayer: { personId: string; content: string; isPrivate: boolean }) => Promise<void>;
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
    markStatementSent: (personId: string, year: number, method: 'email' | 'print') => void;
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
  announcementData: {
    announcements: Announcement[];
    activeAnnouncements: Announcement[];
    addAnnouncement: (data: { title: string; body?: string; category: AnnouncementCategory; pinned: boolean; expiresAt?: string }) => void;
    updateAnnouncement: (id: string, data: Partial<Omit<Announcement, 'id' | 'churchId' | 'createdAt'>>) => void;
    deleteAnnouncement: (id: string) => void;
  };
  discipleshipData: {
    milestones: DiscipleshipMilestone[];
    addMilestone: (data: { personId: string; milestoneType: MilestoneType; completedAt?: string; notes?: string }) => void;
    removeMilestone: (id: string) => void;
    updateMilestone: (id: string, data: Partial<Pick<DiscipleshipMilestone, 'completedAt' | 'notes' | 'verifiedBy'>>) => void;
    getPersonMilestones: (personId: string) => DiscipleshipMilestone[];
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
    sessions: PastoralSession[];
  };
}

export function ViewRenderer(props: ViewRendererProps) {
  const { view, setView, churchId, people, tasks, interactions, giving, groups, prayers, events,
    attendanceRecords, rsvps, volunteerAssignments, selectedPerson, selectedPersonId, setSelectedPersonId, handlers,
    collectionMgmt, charityBasketMgmt, announcementData, discipleshipData, pastoralCare, onOpenEmailSidebar, onReopenWizard,
    userName, roleLabel, renderMobileView } = props;

  const { settings, saveOnboarding } = useChurchSettings(churchId);
  const churchName = settings?.profile?.name || 'Grace Church';
  const { getBlockedMessage } = useRouteGuard();
  const { openPicker: openTutorialPicker, startPastorTour } = useTutorial();

  // Role-based access check
  const blockedMessage = getBlockedMessage(view);
  if (blockedMessage) {
    return <AccessDenied message={blockedMessage} />;
  }

  const renderSundayPage = (defaultTab?: SundayTab) => (
    <SundayPage
      churchId={churchId}
      people={people}
      prayers={prayers}
      events={events}
      rsvps={rsvps}
      churchName={churchName}
      churchProfile={settings?.profile}
      timezone={settings?.timezone}
      onViewPerson={handlers.viewPerson}
      onRSVP={handlers.rsvp}
      onAddEvent={handlers.addEvent}
      onUpdateEvent={handlers.updateEvent}
      onDeleteEvent={handlers.deleteEvent}
      defaultTab={defaultTab}
      attendanceRecords={attendanceRecords}
      onCheckIn={handlers.checkIn}
      announcements={announcementData.announcements}
      onAddAnnouncement={announcementData.addAnnouncement}
      onUpdateAnnouncement={announcementData.updateAnnouncement}
      onDeleteAnnouncement={announcementData.deleteAnnouncement}
    />
  );

  const renderCongregation = (defaultTab?: CongregationTab) => (
    <Congregation
      people={people}
      groups={groups}
      churchId={churchId}
      onViewPerson={handlers.viewPerson}
      onAddPerson={handlers.addPerson}
      onBulkUpdateStatus={handlers.bulkUpdateStatus}
      onBulkAddTag={handlers.bulkAddTag}
      onImportCSV={handlers.importCSV}
      onCreateGroup={handlers.createGroup}
      onAddMember={handlers.addGroupMember}
      onRemoveMember={handlers.removeGroupMember}
      onEmailGroup={onOpenEmailSidebar ? (groupId: string) => onOpenEmailSidebar([], groupId) : undefined}
      onUpdatePerson={handlers.savePerson}
      defaultTab={defaultTab}
    />
  );

  const renderActionCenter = (defaultTab?: ActionCenterTab) => (
    <ActionCenter
      churchId={churchId}
      churchName={churchName}
      churchProfile={settings?.profile}
      timezone={settings?.timezone}
      people={people}
      tasks={tasks}
      prayers={prayers}
      events={events}
      assignments={volunteerAssignments}
      onToggleTask={handlers.toggleTask}
      onSelectPerson={handlers.viewPerson}
      onAssignVolunteer={handlers.assignVolunteer}
      onUpdateVolunteerStatus={handlers.updateVolunteerStatus}
      onRemoveVolunteer={handlers.removeVolunteer}
      defaultTab={defaultTab}
    />
  );

  const renderSettingsHub = (defaultTab?: SettingsTab) => (
    <SettingsHub
      churchId={churchId}
      people={people}
      tasks={tasks}
      events={events}
      giving={giving}
      groups={groups}
      prayers={prayers}
      interactions={interactions}
      onNavigate={(subView) => setView(subView)}
      onRunWizard={onReopenWizard}
      onOpenTutorials={openTutorialPicker}
      onUpdatePersonTags={handlers.updatePersonTags}
      onViewPerson={handlers.viewPerson}
      defaultTab={defaultTab}
    />
  );

  const renderCareHub = (defaultTab?: CareTab) => (
    <CareHub
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
      churchName={churchName}
      events={events}
      people={people}
      onNavigate={(v) => navigateView(v, setView)}
      defaultTab={defaultTab}
    />
  );

  // Core views (not lazy loaded for instant response)
  switch (view) {
    case 'dashboard':
      return (
        <Dashboard
          churchId={churchId}
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
          onViewCalendar={() => navigateView('calendar', setView)}
          onViewAnalytics={() => navigateView('analytics', setView)}
          churchSettings={settings}
          onNavigate={(v) => navigateView(v, setView)}
          onDismissGraceIntro={() => saveOnboarding({ graceIntroDismissed: true })}
          onStartPastorTour={startPastorTour}
          onOpenTutorials={openTutorialPicker}
          leaders={pastoralCare.leaders}
          onViewLeaders={() => {
            window.history.pushState(null, '', '#/leadership');
            setView('leadership');
          }}
          careConversations={pastoralCare.conversations}
        />
      );

    case 'feed':
      return renderActionCenter();

    case 'mail':
      return renderActionCenter('mail');

    case 'birthdays':
      return renderActionCenter('birthdays');

    case 'live-service':
      return renderActionCenter('live');

    case 'volunteers':
      return renderActionCenter('volunteers');

    case 'leadership':
    case 'grace':
    case 'leader-management':
      return (
        <LeadershipPage
          churchName={churchName}
          people={people}
          leaders={pastoralCare.leaders}
          sessions={pastoralCare.sessions}
          defaultWorkspaceTab={
            view === 'leader-management' ? 'manage' : undefined
          }
          onNavigate={(v) => navigateView(v, setView)}
          onAddLeader={pastoralCare.addLeader}
          onToggleLeaderAvailability={pastoralCare.toggleLeaderAvailability}
          onDeleteLeader={pastoralCare.deleteLeader}
        />
      );

    case 'people':
      return renderCongregation();

    case 'groups':
      return renderCongregation('groups');

    case 'skills':
      return renderCongregation('skills');

    case 'families':
      return renderCongregation('families');

    case 'sunday-prep':
      return renderSundayPage();

    case 'calendar':
      return renderSundayPage('calendar');

    case 'attendance':
      return renderSundayPage('attendance');

    case 'announcements':
      return renderSundayPage('announcements');

    case 'pastoral-care':
      return renderCareHub();

    case 'life-services':
      return renderCareHub('life-services');

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
          milestones={discipleshipData.getPersonMilestones(selectedPerson.id)}
          onAddMilestone={discipleshipData.addMilestone}
          onRemoveMilestone={discipleshipData.removeMilestone}
          onBack={handlers.backToPeople}
          onAddInteraction={handlers.addInteraction}
          onAddTask={handlers.addTask}
          onToggleTask={handlers.toggleTask}
          onEditPerson={handlers.editPerson}
          onViewAllGiving={() => setView('giving')}
          onAddToGroup={handlers.addGroupMember}
          onRemoveFromGroup={handlers.removeGroupMember}
          onSendEmail={onOpenEmailSidebar ? () => onOpenEmailSidebar([selectedPerson.id]) : undefined}
          churchId={churchId}
          onViewImpactCard={() => {
            setSelectedPersonId?.(selectedPerson.id);
            window.history.pushState(null, '', `#/wallets/${selectedPerson.id}`);
            setView('wallets');
          }}
        />
      );

    case 'tasks':
      return <Tasks tasks={tasks} people={people} onToggleTask={handlers.toggleTask} onAddTask={handlers.addTask} />;

    case 'settings':
      return renderSettingsHub();

    case 'forms':
    case 'email-templates':
    case 'reports':
    case 'tags':
    case 'analytics':
      return renderSettingsHub(settingsTabFromView(view) ?? 'general');

    case 'child-checkin':
      openSunday('attendance', setView);
      return null;

    case 'agents':
    case 'reminders':
    case 'financial-hub':
    case 'follow-up-automation':
    case 'planning-center-import':
      setView('dashboard');
      return null;
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

      case 'prayer':
        return <Prayer prayers={prayers} people={people} onMarkAnswered={handlers.markPrayerAnswered} />;

      case 'giving':
        return (
          <GivingHub
            giving={giving}
            people={people}
            campaigns={collectionMgmt.campaigns}
            pledges={collectionMgmt.pledges}
            onNavigate={(subView) => setView(subView)}
            onNavigateToWallets={setView}
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
            churchName={churchName}
            churchAddress={[settings?.profile?.address, settings?.profile?.city, settings?.profile?.state, settings?.profile?.zip].filter(Boolean).join(', ') || undefined}
            churchPhone={settings?.profile?.phone || undefined}
            churchEmail={settings?.profile?.email || undefined}
            onGenerateStatement={collectionMgmt.generateStatement}
            onSendStatement={collectionMgmt.sendStatement}
            onMarkStatementSent={collectionMgmt.markStatementSent}
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

      case 'wallets':
        return (
          <WalletsView
            people={people}
            giving={giving}
            churchName={churchName}
            initialPersonId={selectedPersonId}
            onViewPortalActivity={() => setView('discipleship-engagement')}
            onNavigate={setView}
          />
        );

      case 'connect-card':
        return <ConnectCard churchId={churchId} churchName={churchName} />;

      case 'discipleship-engagement':
        return (
          <DiscipleshipEngagementHub
            people={people}
            milestones={discipleshipData.milestones}
            churchId={churchId}
            groups={groups}
            onAddMilestone={discipleshipData.addMilestone}
            onRemoveMilestone={discipleshipData.removeMilestone}
            onViewPerson={handlers.viewPerson}
          />
        );

      case 'directory':
        return <MemberDirectory people={people} onBack={() => setView('people')} onViewPerson={handlers.viewPerson} />;

      case 'grace-mobile':
        return (
          <GraceMobilePreview
            churchName={churchName}
            branding={settings?.branding}
            userName={userName}
            roleLabel={roleLabel}
            people={people}
            tasks={tasks}
            giving={giving}
            events={events}
            prayers={prayers}
            renderView={
              renderMobileView ?? ((v, sv) => <ViewRenderer {...props} view={v} setView={sv} />)
            }
            onBack={() => setView('dashboard')}
          />
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
            onBack={() => navigateView('calendar', setView)}
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
            onBack={() => openSunday('attendance', setView)}
          />
        );

      case 'wedding-services':
        return (
          <WeddingServices
            people={people}
            events={events}
            onAddEvent={handlers.addEvent}
            onViewPerson={handlers.viewPerson}
            onBack={() => openCare('life-services', setView)}
          />
        );

      case 'funeral-services':
        return (
          <FuneralServices
            people={people}
            events={events}
            onAddEvent={handlers.addEvent}
            onViewPerson={handlers.viewPerson}
            onBack={() => openCare('life-services', setView)}
          />
        );

      case 'estate-planning':
        return (
          <EstatePlanning
            people={people}
            onViewPerson={handlers.viewPerson}
            onBack={() => openCare('life-services', setView)}
          />
        );

      default:
        return <NotFound onGoHome={() => setView('dashboard')} />;
    }
  }
}
