import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  Person,
  Task,
  Interaction,
  SmallGroup,
  PrayerRequest,
  CalendarEvent,
  Giving,
  GivingFund,
  GivingMethod,
  EventCategory,
  GroupMembership,
  PersonInsert,
  TaskInsert,
  InteractionInsert,
  PrayerRequestInsert,
} from '../lib/database.types';
import {
  SAMPLE_PEOPLE,
  SAMPLE_TASKS,
  SAMPLE_INTERACTIONS,
  SAMPLE_GROUPS,
  SAMPLE_PRAYERS,
  SAMPLE_EVENTS,
  SAMPLE_GIVING,
} from '../constants';
import type {
  Person as LegacyPerson,
  Task as LegacyTask,
  Interaction as LegacyInteraction,
  SmallGroup as LegacySmallGroup,
  PrayerRequest as LegacyPrayerRequest,
  CalendarEvent as LegacyCalendarEvent,
  Giving as LegacyGiving,
} from '../types';

// Extended SmallGroup type with members array
export type SmallGroupWithMembers = SmallGroup & { members: string[] };

// Convert legacy types to database types for demo mode
function convertLegacyPerson(p: LegacyPerson): Person {
  return {
    id: p.id,
    church_id: 'demo-church',
    first_name: p.firstName,
    last_name: p.lastName,
    email: p.email || null,
    phone: p.phone || null,
    status: p.status,
    photo_url: p.photo || null,
    address: p.address || null,
    city: p.city || null,
    state: p.state || null,
    zip: p.zip || null,
    birth_date: p.birthDate || null,
    join_date: p.joinDate || null,
    first_visit: p.firstVisit || null,
    notes: p.notes || null,
    tags: p.tags,
    family_id: p.familyId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function convertLegacyTask(t: LegacyTask): Task {
  return {
    id: t.id,
    church_id: 'demo-church',
    person_id: t.personId || null,
    title: t.title,
    description: t.description || null,
    due_date: t.dueDate,
    completed: t.completed,
    completed_at: null,
    priority: t.priority,
    category: t.category,
    assigned_to: t.assignedTo || null,
    created_at: t.createdAt,
    updated_at: t.createdAt,
  };
}

function convertLegacyInteraction(i: LegacyInteraction): Interaction {
  return {
    id: i.id,
    church_id: 'demo-church',
    person_id: i.personId,
    type: i.type,
    content: i.content,
    created_by: null,
    created_by_name: i.createdBy,
    created_at: i.createdAt,
  };
}

function convertLegacyGroup(g: LegacySmallGroup): SmallGroupWithMembers {
  return {
    id: g.id,
    church_id: 'demo-church',
    name: g.name,
    description: g.description || null,
    leader_id: g.leaderId,
    meeting_day: g.meetingDay || null,
    meeting_time: g.meetingTime || null,
    location: g.location || null,
    is_active: g.isActive,
    members: g.members,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function convertLegacyPrayer(p: LegacyPrayerRequest): PrayerRequest {
  return {
    id: p.id,
    church_id: 'demo-church',
    person_id: p.personId,
    content: p.content,
    is_private: p.isPrivate,
    is_answered: p.isAnswered,
    testimony: p.testimony || null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function convertLegacyEvent(e: LegacyCalendarEvent): CalendarEvent {
  return {
    id: e.id,
    church_id: 'demo-church',
    title: e.title,
    description: e.description || null,
    start_date: e.startDate,
    end_date: e.endDate || null,
    all_day: e.allDay,
    location: e.location || null,
    category: e.category as EventCategory,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function convertLegacyGiving(g: LegacyGiving): Giving {
  return {
    id: g.id,
    church_id: 'demo-church',
    person_id: g.personId || null,
    amount: g.amount,
    fund: g.fund as GivingFund,
    date: g.date,
    method: g.method as GivingMethod,
    is_recurring: g.isRecurring,
    stripe_payment_id: null,
    note: g.note || null,
    created_at: new Date().toISOString(),
  };
}

// Main hook for all data
export function useSupabaseData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(!isSupabaseConfigured());

  // Data state
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [groups, setGroups] = useState<SmallGroupWithMembers[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [giving, setGiving] = useState<Giving[]>([]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      if (!isSupabaseConfigured() || !supabase) {
        // Demo mode - use sample data
        setPeople(SAMPLE_PEOPLE.map(convertLegacyPerson));
        setTasks(SAMPLE_TASKS.map(convertLegacyTask));
        setInteractions(SAMPLE_INTERACTIONS.map(convertLegacyInteraction));
        setGroups(SAMPLE_GROUPS.map(convertLegacyGroup));
        setPrayers(SAMPLE_PRAYERS.map(convertLegacyPrayer));
        setEvents(SAMPLE_EVENTS.map(convertLegacyEvent));
        setGiving(SAMPLE_GIVING.map(convertLegacyGiving));
        setIsDemo(true);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch all data in parallel
        const [
          peopleRes,
          tasksRes,
          interactionsRes,
          groupsRes,
          prayersRes,
          eventsRes,
          givingRes,
          membershipsRes,
        ] = await Promise.all([
          supabase.from('people').select('*').order('last_name'),
          supabase.from('tasks').select('*').order('due_date'),
          supabase.from('interactions').select('*').order('created_at', { ascending: false }),
          supabase.from('small_groups').select('*').order('name'),
          supabase.from('prayer_requests').select('*').order('created_at', { ascending: false }),
          supabase.from('calendar_events').select('*').order('start_date'),
          supabase.from('giving').select('*').order('date', { ascending: false }),
          supabase.from('group_memberships').select('*'),
        ]);

        if (peopleRes.error) throw peopleRes.error;
        if (tasksRes.error) throw tasksRes.error;
        if (interactionsRes.error) throw interactionsRes.error;
        if (groupsRes.error) throw groupsRes.error;
        if (prayersRes.error) throw prayersRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (givingRes.error) throw givingRes.error;
        if (membershipsRes.error) throw membershipsRes.error;

        const memberships = (membershipsRes.data || []) as GroupMembership[];
        const groupsData = (groupsRes.data || []) as SmallGroup[];

        // Add members array to groups
        const groupsWithMembers: SmallGroupWithMembers[] = groupsData.map(group => ({
          ...group,
          members: memberships
            .filter(m => m.group_id === group.id)
            .map(m => m.person_id),
        }));

        setPeople((peopleRes.data || []) as Person[]);
        setTasks((tasksRes.data || []) as Task[]);
        setInteractions((interactionsRes.data || []) as Interaction[]);
        setGroups(groupsWithMembers);
        setPrayers((prayersRes.data || []) as PrayerRequest[]);
        setEvents((eventsRes.data || []) as CalendarEvent[]);
        setGiving((givingRes.data || []) as Giving[]);
        setIsDemo(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        // Fall back to demo mode
        setPeople(SAMPLE_PEOPLE.map(convertLegacyPerson));
        setTasks(SAMPLE_TASKS.map(convertLegacyTask));
        setInteractions(SAMPLE_INTERACTIONS.map(convertLegacyInteraction));
        setGroups(SAMPLE_GROUPS.map(convertLegacyGroup));
        setPrayers(SAMPLE_PRAYERS.map(convertLegacyPrayer));
        setEvents(SAMPLE_EVENTS.map(convertLegacyEvent));
        setGiving(SAMPLE_GIVING.map(convertLegacyGiving));
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // ==========================================
  // PEOPLE CRUD
  // ==========================================
  const addPerson = useCallback(async (person: PersonInsert) => {
    if (isDemo || !supabase) {
      const newPerson: Person = {
        id: Date.now().toString(),
        church_id: person.church_id,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email ?? null,
        phone: person.phone ?? null,
        status: person.status || 'visitor',
        photo_url: person.photo_url ?? null,
        address: person.address ?? null,
        city: person.city ?? null,
        state: person.state ?? null,
        zip: person.zip ?? null,
        birth_date: person.birth_date ?? null,
        join_date: person.join_date ?? null,
        first_visit: person.first_visit ?? null,
        notes: person.notes ?? null,
        tags: person.tags || [],
        family_id: person.family_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPeople(prev => [...prev, newPerson]);
      return newPerson;
    }

    const { data, error } = await supabase
      .from('people')
      .insert(person)
      .select()
      .single();

    if (error) throw error;
    const newPerson = data as Person;
    setPeople(prev => [...prev, newPerson]);
    return newPerson;
  }, [isDemo]);

  const updatePerson = useCallback(async (id: string, updates: Partial<Person>) => {
    if (isDemo || !supabase) {
      setPeople(prev => prev.map(p =>
        p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
      ));
      return;
    }

    const { error } = await supabase
      .from('people')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    setPeople(prev => prev.map(p =>
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    ));
  }, [isDemo]);

  // ==========================================
  // TASKS CRUD
  // ==========================================
  const addTask = useCallback(async (task: TaskInsert) => {
    if (isDemo || !supabase) {
      const newTask: Task = {
        id: Date.now().toString(),
        church_id: task.church_id,
        person_id: task.person_id ?? null,
        title: task.title,
        description: task.description ?? null,
        due_date: task.due_date,
        completed: task.completed ?? false,
        completed_at: null,
        priority: task.priority || 'medium',
        category: task.category || 'follow-up',
        assigned_to: task.assigned_to ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setTasks(prev => [...prev, newTask]);
      return newTask;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single();

    if (error) throw error;
    const newTask = data as Task;
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, [isDemo]);

  const toggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const updates = {
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    };

    if (isDemo || !supabase) {
      setTasks(prev => prev.map(t =>
        t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
      ));
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    ));
  }, [isDemo, tasks]);

  // ==========================================
  // INTERACTIONS CRUD
  // ==========================================
  const addInteraction = useCallback(async (interaction: InteractionInsert) => {
    if (isDemo || !supabase) {
      const newInteraction: Interaction = {
        id: Date.now().toString(),
        church_id: interaction.church_id,
        person_id: interaction.person_id,
        type: interaction.type,
        content: interaction.content,
        created_by: interaction.created_by ?? null,
        created_by_name: interaction.created_by_name ?? null,
        created_at: new Date().toISOString(),
      };
      setInteractions(prev => [newInteraction, ...prev]);
      return newInteraction;
    }

    const { data, error } = await supabase
      .from('interactions')
      .insert(interaction)
      .select()
      .single();

    if (error) throw error;
    const newInteraction = data as Interaction;
    setInteractions(prev => [newInteraction, ...prev]);
    return newInteraction;
  }, [isDemo]);

  // ==========================================
  // PRAYER REQUESTS CRUD
  // ==========================================
  const markPrayerAnswered = useCallback(async (id: string, testimony?: string) => {
    const updates = {
      is_answered: true,
      testimony: testimony || null,
      updated_at: new Date().toISOString(),
    };

    if (isDemo || !supabase) {
      setPrayers(prev => prev.map(p =>
        p.id === id ? { ...p, ...updates } : p
      ));
      return;
    }

    const { error } = await supabase
      .from('prayer_requests')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    setPrayers(prev => prev.map(p =>
      p.id === id ? { ...p, ...updates } : p
    ));
  }, [isDemo]);

  const addPrayer = useCallback(async (prayer: PrayerRequestInsert) => {
    if (isDemo || !supabase) {
      const newPrayer: PrayerRequest = {
        id: Date.now().toString(),
        church_id: prayer.church_id,
        person_id: prayer.person_id,
        content: prayer.content,
        is_private: prayer.is_private ?? false,
        is_answered: prayer.is_answered ?? false,
        testimony: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPrayers(prev => [newPrayer, ...prev]);
      return newPrayer;
    }

    const { data, error } = await supabase
      .from('prayer_requests')
      .insert(prayer)
      .select()
      .single();

    if (error) throw error;
    const newPrayer = data as PrayerRequest;
    setPrayers(prev => [newPrayer, ...prev]);
    return newPrayer;
  }, [isDemo]);

  // Add giving record
  const addGiving = useCallback(async (givingData: {
    church_id: string;
    person_id: string | null;
    amount: number;
    fund: string;
    date: string;
    method: string;
    is_recurring?: boolean;
    note?: string | null;
  }) => {
    if (isDemo) {
      const newGiving: Giving = {
        id: `giving-${Date.now()}`,
        church_id: givingData.church_id,
        person_id: givingData.person_id,
        amount: givingData.amount,
        fund: givingData.fund as GivingFund,
        date: givingData.date,
        method: givingData.method as GivingMethod,
        is_recurring: givingData.is_recurring ?? false,
        stripe_payment_id: null,
        note: givingData.note ?? null,
        created_at: new Date().toISOString(),
      };
      setGiving(prev => [newGiving, ...prev]);
      return newGiving;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

    const { data, error } = await supabase
      .from('giving')
      .insert(givingData)
      .select()
      .single();

    if (error) throw error;
    const newGiving = data as Giving;
    setGiving(prev => [newGiving, ...prev]);
    return newGiving;
  }, [isDemo]);

  // Create a new group
  const createGroup = useCallback(async (groupData: {
    church_id: string;
    name: string;
    description?: string;
    leader_id?: string;
    meeting_day?: string;
    meeting_time?: string;
    location?: string;
  }) => {
    if (isDemo) {
      const newGroup: SmallGroupWithMembers = {
        id: `group-${Date.now()}`,
        church_id: groupData.church_id,
        name: groupData.name,
        description: groupData.description || null,
        leader_id: groupData.leader_id || null,
        meeting_day: groupData.meeting_day || null,
        meeting_time: groupData.meeting_time || null,
        location: groupData.location || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members: groupData.leader_id ? [groupData.leader_id] : [],
      };
      setGroups(prev => [...prev, newGroup]);

      // If there's a leader, add them as a member too
      if (groupData.leader_id) {
        // In demo mode, members array is already set above
      }
      return newGroup;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

    const { data, error } = await supabase
      .from('small_groups')
      .insert({
        church_id: groupData.church_id,
        name: groupData.name,
        description: groupData.description || null,
        leader_id: groupData.leader_id || null,
        meeting_day: groupData.meeting_day || null,
        meeting_time: groupData.meeting_time || null,
        location: groupData.location || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    const newGroup: SmallGroupWithMembers = {
      ...(data as SmallGroup),
      members: [],
    };

    // If there's a leader, add them as a member
    if (groupData.leader_id) {
      await supabase
        .from('group_memberships')
        .insert({
          group_id: newGroup.id,
          person_id: groupData.leader_id,
        });
      newGroup.members = [groupData.leader_id];
    }

    setGroups(prev => [...prev, newGroup]);
    return newGroup;
  }, [isDemo]);

  // Add member to group
  const addGroupMember = useCallback(async (groupId: string, personId: string) => {
    if (isDemo) {
      setGroups(prev => prev.map(g => {
        if (g.id === groupId && !g.members.includes(personId)) {
          return { ...g, members: [...g.members, personId] };
        }
        return g;
      }));
      return;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

    const { error } = await supabase
      .from('group_memberships')
      .insert({
        group_id: groupId,
        person_id: personId,
      });

    if (error) throw error;

    setGroups(prev => prev.map(g => {
      if (g.id === groupId && !g.members.includes(personId)) {
        return { ...g, members: [...g.members, personId] };
      }
      return g;
    }));
  }, [isDemo]);

  // Remove member from group
  const removeGroupMember = useCallback(async (groupId: string, personId: string) => {
    if (isDemo) {
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return { ...g, members: g.members.filter(m => m !== personId) };
        }
        return g;
      }));
      return;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

    const { error } = await supabase
      .from('group_memberships')
      .delete()
      .eq('group_id', groupId)
      .eq('person_id', personId);

    if (error) throw error;

    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, members: g.members.filter(m => m !== personId) };
      }
      return g;
    }));
  }, [isDemo]);

  return {
    // State
    isLoading,
    error,
    isDemo,

    // Data
    people,
    tasks,
    interactions,
    groups,
    prayers,
    events,
    giving,

    // People actions
    addPerson,
    updatePerson,

    // Task actions
    addTask,
    toggleTask,

    // Interaction actions
    addInteraction,

    // Prayer actions
    markPrayerAnswered,
    addPrayer,

    // Giving actions
    addGiving,

    // Group actions
    createGroup,
    addGroupMember,
    removeGroupMember,
  };
}
