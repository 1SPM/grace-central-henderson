import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createLogger } from '../utils/logger';

const log = createLogger('supabase-data');
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
  const [attendance, setAttendance] = useState<import('../lib/database.types').Attendance[]>([]);

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
          attendanceRes,
        ] = await Promise.all([
          supabase.from('people').select('*').order('last_name'),
          supabase.from('tasks').select('*').order('due_date'),
          supabase.from('interactions').select('*').order('created_at', { ascending: false }),
          supabase.from('small_groups').select('*').order('name'),
          supabase.from('prayer_requests').select('*').order('created_at', { ascending: false }),
          supabase.from('calendar_events').select('*').order('start_date'),
          supabase.from('giving').select('*').order('date', { ascending: false }),
          supabase.from('group_memberships').select('*'),
          supabase.from('attendance').select('*').gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).order('date', { ascending: false }),
        ]);

        if (peopleRes.error) throw peopleRes.error;
        if (tasksRes.error) throw tasksRes.error;
        if (interactionsRes.error) throw interactionsRes.error;
        if (groupsRes.error) throw groupsRes.error;
        if (prayersRes.error) throw prayersRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (givingRes.error) throw givingRes.error;
        if (membershipsRes.error) throw membershipsRes.error;
        if (attendanceRes.error) throw attendanceRes.error;

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
        setAttendance((attendanceRes.data || []) as import('../lib/database.types').Attendance[]);
        setIsDemo(false);
      } catch (err) {
        log.error('Failed to load data from Supabase', err);
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
    const addLocally = () => {
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
    };

    if (isDemo || !supabase) {
      return addLocally();
    }

    try {
      const { data, error } = await supabase
        .from('people')
        .insert(person)
        .select()
        .single();

      if (error) throw error;
      const newPerson = data as Person;
      setPeople(prev => [...prev, newPerson]);
      return newPerson;
    } catch (err) {
      log.warn('Supabase write failed for addPerson, falling back to local state', err);
      return addLocally();
    }
  }, [isDemo]);

  const updatePerson = useCallback(async (id: string, updates: Partial<Person>) => {
    const updateLocally = () => {
      setPeople(prev => prev.map(p =>
        p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
      ));
    };

    if (isDemo || !supabase) {
      updateLocally();
      return;
    }

    try {
      const { error } = await supabase
        .from('people')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      updateLocally();
    } catch (err) {
      log.warn('Supabase write failed for updatePerson, falling back to local state', err);
      updateLocally();
    }
  }, [isDemo]);

  // ==========================================
  // TASKS CRUD
  // ==========================================
  const addTask = useCallback(async (task: TaskInsert) => {
    const addLocally = () => {
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
    };

    if (isDemo || !supabase) {
      return addLocally();
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();

      if (error) throw error;
      const newTask = data as Task;
      setTasks(prev => [...prev, newTask]);
      return newTask;
    } catch (err) {
      log.warn('Supabase write failed for addTask, falling back to local state', err);
      return addLocally();
    }
  }, [isDemo]);

  const toggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const updates = {
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    };

    const updateLocally = () => {
      setTasks(prev => prev.map(t =>
        t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
      ));
    };

    if (isDemo || !supabase) {
      updateLocally();
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      updateLocally();
    } catch (err) {
      log.warn('Supabase write failed for toggleTask, falling back to local state', err);
      updateLocally();
    }
  }, [isDemo, tasks]);

  const updateTask = useCallback(async (id: string, updates: { title?: string; due_date?: string; priority?: 'low' | 'medium' | 'high' }) => {
    const updateLocally = () => {
      setTasks(prev => prev.map(t =>
        t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
      ));
    };
    if (isDemo || !supabase) { updateLocally(); return; }
    try {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
      updateLocally();
    } catch (err) {
      log.warn('Supabase write failed for updateTask, falling back to local state', err);
      updateLocally();
    }
  }, [isDemo]);

  const deleteTask = useCallback(async (id: string) => {
    const deleteLocally = () => setTasks(prev => prev.filter(t => t.id !== id));
    if (isDemo || !supabase) { deleteLocally(); return; }
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      deleteLocally();
    } catch (err) {
      log.warn('Supabase write failed for deleteTask, falling back to local state', err);
      deleteLocally();
    }
  }, [isDemo]);

  const deletePerson = useCallback(async (id: string) => {
    const deleteLocally = () => setPeople(prev => prev.filter(p => p.id !== id));
    if (isDemo || !supabase) { deleteLocally(); return; }
    try {
      const { error } = await supabase.from('people').delete().eq('id', id);
      if (error) throw error;
      deleteLocally();
    } catch (err) {
      log.warn('Supabase write failed for deletePerson, falling back to local state', err);
      deleteLocally();
    }
  }, [isDemo]);

  const deletePrayer = useCallback(async (id: string) => {
    const deleteLocally = () => setPrayers(prev => prev.filter(p => p.id !== id));
    if (isDemo || !supabase) { deleteLocally(); return; }
    try {
      const { error } = await supabase.from('prayer_requests').delete().eq('id', id);
      if (error) throw error;
      deleteLocally();
    } catch (err) {
      log.warn('Supabase write failed for deletePrayer, falling back to local state', err);
      deleteLocally();
    }
  }, [isDemo]);

  // ==========================================
  // INTERACTIONS CRUD
  // ==========================================
  const addInteraction = useCallback(async (interaction: InteractionInsert) => {
    const addLocally = () => {
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
    };

    if (isDemo || !supabase) {
      return addLocally();
    }

    try {
      const { data, error } = await supabase
        .from('interactions')
        .insert(interaction)
        .select()
        .single();

      if (error) throw error;
      const newInteraction = data as Interaction;
      setInteractions(prev => [newInteraction, ...prev]);
      return newInteraction;
    } catch (err) {
      log.warn('Supabase write failed for addInteraction, falling back to local state', err);
      return addLocally();
    }
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

    const updateLocally = () => {
      setPrayers(prev => prev.map(p =>
        p.id === id ? { ...p, ...updates } : p
      ));
    };

    if (isDemo || !supabase) {
      updateLocally();
      return;
    }

    try {
      const { error } = await supabase
        .from('prayer_requests')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      updateLocally();
    } catch (err) {
      log.warn('Supabase write failed for markPrayerAnswered, falling back to local state', err);
      updateLocally();
    }
  }, [isDemo]);

  const addPrayer = useCallback(async (prayer: PrayerRequestInsert) => {
    const addLocally = () => {
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
    };

    if (isDemo || !supabase) {
      return addLocally();
    }

    try {
      const { data, error } = await supabase
        .from('prayer_requests')
        .insert(prayer)
        .select()
        .single();

      if (error) throw error;
      const newPrayer = data as PrayerRequest;
      setPrayers(prev => [newPrayer, ...prev]);
      return newPrayer;
    } catch (err) {
      log.warn('Supabase write failed for addPrayer, falling back to local state', err);
      return addLocally();
    }
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
    const addLocally = () => {
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
    };

    if (isDemo || !supabase) {
      return addLocally();
    }

    try {
      const { data, error } = await supabase
        .from('giving')
        .insert(givingData)
        .select()
        .single();

      if (error) throw error;
      const newGiving = data as Giving;
      setGiving(prev => [newGiving, ...prev]);
      return newGiving;
    } catch (err) {
      log.warn('Supabase write failed for addGiving, falling back to local state', err);
      return addLocally();
    }
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
    const addLocally = () => {
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
      return newGroup;
    };

    if (isDemo || !supabase) {
      return addLocally();
    }

    try {
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
    } catch (err) {
      log.warn('Supabase write failed for createGroup, falling back to local state', err);
      return addLocally();
    }
  }, [isDemo]);

  // Add member to group
  const addGroupMember = useCallback(async (groupId: string, personId: string) => {
    const updateLocally = () => {
      setGroups(prev => prev.map(g => {
        if (g.id === groupId && !g.members.includes(personId)) {
          return { ...g, members: [...g.members, personId] };
        }
        return g;
      }));
    };

    if (isDemo || !supabase) {
      updateLocally();
      return;
    }

    try {
      const { error } = await supabase
        .from('group_memberships')
        .insert({
          group_id: groupId,
          person_id: personId,
        });

      if (error) throw error;
      updateLocally();
    } catch (err) {
      log.warn('Supabase write failed for addGroupMember, falling back to local state', err);
      updateLocally();
    }
  }, [isDemo]);

  // Remove member from group
  const removeGroupMember = useCallback(async (groupId: string, personId: string) => {
    const updateLocally = () => {
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return { ...g, members: g.members.filter(m => m !== personId) };
        }
        return g;
      }));
    };

    if (isDemo || !supabase) {
      updateLocally();
      return;
    }

    try {
      const { error } = await supabase
        .from('group_memberships')
        .delete()
        .eq('group_id', groupId)
        .eq('person_id', personId);

      if (error) throw error;
      updateLocally();
    } catch (err) {
      log.warn('Supabase write failed for removeGroupMember, falling back to local state', err);
      updateLocally();
    }
  }, [isDemo]);

  // Add event
  const addEvent = useCallback(async (eventData: {
    church_id: string;
    title: string;
    description?: string;
    start_date: string;
    end_date?: string;
    all_day: boolean;
    location?: string;
    category: EventCategory;
  }) => {
    const addLocally = () => {
      const newEvent: CalendarEvent = {
        id: `event-${Date.now()}`,
        church_id: eventData.church_id,
        title: eventData.title,
        description: eventData.description || null,
        start_date: eventData.start_date,
        end_date: eventData.end_date || null,
        all_day: eventData.all_day,
        location: eventData.location || null,
        category: eventData.category,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setEvents(prev => [...prev, newEvent].sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ));
      return newEvent;
    };

    if (isDemo || !supabase) {
      return addLocally();
    }

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          church_id: eventData.church_id,
          title: eventData.title,
          description: eventData.description || null,
          start_date: eventData.start_date,
          end_date: eventData.end_date || null,
          all_day: eventData.all_day,
          location: eventData.location || null,
          category: eventData.category,
        })
        .select()
        .single();

      if (error) throw error;

      setEvents(prev => [...prev, data as CalendarEvent].sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ));
      return data as CalendarEvent;
    } catch (err) {
      log.warn('Supabase write failed for addEvent, falling back to local state', err);
      return addLocally();
    }
  }, [isDemo]);

  // Update event
  const updateEvent = useCallback(async (eventId: string, updates: Partial<{
    title: string;
    description: string | null;
    start_date: string;
    end_date: string | null;
    all_day: boolean;
    location: string | null;
    category: EventCategory;
  }>) => {
    const updateLocally = () => {
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, ...updates, updated_at: new Date().toISOString() } : e
      ).sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ));
    };

    if (isDemo || !supabase) {
      updateLocally();
      return;
    }

    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw error;
      updateLocally();
    } catch (err) {
      log.warn('Supabase write failed for updateEvent, falling back to local state', err);
      updateLocally();
    }
  }, [isDemo]);

  // Delete event
  const deleteEvent = useCallback(async (eventId: string) => {
    const deleteLocally = () => {
      setEvents(prev => prev.filter(e => e.id !== eventId));
    };

    if (isDemo || !supabase) {
      deleteLocally();
      return;
    }

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      deleteLocally();
    } catch (err) {
      log.warn('Supabase write failed for deleteEvent, falling back to local state', err);
      deleteLocally();
    }
  }, [isDemo]);

  // ==========================================
  // ATTENDANCE CRUD
  // ==========================================
  const checkIn = useCallback(async (churchId: string, personId: string, eventType: import('../lib/database.types').AttendanceType, eventName?: string) => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const record = {
      church_id: churchId,
      person_id: personId,
      event_type: eventType,
      event_name: eventName || null,
      date: dateStr,
      checked_in_at: now.toISOString(),
      event_id: null,
    };

    const addLocally = (id: string) => {
      setAttendance(prev => [{ id, ...record }, ...prev]);
    };

    if (isDemo || !isSupabaseConfigured() || !supabase) {
      addLocally(`attendance-${Date.now()}`);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('attendance')
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setAttendance(prev => [data as import('../lib/database.types').Attendance, ...prev]);
      }
    } catch (err) {
      log.warn('Supabase write failed for checkIn, falling back to local state', err);
      addLocally(`attendance-${Date.now()}`);
    }
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
    attendance,

    // People actions
    addPerson,
    updatePerson,
    deletePerson,

    // Task actions
    addTask,
    toggleTask,
    updateTask,
    deleteTask,

    // Interaction actions
    addInteraction,

    // Prayer actions
    markPrayerAnswered,
    addPrayer,
    deletePrayer,

    // Giving actions
    addGiving,

    // Group actions
    createGroup,
    addGroupMember,
    removeGroupMember,

    // Event actions
    addEvent,
    updateEvent,
    deleteEvent,

    // Attendance actions
    checkIn,
  };
}
