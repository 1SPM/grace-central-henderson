import { useState, useCallback } from 'react';
import { isValidEmail, sanitizePhone, sanitizeInput } from '../utils/security';
import { createLogger } from '../utils/logger';
import { useToast } from '../components/Toast';

const log = createLogger('app-handlers');
import type { Person, Task, Interaction, Attendance, View, EventCategory } from '../types';
import type {
  Person as DbPerson,
  PersonInsert,
  TaskInsert,
  InteractionInsert,
  PrayerRequestInsert,
} from '../lib/database.types';

interface UseAppHandlersProps {
  churchId: string;
  dbPeople: DbPerson[];
  addPerson: (data: PersonInsert) => Promise<unknown>;
  updatePerson: (id: string, data: Partial<DbPerson>) => Promise<unknown>;
  addTask: (data: TaskInsert) => Promise<unknown>;
  toggleTask: (id: string) => Promise<unknown>;
  addInteraction: (data: InteractionInsert) => Promise<unknown>;
  addPrayer: (data: PrayerRequestInsert) => Promise<unknown>;
  markPrayerAnswered: (id: string, testimony?: string) => Promise<unknown>;
  addGiving: (data: {
    church_id: string;
    person_id: string | null;
    amount: number;
    fund: string;
    date: string;
    method: string;
    is_recurring?: boolean;
    note?: string | null;
  }) => Promise<unknown>;
  createGroup?: (data: {
    church_id: string;
    name: string;
    description?: string;
    leader_id?: string;
    meeting_day?: string;
    meeting_time?: string;
    location?: string;
  }) => Promise<unknown>;
  addGroupMember?: (groupId: string, personId: string) => Promise<unknown>;
  removeGroupMember?: (groupId: string, personId: string) => Promise<unknown>;
  addEvent?: (data: {
    church_id: string;
    title: string;
    description?: string;
    start_date: string;
    end_date?: string;
    all_day: boolean;
    location?: string;
    category: EventCategory;
  }) => Promise<unknown>;
  updateEvent?: (id: string, data: Partial<{
    title: string;
    description: string | null;
    start_date: string;
    end_date: string | null;
    all_day: boolean;
    location: string | null;
    category: EventCategory;
  }>) => Promise<unknown>;
  deleteEvent?: (id: string) => Promise<unknown>;
  setView: (view: View) => void;
  setSelectedPersonId: (id: string | null) => void;
  openPersonForm: (person?: Person) => void;
  closePersonForm: () => void;
}

