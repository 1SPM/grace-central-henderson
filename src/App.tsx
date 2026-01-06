import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { PeopleList } from './components/PeopleList';
import { PersonProfile } from './components/PersonProfile';
import { PersonForm } from './components/PersonForm';
import { Tasks } from './components/Tasks';
import { Calendar } from './components/Calendar';
import { Groups } from './components/Groups';
import { Prayer } from './components/Prayer';
import { Giving } from './components/Giving';
import { Settings } from './components/Settings';
import { GlobalSearch } from './components/GlobalSearch';
import { QuickActions } from './components/QuickActions';
import { QuickTaskForm } from './components/QuickTaskForm';
import { QuickPrayerForm } from './components/QuickPrayerForm';
import { VisitorPipeline } from './components/VisitorPipeline';
import { useSupabaseData } from './hooks/useSupabaseData';
import type { View, Person as LegacyPerson, Task as LegacyTask, Interaction as LegacyInteraction } from './types';

// Adapter functions to convert between database types and legacy component types
function toPersonLegacy(p: {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  photo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  birth_date: string | null;
  join_date: string | null;
  first_visit: string | null;
  notes: string | null;
  tags: string[];
  family_id: string | null;
}): LegacyPerson {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email || '',
    phone: p.phone || '',
    status: p.status as LegacyPerson['status'],
    photo: p.photo_url || undefined,
    address: p.address || undefined,
    city: p.city || undefined,
    state: p.state || undefined,
    zip: p.zip || undefined,
    birthDate: p.birth_date || undefined,
    joinDate: p.join_date || undefined,
    firstVisit: p.first_visit || undefined,
    notes: p.notes || undefined,
    tags: p.tags,
    smallGroups: [], // Will be populated separately
    familyId: p.family_id || undefined,
  };
}

function toTaskLegacy(t: {
  id: string;
  person_id: string | null;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  priority: string;
  category: string;
  assigned_to: string | null;
  created_at: string;
}): LegacyTask {
  return {
    id: t.id,
    personId: t.person_id || undefined,
    title: t.title,
    description: t.description || undefined,
    dueDate: t.due_date,
    completed: t.completed,
    priority: t.priority as LegacyTask['priority'],
    category: t.category as LegacyTask['category'],
    assignedTo: t.assigned_to || undefined,
    createdAt: t.created_at,
  };
}

function toInteractionLegacy(i: {
  id: string;
  person_id: string;
  type: string;
  content: string;
  created_by_name: string | null;
  created_at: string;
}): LegacyInteraction {
  return {
    id: i.id,
    personId: i.person_id,
    type: i.type as LegacyInteraction['type'],
    content: i.content,
    createdBy: i.created_by_name || 'Unknown',
    createdAt: i.created_at,
  };
}

function App() {
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

  const groups = dbGroups.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description || undefined,
    leaderId: g.leader_id || '',
    meetingDay: g.meeting_day || undefined,
    meetingTime: g.meeting_time || undefined,
    location: g.location || undefined,
    members: g.members,
    isActive: g.is_active,
  }));

  const prayers = dbPrayers.map(p => ({
    id: p.id,
    personId: p.person_id,
    content: p.content,
    isPrivate: p.is_private,
    isAnswered: p.is_answered,
    testimony: p.testimony || undefined,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  const events = dbEvents.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description || undefined,
    startDate: e.start_date,
    endDate: e.end_date || undefined,
    allDay: e.all_day,
    location: e.location || undefined,
    category: e.category as 'service' | 'meeting' | 'event' | 'small-group' | 'other',
  }));

  const giving = dbGiving.map(g => ({
    id: g.id,
    personId: g.person_id || '',
    amount: g.amount,
    fund: g.fund as 'tithe' | 'offering' | 'missions' | 'building' | 'other',
    date: g.date,
    method: g.method as 'cash' | 'check' | 'card' | 'online',
    isRecurring: g.is_recurring,
    note: g.note || undefined,
  }));

  // Modal states
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<LegacyPerson | undefined>(undefined);
  const [showSearch, setShowSearch] = useState(false);
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [showQuickPrayer, setShowQuickPrayer] = useState(false);

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
      church_id: 'demo-church',
      person_id: interaction.personId,
      type: interaction.type,
      content: interaction.content,
      created_by_name: interaction.createdBy,
    });
  };

  const handleAddTask = async (task: Omit<LegacyTask, 'id' | 'createdAt'>) => {
    await addTask({
      church_id: 'demo-church',
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

  const handleAddPrayer = async (prayer: { personId: string; content: string; isPrivate: boolean }) => {
    await addPrayer({
      church_id: 'demo-church',
      person_id: prayer.personId,
      content: prayer.content,
      is_private: prayer.isPrivate,
    });
  };

  // Person CRUD handlers
  const handleAddPerson = () => {
    setEditingPerson(undefined);
    setShowPersonForm(true);
  };

  const handleEditPerson = (person: LegacyPerson) => {
    setEditingPerson(person);
    setShowPersonForm(true);
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
        church_id: 'demo-church',
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
    setShowPersonForm(false);
    setEditingPerson(undefined);
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
            onViewPerson={handleViewPerson}
            onViewTasks={() => setView('tasks')}
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
            onBack={handleBackToPeople}
            onAddInteraction={handleAddInteraction}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onEditPerson={handleEditPerson}
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

      case 'calendar':
        return <Calendar events={events} />;

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
        return <Giving giving={giving} people={people} />;

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
        onOpenSearch={() => setShowSearch(true)}
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
      {showPersonForm && (
        <PersonForm
          person={editingPerson}
          onSave={handleSavePerson}
          onClose={() => {
            setShowPersonForm(false);
            setEditingPerson(undefined);
          }}
        />
      )}

      {/* Global Search Modal */}
      {showSearch && (
        <GlobalSearch
          people={people}
          tasks={tasks}
          prayers={prayers}
          onSelectPerson={handleSearchSelectPerson}
          onSelectTask={() => setView('tasks')}
          onSelectPrayer={() => setView('prayer')}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Quick Actions FAB */}
      <QuickActions
        onAddPerson={handleAddPerson}
        onAddTask={() => setShowQuickTask(true)}
        onAddPrayer={() => setShowQuickPrayer(true)}
      />

      {/* Quick Task Form Modal */}
      {showQuickTask && (
        <QuickTaskForm
          people={people}
          onSave={handleAddTask}
          onClose={() => setShowQuickTask(false)}
        />
      )}

      {/* Quick Prayer Form Modal */}
      {showQuickPrayer && (
        <QuickPrayerForm
          people={people}
          onSave={handleAddPrayer}
          onClose={() => setShowQuickPrayer(false)}
        />
      )}
    </>
  );
}

export default App;
