import { useState, useCallback } from 'react';
import { isValidEmail, sanitizePhone, sanitizeInput } from '../utils/security';
import type { Person, Task, Interaction, Attendance, View } from '../types';

interface UseAppHandlersProps {
  churchId: string;
  dbPeople: any[];
  addPerson: (data: any) => Promise<any>;
  updatePerson: (id: string, data: any) => Promise<any>;
  addTask: (data: any) => Promise<any>;
  toggleTask: (id: string) => Promise<any>;
  addInteraction: (data: any) => Promise<any>;
  addPrayer: (data: any) => Promise<any>;
  markPrayerAnswered: (id: string, testimony?: string) => Promise<any>;
  addGiving: (data: any) => Promise<any>;
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
  setView,
  setSelectedPersonId,
  openPersonForm,
  closePersonForm,
}: UseAppHandlersProps) {
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
    await addInteraction({
      church_id: churchId,
      person_id: interaction.personId,
      type: interaction.type,
      content: interaction.content,
      created_by_name: interaction.createdBy,
    });
  }, [addInteraction, churchId]);

  const handleAddTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>) => {
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
  }, [addTask, churchId]);

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
    await addPrayer({
      church_id: churchId,
      person_id: prayer.personId,
      content: prayer.content,
      is_private: prayer.isPrivate,
    });
  }, [addPrayer, churchId]);

  const handleAddGiving = useCallback(async (donation: {
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
  }, [addGiving, churchId]);

  const handleAddPerson = useCallback(() => {
    openPersonForm();
  }, [openPersonForm]);

  const handleEditPerson = useCallback((person: Person) => {
    openPersonForm(person);
  }, [openPersonForm]);

  const handleSavePerson = useCallback(async (personData: Omit<Person, 'id'> | Person) => {
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
  }, [addPerson, updatePerson, churchId, closePersonForm]);

  const handleBulkUpdateStatus = useCallback(async (ids: string[], status: Person['status']) => {
    for (const id of ids) {
      try {
        await updatePerson(id, { status });
      } catch (error) {
        console.error(`Failed to update status for person ${id}:`, error);
      }
    }
  }, [updatePerson]);

  const handleBulkAddTag = useCallback(async (ids: string[], tag: string) => {
    for (const id of ids) {
      try {
        const person = dbPeople.find(p => p.id === id);
        if (person && !person.tags.includes(tag)) {
          await updatePerson(id, { tags: [...person.tags, tag] });
        }
      } catch (error) {
        console.error(`Failed to add tag for person ${id}:`, error);
      }
    }
  }, [dbPeople, updatePerson]);

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
        console.error(`Failed to import ${firstName} ${lastName}:`, error);
      }
    }
  }, [addPerson, churchId]);

  const handleUpdatePersonTags = useCallback(async (personId: string, tags: string[]) => {
    await updatePerson(personId, { tags });
  }, [updatePerson]);

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
    },
  };
}
