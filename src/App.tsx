import { useState, useEffect } from 'react';
import { useAuthContext } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { PeopleList } from './components/PeopleList';
import { PersonProfile } from './components/PersonProfile';
import { PersonForm } from './components/PersonForm';
import { Tasks } from './components/Tasks';
import { Calendar } from './components/Calendar';
import { Groups } from './components/Groups';
import { Prayer } from './components/Prayer';
import { GivingDashboard } from './components/GivingDashboard';
import { OnlineGivingForm } from './components/OnlineGivingForm';
import { BatchEntry } from './components/BatchEntry';
import { PledgeManager } from './components/PledgeManager';
import { GivingStatements } from './components/GivingStatements';
import { Settings } from './components/Settings';
import { GlobalSearch } from './components/GlobalSearch';
import { QuickActions } from './components/QuickActions';
import { QuickTaskForm } from './components/QuickTaskForm';
import { QuickPrayerForm } from './components/QuickPrayerForm';
import { VisitorPipeline } from './components/VisitorPipeline';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { AttendanceCheckIn } from './components/AttendanceCheckIn';
import { VolunteerScheduling } from './components/VolunteerScheduling';
import { TagsManager } from './components/TagsManager';
import { PrintableReports } from './components/PrintableReports';
import { BirthdayCalendar } from './components/BirthdayCalendar';
import { QuickNote } from './components/QuickNote';
import { QuickDonationForm } from './components/QuickDonationForm';
import { CharityBaskets } from './components/CharityBaskets';
import { MemberDonationStats } from './components/MemberDonationStats';
import { DonationTracker } from './components/DonationTracker';
import { useSupabaseData } from './hooks/useSupabaseData';
import { useCollectionManagement } from './hooks/useCollectionManagement';
import { useCharityBaskets } from './hooks/useCharityBaskets';
import { useModals } from './hooks/useModals';
import {
  toPersonLegacy,
  toTaskLegacy,
  toInteractionLegacy,
  toGroupLegacy,
  toPrayerLegacy,
  toEventLegacy,
  toGivingLegacy,
} from './utils/typeConverters';
import type { View, Person as LegacyPerson, Task as LegacyTask, Interaction as LegacyInteraction, Attendance } from './types';

