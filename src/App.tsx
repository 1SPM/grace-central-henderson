import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthContext } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { PersonForm } from './components/PersonForm';
import { GlobalSearch } from './components/GlobalSearch';
import { QuickActions } from './components/QuickActions';
import { QuickTaskForm } from './components/QuickTaskForm';
import { QuickPrayerForm } from './components/QuickPrayerForm';
import { QuickNote } from './components/QuickNote';
import { QuickDonationForm } from './components/QuickDonationForm';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { ViewRenderer } from './components/ViewRenderer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSupabaseData } from './hooks/useSupabaseData';
import { useCollectionManagement } from './hooks/useCollectionManagement';
import { useCharityBaskets } from './hooks/useCharityBaskets';
import { useModals } from './hooks/useModals';
import { useAgents } from './hooks/useAgents';
import { useAppHandlers } from './hooks/useAppHandlers';
import {
  toPersonLegacy,
  toTaskLegacy,
  toInteractionLegacy,
  toGroupLegacy,
  toPrayerLegacy,
  toEventLegacy,
  toGivingLegacy,
} from './utils/typeConverters';
import type { View } from './types';

function App() {
  const { churchId } = useAuthContext();
  const [view, setView] = useState<View>('dashboard');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  // Use Supabase data hook
  const {
    isLoading,
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

  // Convert to legacy types for existing components (memoized)
  const people = useMemo(() => dbPeople.map(p => {
    const person = toPersonLegacy(p);
    person.smallGroups = dbGroups.filter(g => g.members?.includes(p.id) ?? false).map(g => g.id);
    return person;
  }), [dbPeople, dbGroups]);

  const tasks = useMemo(() => dbTasks.map(toTaskLegacy), [dbTasks]);
  const interactions = useMemo(() => dbInteractions.map(toInteractionLegacy), [dbInteractions]);
  const groups = useMemo(() => dbGroups.map(toGroupLegacy), [dbGroups]);
  const prayers = useMemo(() => dbPrayers.map(toPrayerLegacy), [dbPrayers]);
  const events = useMemo(() => dbEvents.map(toEventLegacy), [dbEvents]);
  const giving = useMemo(() => dbGiving.map(toGivingLegacy), [dbGiving]);

  // Custom hooks for state management
  const modals = useModals();
  const collectionMgmt = useCollectionManagement(giving);
  const charityBasketMgmt = useCharityBaskets();

  // App handlers
  const { attendanceRecords, rsvps, volunteerAssignments, handlers } = useAppHandlers({
    churchId,
    dbPeople,
    addPerson,
    updatePerson,
    addTask,
    toggleTask,
    addInteraction,
    addPrayer,
    markPrayerAnswered,
    addGiving,
    setView,
    setSelectedPersonId,
    openPersonForm: modals.openPersonForm,
    closePersonForm: modals.closePersonForm,
  });

  // Agent task creation callback
  const handleAgentCreateTask = useCallback(async (task: {
    personId: string;
    title: string;
    description?: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    category: 'follow-up' | 'care' | 'admin' | 'outreach';
    assignedTo?: string;
  }) => {
    await addTask({
      church_id: churchId,
      person_id: task.personId,
      title: task.title,
      description: task.description || null,
      due_date: task.dueDate,
      completed: false,
      priority: task.priority,
      category: task.category,
      assigned_to: task.assignedTo || null,
    });
  }, [addTask, churchId]);

  // AI Agents hook
  const agents = useAgents({
    churchId,
    churchName: 'Grace Church',
    people: people.map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      birthDate: p.birthDate,
      joinDate: p.joinDate,
      status: p.status,
    })),
    giving: giving.map(g => ({
      id: g.id,
      personId: g.personId,
      amount: g.amount,
      fund: g.fund,
      date: g.date,
      method: g.method,
      isRecurring: g.isRecurring,
    })),
    onCreateTask: handleAgentCreateTask,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); modals.openPersonForm(); break;
        case 't': e.preventDefault(); modals.openQuickTask(); break;
        case 'p': e.preventDefault(); modals.openQuickPrayer(); break;
        case 'm': e.preventDefault(); modals.openQuickNote(); break;
        case 'd': e.preventDefault(); modals.openQuickDonation(); break;
        case '/': e.preventDefault(); modals.openSearch(); break;
        case 'escape': modals.closeAll(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modals]);

  // Memoize person lookup
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const selectedPerson = selectedPersonId ? personMap.get(selectedPersonId) : undefined;

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

  return (
    <ErrorBoundary>
      <Layout currentView={view} setView={setView} onOpenSearch={modals.openSearch}>
        <ErrorBoundary>
          <ViewRenderer
            view={view}
            setView={setView}
            churchId={churchId}
            people={people}
            tasks={tasks}
            interactions={interactions}
            groups={groups}
            prayers={prayers}
            events={events}
            giving={giving}
            attendanceRecords={attendanceRecords}
            rsvps={rsvps}
            volunteerAssignments={volunteerAssignments}
            selectedPerson={selectedPerson}
            handlers={handlers}
            collectionMgmt={collectionMgmt}
            charityBasketMgmt={charityBasketMgmt}
            agents={agents}
          />
        </ErrorBoundary>
      </Layout>

      {modals.showPersonForm && (
        <PersonForm person={modals.editingPerson} onSave={handlers.savePerson} onClose={modals.closePersonForm} />
      )}

      {modals.showSearch && (
        <GlobalSearch
          people={people}
          tasks={tasks}
          prayers={prayers}
          onSelectPerson={handlers.viewPerson}
          onSelectTask={() => setView('tasks')}
          onSelectPrayer={() => setView('prayer')}
          onClose={modals.closeSearch}
        />
      )}

      <QuickActions
        onAddPerson={handlers.addPerson}
        onAddTask={modals.openQuickTask}
        onAddPrayer={modals.openQuickPrayer}
        onAddNote={modals.openQuickNote}
        onAddDonation={modals.openQuickDonation}
      />

      {modals.showQuickTask && <QuickTaskForm people={people} onSave={handlers.addTask} onClose={modals.closeQuickTask} />}
      {modals.showQuickPrayer && <QuickPrayerForm people={people} onSave={handlers.addPrayer} onClose={modals.closeQuickPrayer} />}
      {modals.showQuickNote && <QuickNote people={people} onSave={handlers.addInteraction} onClose={modals.closeQuickNote} />}
      {modals.showQuickDonation && (
        <QuickDonationForm
          people={people}
          defaultPersonId={modals.quickDonationPersonId}
          onSave={handlers.addGiving}
          onClose={modals.closeQuickDonation}
        />
      )}

      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}

export default App;
