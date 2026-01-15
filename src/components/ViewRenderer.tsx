import { Dashboard } from './Dashboard';
import { PeopleList } from './PeopleList';
import { PersonProfile } from './PersonProfile';
import { Tasks } from './Tasks';
import { Calendar } from './Calendar';
import { Groups } from './Groups';
import { Prayer } from './Prayer';
import { GivingDashboard } from './GivingDashboard';
import { OnlineGivingForm } from './OnlineGivingForm';
import { BatchEntry } from './BatchEntry';
import { PledgeManager } from './PledgeManager';
import { GivingStatements } from './GivingStatements';
import { Settings } from './Settings';
import { VisitorPipeline } from './VisitorPipeline';
import { AttendanceCheckIn } from './AttendanceCheckIn';
import { VolunteerScheduling } from './VolunteerScheduling';
import { TagsManager } from './TagsManager';
import { PrintableReports } from './PrintableReports';
import { BirthdayCalendar } from './BirthdayCalendar';
import { CharityBaskets } from './CharityBaskets';
import { MemberDonationStats } from './MemberDonationStats';
import { DonationTracker } from './DonationTracker';
import { AgentDashboard } from './AgentDashboard';
import type { View, Person, Task, Interaction, SmallGroup, PrayerRequest, CalendarEvent, Giving, Attendance } from '../types';

interface ViewRendererProps {
  view: View;
  setView: (view: View) => void;
  // Data
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
  // Selected person
  selectedPerson?: Person;
  // Handlers
  handlers: {
    viewPerson: (id: string) => void;
    backToPeople: () => void;
    addPerson: () => void;
    editPerson: (person: Person) => void;
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
  };
  // Collection management - passed directly from useCollectionManagement hook
  collectionMgmt: {
    campaigns: any[];
    pledges: any[];
    donationBatches: any[];
    givingStatements: any[];
    createBatch: (batch: any) => void;
    addBatchItem: (item: any) => void;
    removeBatchItem: (itemId: string) => void;
    closeBatch: (batchId: string) => void;
    createCampaign: (campaign: any) => void;
    updateCampaign: (id: string, updates: any) => void;
    createPledge: (pledge: any) => void;
    updatePledge: (id: string, updates: any) => void;
    deletePledge: (id: string) => void;
    generateStatement: (personId: string, year: number) => void;
    sendStatement: (statementId: string, method: 'email' | 'print') => void;
  };
  // Charity baskets - passed directly from useCharityBaskets hook
  charityBasketMgmt: {
    baskets: any[];
    createBasket: (basket: any) => void;
    updateBasket: (id: string, updates: any) => void;
    deleteBasket: (id: string) => void;
    addItem: (basketId: string, item: any) => void;
    removeItem: (basketId: string, itemId: string) => void;
    distributeBasket: (basketId: string) => void;
  };
  // Agents - passed directly from useAgents hook
  agents: {
    lifeEventConfig: any;
    donationConfig: any;
    newMemberConfig: any;
    upcomingLifeEvents: any[];
    logs: any[];
    stats: any;
    toggleAgent: (agentId: string, enabled: boolean) => void;
    updateConfig: (agentId: string, config: any) => void;
    runAgent: (agentId: string) => Promise<any>;
  };
}

export function ViewRenderer({
  view,
  setView,
  people,
  tasks,
  interactions,
  groups,
  prayers,
  events,
  giving,
  attendanceRecords,
  rsvps,
  volunteerAssignments,
  selectedPerson,
  handlers,
  collectionMgmt,
  charityBasketMgmt,
  agents,
}: ViewRendererProps) {
  switch (view) {
    case 'dashboard':
      return (
        <Dashboard
          people={people}
          tasks={tasks}
          giving={giving}
          onViewPerson={handlers.viewPerson}
          onViewTasks={() => setView('tasks')}
          onViewGiving={() => setView('giving')}
        />
      );

    case 'pipeline':
      return <VisitorPipeline people={people} onViewPerson={handlers.viewPerson} />;

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
          onBack={handlers.backToPeople}
          onAddInteraction={handlers.addInteraction}
          onAddTask={handlers.addTask}
          onToggleTask={handlers.toggleTask}
          onEditPerson={handlers.editPerson}
          onViewAllGiving={() => setView('giving')}
        />
      );

    case 'tasks':
      return <Tasks tasks={tasks} people={people} onToggleTask={handlers.toggleTask} onAddTask={handlers.addTask} />;

    case 'attendance':
      return <AttendanceCheckIn people={people} attendance={attendanceRecords} onCheckIn={handlers.checkIn} />;

    case 'calendar':
      return <Calendar events={events} people={people} rsvps={rsvps} onRSVP={handlers.rsvp} />;

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
      return <Groups groups={groups} people={people} />;

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
      return (
        <OnlineGivingForm
          churchName="Grace Church"
          onBack={() => setView('giving')}
          onSuccess={() => setView('giving')}
        />
      );

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
      return <Settings />;

    default:
      return null;
  }
}