function App() {
  const { churchId } = useAuthContext();
  const [view, setView] = useState<View>('dashboard');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  // Use Supabase data hook
  const {
    isLoading,
    isDemo,
    people: dbPeople,
    tasks: dbTasks,
    interactions: dbInteractions,
    groups: dbGroups,
    prayers: dbPrayers,
    events: dbEvents,
    giving: dbGiving,
    addPerson,
    updatePerson,
    addTask,
    toggleTask,
    addInteraction,
    addPrayer,
    markPrayerAnswered,
    addGiving,
  } = useSupabaseData();

  // Convert to legacy types for existing components
  const people = dbPeople.map(p => {
    const person = toPersonLegacy(p);
    // Add small groups
    person.smallGroups = dbGroups
      .filter(g => g.members.includes(p.id))
      .map(g => g.id);
    return person;
  });

  const tasks = dbTasks.map(toTaskLegacy);
  const interactions = dbInteractions.map(toInteractionLegacy);
  const groups = dbGroups.map(toGroupLegacy);
  const prayers = dbPrayers.map(toPrayerLegacy);
  const events = dbEvents.map(toEventLegacy);
  const giving = dbGiving.map(toGivingLegacy);

  // Custom hooks for state management
  const modals = useModals();
  const collectionMgmt = useCollectionManagement(giving);
  const charityBasketMgmt = useCharityBaskets();

  // Attendance state (demo data)
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);

  // RSVP state (demo data)
  const [rsvps, setRsvps] = useState<{ eventId: string; personId: string; status: 'yes' | 'no' | 'maybe'; guestCount: number }[]>([]);

  // Volunteer assignments state (demo data)
  const [volunteerAssignments, setVolunteerAssignments] = useState<{
    id: string;
    eventId: string;
    roleId: string;
    personId: string;
    status: 'confirmed' | 'pending' | 'declined';
  }[]>([]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Cmd/Ctrl + K is handled in Layout for search

      switch (e.key.toLowerCase()) {
        case 'n':
          // N = New Person
          e.preventDefault();
          modals.openPersonForm();
          break;
        case 't':
          // T = New Task
          e.preventDefault();
          modals.openQuickTask();
          break;
        case 'p':
          // P = New Prayer
          e.preventDefault();
          modals.openQuickPrayer();
          break;
        case 'm':
          // M = New Note (Memo)
          e.preventDefault();
          modals.openQuickNote();
          break;
        case 'd':
          // D = New Donation
          e.preventDefault();
          modals.openQuickDonation();
          break;
        case '/':
          // / = Search
          e.preventDefault();
          modals.openSearch();
          break;
        case 'escape':
          // ESC = Close modals
          modals.closeAll();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modals]);

  const handleViewPerson = (id: string) => {
    setSelectedPersonId(id);
    setView('person');
  };

  const handleBackToPeople = () => {
    setSelectedPersonId(null);
    setView('people');
  };

  const handleAddInteraction = async (interaction: Omit<LegacyInteraction, 'id' | 'createdAt'>) => {
    await addInteraction({
      church_id: churchId,
      person_id: interaction.personId,
      type: interaction.type,
      content: interaction.content,
      created_by_name: interaction.createdBy,
    });
  };

  const handleAddTask = async (task: Omit<LegacyTask, 'id' | 'createdAt'>) => {
    await addTask({
      church_id: churchId,
      person_id: task.personId || null,
      title: task.title,
      description: task.description || null,
      due_date: task.dueDate,
      completed: task.completed,
      priority: task.priority,
      category: task.category,
      assigned_to: task.assignedTo || null,
    });
  };

  const handleToggleTask = async (taskId: string) => {
    await toggleTask(taskId);
  };

  const handleMarkPrayerAnswered = async (id: string, testimony?: string) => {
    await markPrayerAnswered(id, testimony);
  };

  const handleCheckIn = (personId: string, eventType: Attendance['eventType'], eventName?: string) => {
    const newRecord: Attendance = {
      id: `attendance-${Date.now()}`,
      personId,
      eventType,
      eventName,
      date: new Date().toISOString().split('T')[0],
      checkedInAt: new Date().toISOString(),
    };
    setAttendanceRecords((prev) => [...prev, newRecord]);
  };

  const handleRSVP = (eventId: string, personId: string, status: 'yes' | 'no' | 'maybe', guestCount: number = 0) => {
    setRsvps((prev) => {
      // Check if this person already has an RSVP for this event
      const existingIndex = prev.findIndex((r) => r.eventId === eventId && r.personId === personId);
      if (existingIndex >= 0) {
        // Update existing RSVP
        const updated = [...prev];
        updated[existingIndex] = { eventId, personId, status, guestCount };
        return updated;
      }
      // Add new RSVP
      return [...prev, { eventId, personId, status, guestCount }];
    });
  };

  const handleAssignVolunteer = (eventId: string, roleId: string, personId: string) => {
    const newAssignment = {
      id: `vol-${Date.now()}`,
      eventId,
      roleId,
      personId,
      status: 'pending' as const,
    };
    setVolunteerAssignments((prev) => [...prev, newAssignment]);
  };

  const handleUpdateVolunteerStatus = (assignmentId: string, status: 'confirmed' | 'pending' | 'declined') => {
    setVolunteerAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, status } : a))
    );
  };

  const handleRemoveVolunteer = (assignmentId: string) => {
    setVolunteerAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  };

  const handleAddPrayer = async (prayer: { personId: string; content: string; isPrivate: boolean }) => {
    await addPrayer({
      church_id: churchId,
      person_id: prayer.personId,
      content: prayer.content,
      is_private: prayer.isPrivate,
    });
  };

  const handleAddGiving = async (donation: {
    personId?: string;
    amount: number;
    fund: string;
    method: string;
    date: string;
    isRecurring: boolean;
    note?: string;
  }) => {
    await addGiving({
      church_id: churchId,
      person_id: donation.personId || null,
      amount: donation.amount,
      fund: donation.fund,
      method: donation.method,
      date: donation.date,
      is_recurring: donation.isRecurring,
      note: donation.note || null,
    });
  };

  // Person CRUD handlers
  const handleAddPerson = () => {
    modals.openPersonForm();
  };

  const handleEditPerson = (person: LegacyPerson) => {
    modals.openPersonForm(person);
  };

  const handleSavePerson = async (personData: Omit<LegacyPerson, 'id'> | LegacyPerson) => {
    if ('id' in personData) {
      // Editing existing person
      await updatePerson(personData.id, {
        first_name: personData.firstName,
        last_name: personData.lastName,
        email: personData.email || null,
        phone: personData.phone || null,
        status: personData.status,
        photo_url: personData.photo || null,
        address: personData.address || null,
        city: personData.city || null,
        state: personData.state || null,
        zip: personData.zip || null,
        birth_date: personData.birthDate || null,
        join_date: personData.joinDate || null,
        first_visit: personData.firstVisit || null,
        notes: personData.notes || null,
        tags: personData.tags,
        family_id: personData.familyId || null,
      });
    } else {
      // Adding new person
      await addPerson({
        church_id: churchId,
        first_name: personData.firstName,
        last_name: personData.lastName,
        email: personData.email || null,
        phone: personData.phone || null,
        status: personData.status,
        photo_url: personData.photo || null,
        address: personData.address || null,
        city: personData.city || null,
        state: personData.state || null,
        zip: personData.zip || null,
        birth_date: personData.birthDate || null,
        join_date: personData.joinDate || null,
        first_visit: personData.firstVisit || null,
        notes: personData.notes || null,
        tags: personData.tags,
        family_id: personData.familyId || null,
      });
    }
    modals.closePersonForm();
  };

  // Bulk action handlers
  const handleBulkUpdateStatus = async (ids: string[], status: LegacyPerson['status']) => {
    for (const id of ids) {
      await updatePerson(id, { status });
    }
  };

  const handleBulkAddTag = async (ids: string[], tag: string) => {
    for (const id of ids) {
      const person = dbPeople.find(p => p.id === id);
      if (person && !person.tags.includes(tag)) {
        await updatePerson(id, { tags: [...person.tags, tag] });
      }
    }
  };

  const handleImportCSV = async (importedPeople: Partial<LegacyPerson>[]) => {
    for (const person of importedPeople) {
      if (person.firstName && person.lastName) {
        await addPerson({
          church_id: churchId,
          first_name: person.firstName,
          last_name: person.lastName,
          email: person.email || null,
          phone: person.phone || null,
          status: person.status || 'visitor',
          photo_url: null,
          address: null,
          city: null,
          state: null,
          zip: null,
          birth_date: null,
          join_date: null,
          first_visit: null,
          notes: null,
          tags: person.tags || [],
          family_id: null,
        });
      }
    }
  };

  // Search handlers
  const handleSearchSelectPerson = (id: string) => {
    handleViewPerson(id);
  };

  const selectedPerson = people.find(p => p.id === selectedPersonId);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading GRACE CRM...</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return (
          <Dashboard
            people={people}
            tasks={tasks}
            giving={giving}
            onViewPerson={handleViewPerson}
            onViewTasks={() => setView('tasks')}
            onViewGiving={() => setView('giving')}
          />
        );

      case 'pipeline':
        return (
          <VisitorPipeline
            people={people}
            onViewPerson={handleViewPerson}
          />
        );

      case 'people':
        return (
          <PeopleList
            people={people}
            onViewPerson={handleViewPerson}
            onAddPerson={handleAddPerson}
            onBulkUpdateStatus={handleBulkUpdateStatus}
            onBulkAddTag={handleBulkAddTag}
            onImportCSV={handleImportCSV}
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
            onBack={handleBackToPeople}
            onAddInteraction={handleAddInteraction}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onEditPerson={handleEditPerson}
            onViewAllGiving={() => setView('giving')}
          />
        );

      case 'tasks':
        return (
          <Tasks
            tasks={tasks}
            people={people}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
          />
        );

      case 'attendance':
        return (
          <AttendanceCheckIn
            people={people}
            attendance={attendanceRecords}
            onCheckIn={handleCheckIn}
          />
        );

      case 'calendar':
        return (
          <Calendar
            events={events}
            people={people}
            rsvps={rsvps}
            onRSVP={handleRSVP}
          />
        );

      case 'volunteers':
        return (
          <VolunteerScheduling
            people={people}
            events={events}
            assignments={volunteerAssignments}
            onAssign={handleAssignVolunteer}
            onUpdateStatus={handleUpdateVolunteerStatus}
            onRemove={handleRemoveVolunteer}
          />
        );

      case 'groups':
        return <Groups groups={groups} people={people} />;

      case 'prayer':
        return (
          <Prayer
            prayers={prayers}
            people={people}
            onMarkAnswered={handleMarkPrayerAnswered}
          />
        );

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
            onSuccess={(donation) => {
              console.log('Donation received:', donation);
              setView('giving');
            }}
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
            onViewPerson={handleViewPerson}
          />
        );

      case 'member-stats':
        return (
          <MemberDonationStats
            people={people}
            giving={giving}
            onViewPerson={handleViewPerson}
            onBack={() => setView('giving')}
          />
        );

      case 'tags':
        return (
          <TagsManager
            people={people}
            onUpdatePersonTags={async (personId: string, tags: string[]) => {
              await updatePerson(personId, { tags });
            }}
          />
        );

      case 'reports':
        return (
          <PrintableReports
            people={people}
            tasks={tasks}
            prayers={prayers}
            giving={giving}
          />
        );

      case 'birthdays':
        return (
          <BirthdayCalendar
            people={people}
            onViewPerson={handleViewPerson}
          />
        );

      case 'settings':
        return <Settings />;

      default:
        return null;
    }
  };

  return (
    <>
      <Layout
        currentView={view}
        setView={setView}
        onOpenSearch={modals.openSearch}
      >
        {/* Demo Mode Banner */}
        {isDemo && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-sm text-amber-800 dark:text-amber-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>
                <strong>Demo Mode</strong> - Using sample data. Configure Supabase in Settings to connect your database.
              </span>
            </div>
          </div>
        )}

        {renderView()}
      </Layout>

      {/* Person Form Modal */}
      {modals.showPersonForm && (
        <PersonForm
          person={modals.editingPerson}
          onSave={handleSavePerson}
          onClose={modals.closePersonForm}
        />
      )}

      {/* Global Search Modal */}
      {modals.showSearch && (
        <GlobalSearch
          people={people}
          tasks={tasks}
          prayers={prayers}
          onSelectPerson={handleSearchSelectPerson}
          onSelectTask={() => setView('tasks')}
          onSelectPrayer={() => setView('prayer')}
          onClose={modals.closeSearch}
        />
      )}

      {/* Quick Actions FAB */}
      <QuickActions
        onAddPerson={handleAddPerson}
        onAddTask={modals.openQuickTask}
        onAddPrayer={modals.openQuickPrayer}
        onAddNote={modals.openQuickNote}
        onAddDonation={modals.openQuickDonation}
      />

      {/* Quick Task Form Modal */}
      {modals.showQuickTask && (
        <QuickTaskForm
          people={people}
          onSave={handleAddTask}
          onClose={modals.closeQuickTask}
        />
      )}

      {/* Quick Prayer Form Modal */}
      {modals.showQuickPrayer && (
        <QuickPrayerForm
          people={people}
          onSave={handleAddPrayer}
          onClose={modals.closeQuickPrayer}
        />
      )}

      {/* Quick Note Modal */}
      {modals.showQuickNote && (
        <QuickNote
          people={people}
          onSave={handleAddInteraction}
          onClose={modals.closeQuickNote}
        />
      )}

      {/* Quick Donation Modal */}
      {modals.showQuickDonation && (
        <QuickDonationForm
          people={people}
          defaultPersonId={modals.quickDonationPersonId}
          onSave={handleAddGiving}
          onClose={modals.closeQuickDonation}
        />
      )}

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </>
  );
}

export default App;