export function useAppHandlers({
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
  createGroup,
  addGroupMember,
  removeGroupMember,
  addEvent,
  updateEvent,
  deleteEvent,
  setView,
  setSelectedPersonId,
  openPersonForm,
  closePersonForm,
}: UseAppHandlersProps) {
  const toast = useToast();

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

  const handleViewPerson = useCallback((id: string) => {
    setSelectedPersonId(id);
    setView('person');
  }, [setSelectedPersonId, setView]);

  const handleBackToPeople = useCallback(() => {
    setSelectedPersonId(null);
    setView('people');
  }, [setSelectedPersonId, setView]);

  const handleAddInteraction = useCallback(async (interaction: Omit<Interaction, 'id' | 'createdAt'>) => {
    try {
      await addInteraction({
        church_id: churchId,
        person_id: interaction.personId,
        type: interaction.type,
        content: interaction.content,
        created_by_name: interaction.createdBy,
      });
    } catch (error) {
      log.error('Failed to add interaction', error);
      toast.error('Failed to save interaction. Please try again.');
    }
  }, [addInteraction, churchId, toast]);

  const handleAddTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>) => {
    try {
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
    } catch (error) {
      log.error('Failed to add task', error);
      toast.error('Failed to create task. Please try again.');
    }
  }, [addTask, churchId, toast]);

  const handleToggleTask = useCallback(async (taskId: string) => {
    await toggleTask(taskId);
  }, [toggleTask]);

  const handleMarkPrayerAnswered = useCallback(async (id: string, testimony?: string) => {
    await markPrayerAnswered(id, testimony);
  }, [markPrayerAnswered]);

  const handleCheckIn = useCallback((personId: string, eventType: Attendance['eventType'], eventName?: string) => {
    const newRecord: Attendance = {
      id: `attendance-${Date.now()}`,
      personId,
      eventType,
      eventName,
      date: new Date().toISOString().split('T')[0],
      checkedInAt: new Date().toISOString(),
    };
    setAttendanceRecords((prev) => [...prev, newRecord]);
  }, []);

  const handleRSVP = useCallback((eventId: string, personId: string, status: 'yes' | 'no' | 'maybe', guestCount: number = 0) => {
    setRsvps((prev) => {
      const existingIndex = prev.findIndex((r) => r.eventId === eventId && r.personId === personId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { eventId, personId, status, guestCount };
        return updated;
      }
      return [...prev, { eventId, personId, status, guestCount }];
    });
  }, []);

  const handleAssignVolunteer = useCallback((eventId: string, roleId: string, personId: string) => {
    const newAssignment = {
      id: `vol-${Date.now()}`,
      eventId,
      roleId,
      personId,
      status: 'pending' as const,
    };
    setVolunteerAssignments((prev) => [...prev, newAssignment]);
  }, []);

  const handleUpdateVolunteerStatus = useCallback((assignmentId: string, status: 'confirmed' | 'pending' | 'declined') => {
    setVolunteerAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, status } : a))
    );
  }, []);

  const handleRemoveVolunteer = useCallback((assignmentId: string) => {
    setVolunteerAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }, []);

  const handleAddPrayer = useCallback(async (prayer: { personId: string; content: string; isPrivate: boolean }) => {
    try {
      await addPrayer({
        church_id: churchId,
        person_id: prayer.personId,
        content: prayer.content,
        is_private: prayer.isPrivate,
      });
    } catch (error) {
      log.error('Failed to add prayer request', error);
      toast.error('Failed to save prayer request. Please try again.');
    }
  }, [addPrayer, churchId, toast]);

  const handleAddGiving = useCallback(async (donation: {
    personId?: string;
    amount: number;
    fund: string;
    method: string;
    date: string;
    isRecurring: boolean;
    note?: string;
  }) => {
    try {
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
    } catch (error) {
      log.error('Failed to record donation', error);
      toast.error('Failed to record donation. Please try again.');
    }
  }, [addGiving, churchId, toast]);

  const handleAddPerson = useCallback(() => {
    openPersonForm();
  }, [openPersonForm]);

  const handleEditPerson = useCallback((person: Person) => {
    openPersonForm(person);
  }, [openPersonForm]);

  const handleSavePerson = useCallback(async (personData: Omit<Person, 'id'> | Person) => {
    try {
      if ('id' in personData) {
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
      closePersonForm();
    } catch (error) {
      log.error('Failed to save person', error);
      toast.error('Failed to save person. Please try again.');
    }
  }, [addPerson, updatePerson, churchId, closePersonForm, toast]);

  const handleBulkUpdateStatus = useCallback(async (ids: string[], status: Person['status']) => {
    let failures = 0;
    for (const id of ids) {
      try {
        await updatePerson(id, { status });
      } catch (error) {
        log.error(`Failed to update status for person ${id}`, error);
        failures++;
      }
    }
    if (failures > 0) {
      toast.error(`Failed to update ${failures} of ${ids.length} people.`);
    }
  }, [updatePerson, toast]);

  const handleBulkAddTag = useCallback(async (ids: string[], tag: string) => {
    let failures = 0;
    for (const id of ids) {
      try {
        const person = dbPeople.find(p => p.id === id);
        if (person && !person.tags.includes(tag)) {
          await updatePerson(id, { tags: [...person.tags, tag] });
        }
      } catch (error) {
        log.error(`Failed to add tag for person ${id}`, error);
        failures++;
      }
    }
    if (failures > 0) {
      toast.error(`Failed to tag ${failures} of ${ids.length} people.`);
    }
  }, [dbPeople, updatePerson, toast]);

  const handleImportCSV = useCallback(async (importedPeople: Partial<Person>[]) => {
    for (const person of importedPeople) {
      const firstName = sanitizeInput(person.firstName || '', { maxLength: 100 });
      const lastName = sanitizeInput(person.lastName || '', { maxLength: 100 });
      if (!firstName || !lastName) continue;

      const email = person.email && isValidEmail(person.email) ? person.email : null;
      const phone = person.phone ? sanitizePhone(person.phone) : null;
      const validStatuses = ['visitor', 'regular', 'member', 'leader', 'inactive'];
      const status = validStatuses.includes(person.status || '') ? person.status as Person['status'] : 'visitor';

      try {
        await addPerson({
          church_id: churchId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          status,
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
      } catch (error) {
        log.error(`Failed to import ${firstName} ${lastName}`, error);
      }
    }
  }, [addPerson, churchId]);

  const handleUpdatePersonTags = useCallback(async (personId: string, tags: string[]) => {
    await updatePerson(personId, { tags });
  }, [updatePerson]);

  // Group handlers
  const handleCreateGroup = useCallback(async (groupData: {
    name: string;
    description?: string;
    leaderId?: string;
    members?: string[];
    meetingDay?: string;
    meetingTime?: string;
    location?: string;
  }) => {
    if (!createGroup) return;
    await createGroup({
      church_id: churchId,
      name: groupData.name,
      description: groupData.description,
      leader_id: groupData.leaderId,
      meeting_day: groupData.meetingDay,
      meeting_time: groupData.meetingTime,
      location: groupData.location,
    });
  }, [createGroup, churchId]);

  const handleAddGroupMember = useCallback(async (groupId: string, personId: string) => {
    if (!addGroupMember) return;
    await addGroupMember(groupId, personId);
  }, [addGroupMember]);

  const handleRemoveGroupMember = useCallback(async (groupId: string, personId: string) => {
    if (!removeGroupMember) return;
    await removeGroupMember(groupId, personId);
  }, [removeGroupMember]);

  // Event handlers
  const handleAddEvent = useCallback(async (eventData: {
    title: string;
    description?: string;
    startDate: string;
    endDate?: string;
    allDay: boolean;
    location?: string;
    category: EventCategory;
  }) => {
    if (!addEvent) return;
    try {
      await addEvent({
        church_id: churchId,
        title: eventData.title,
        description: eventData.description,
        start_date: eventData.startDate,
        end_date: eventData.endDate,
        all_day: eventData.allDay,
        location: eventData.location,
        category: eventData.category,
      });
    } catch (error) {
      log.error('Failed to create event', error);
      toast.error('Failed to create event. Please try again.');
    }
  }, [addEvent, churchId, toast]);

  const handleUpdateEvent = useCallback(async (eventId: string, updates: {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    allDay?: boolean;
    location?: string;
    category?: EventCategory;
  }) => {
    if (!updateEvent) return;
    await updateEvent(eventId, {
      title: updates.title,
      description: updates.description,
      start_date: updates.startDate,
      end_date: updates.endDate,
      all_day: updates.allDay,
      location: updates.location,
      category: updates.category,
    });
  }, [updateEvent]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!deleteEvent) return;
    await deleteEvent(eventId);
  }, [deleteEvent]);

  return {
    // State
    attendanceRecords,
    rsvps,
    volunteerAssignments,
    // Handlers
    handlers: {
      viewPerson: handleViewPerson,
      backToPeople: handleBackToPeople,
      addPerson: handleAddPerson,
      editPerson: handleEditPerson,
      savePerson: handleSavePerson,
      addInteraction: handleAddInteraction,
      addTask: handleAddTask,
      toggleTask: handleToggleTask,
      markPrayerAnswered: handleMarkPrayerAnswered,
      checkIn: handleCheckIn,
      rsvp: handleRSVP,
      assignVolunteer: handleAssignVolunteer,
      updateVolunteerStatus: handleUpdateVolunteerStatus,
      removeVolunteer: handleRemoveVolunteer,
      addPrayer: handleAddPrayer,
      addGiving: handleAddGiving,
      bulkUpdateStatus: handleBulkUpdateStatus,
      bulkAddTag: handleBulkAddTag,
      importCSV: handleImportCSV,
      updatePersonTags: handleUpdatePersonTags,
      createGroup: handleCreateGroup,
      addGroupMember: handleAddGroupMember,
      removeGroupMember: handleRemoveGroupMember,
      addEvent: handleAddEvent,
      updateEvent: handleUpdateEvent,
      deleteEvent: handleDeleteEvent,
    },
  };
}
