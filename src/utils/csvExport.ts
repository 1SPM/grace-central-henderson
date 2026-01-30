/**
 * CSV Export Utilities
 * Export data to CSV format for importing into other systems
 */

import type { Person, Giving, CalendarEvent, Task, SmallGroup, PrayerRequest } from '../types';

// Escape CSV field (handle commas, quotes, newlines)
function escapeCSVField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';

  const str = String(value);

  // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// Convert array of objects to CSV string
function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const header = columns.map(c => escapeCSVField(c.header)).join(',');

  const rows = data.map(item =>
    columns.map(c => escapeCSVField(item[c.key] as string)).join(',')
  );

  return [header, ...rows].join('\r\n');
}

// Download CSV file
function downloadCSV(content: string, filename: string): void {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Export People to CSV
export function exportPeopleToCSV(people: Person[], filename?: string): void {
  const columns: { key: keyof Person; header: string }[] = [
    { key: 'id', header: 'ID' },
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'status', header: 'Status' },
    { key: 'address', header: 'Address' },
    { key: 'city', header: 'City' },
    { key: 'state', header: 'State' },
    { key: 'zip', header: 'ZIP Code' },
    { key: 'birthDate', header: 'Birth Date' },
    { key: 'joinDate', header: 'Join Date' },
    { key: 'firstVisit', header: 'First Visit' },
    { key: 'notes', header: 'Notes' },
  ];

  // Add tags as a comma-separated string
  const dataWithTags = people.map(p => ({
    ...p,
    tags: p.tags.join('; '),
    smallGroups: p.smallGroups.join('; '),
  }));

  const extendedColumns = [
    ...columns,
    { key: 'tags' as keyof Person, header: 'Tags' },
    { key: 'smallGroups' as keyof Person, header: 'Small Groups' },
  ];

  const csv = arrayToCSV(dataWithTags as Record<string, unknown>[], extendedColumns as { key: string; header: string }[]);
  downloadCSV(csv, filename || `people-export-${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Giving records to CSV
export function exportGivingToCSV(giving: Giving[], people: Person[], filename?: string): void {
  const personMap = new Map(people.map(p => [p.id, p]));

  const dataWithNames = giving.map(g => {
    const person = g.personId ? personMap.get(g.personId) : null;
    return {
      id: g.id,
      date: g.date,
      amount: g.amount.toFixed(2),
      fund: g.fund,
      method: g.method,
      isRecurring: g.isRecurring ? 'Yes' : 'No',
      personId: g.personId || '',
      donorName: person ? `${person.firstName} ${person.lastName}` : 'Anonymous',
      donorEmail: person?.email || '',
      note: g.note || '',
    };
  });

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'date', header: 'Date' },
    { key: 'donorName', header: 'Donor Name' },
    { key: 'donorEmail', header: 'Donor Email' },
    { key: 'amount', header: 'Amount' },
    { key: 'fund', header: 'Fund' },
    { key: 'method', header: 'Method' },
    { key: 'isRecurring', header: 'Recurring' },
    { key: 'note', header: 'Note' },
  ];

  const csv = arrayToCSV(dataWithNames as Record<string, unknown>[], columns as { key: string; header: string }[]);
  downloadCSV(csv, filename || `giving-export-${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Events to CSV
export function exportEventsToCSV(events: CalendarEvent[], filename?: string): void {
  const data = events.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description || '',
    startDate: e.startDate,
    endDate: e.endDate || '',
    allDay: e.allDay ? 'Yes' : 'No',
    location: e.location || '',
    category: e.category,
    recurrence: e.recurrence || 'none',
    capacity: e.capacity || '',
    requiresRegistration: e.requiresRegistration ? 'Yes' : 'No',
  }));

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'title', header: 'Title' },
    { key: 'description', header: 'Description' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { key: 'allDay', header: 'All Day' },
    { key: 'location', header: 'Location' },
    { key: 'category', header: 'Category' },
    { key: 'recurrence', header: 'Recurrence' },
    { key: 'capacity', header: 'Capacity' },
    { key: 'requiresRegistration', header: 'Requires Registration' },
  ];

  const csv = arrayToCSV(data as Record<string, unknown>[], columns as { key: string; header: string }[]);
  downloadCSV(csv, filename || `events-export-${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Tasks to CSV
export function exportTasksToCSV(tasks: Task[], people: Person[], filename?: string): void {
  const personMap = new Map(people.map(p => [p.id, p]));

  const data = tasks.map(t => {
    const person = t.personId ? personMap.get(t.personId) : null;
    const assignee = t.assignedTo ? personMap.get(t.assignedTo) : null;
    return {
      id: t.id,
      title: t.title,
      description: t.description || '',
      dueDate: t.dueDate,
      completed: t.completed ? 'Yes' : 'No',
      priority: t.priority,
      category: t.category,
      relatedPerson: person ? `${person.firstName} ${person.lastName}` : '',
      assignedTo: assignee ? `${assignee.firstName} ${assignee.lastName}` : '',
      createdAt: t.createdAt,
    };
  });

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'title', header: 'Title' },
    { key: 'description', header: 'Description' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'completed', header: 'Completed' },
    { key: 'priority', header: 'Priority' },
    { key: 'category', header: 'Category' },
    { key: 'relatedPerson', header: 'Related Person' },
    { key: 'assignedTo', header: 'Assigned To' },
    { key: 'createdAt', header: 'Created At' },
  ];

  const csv = arrayToCSV(data as Record<string, unknown>[], columns as { key: string; header: string }[]);
  downloadCSV(csv, filename || `tasks-export-${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Groups to CSV
export function exportGroupsToCSV(groups: SmallGroup[], people: Person[], filename?: string): void {
  const personMap = new Map(people.map(p => [p.id, p]));

  const data = groups.map(g => {
    const leader = g.leaderId ? personMap.get(g.leaderId) : null;
    const memberNames = g.members
      .map(id => personMap.get(id))
      .filter(Boolean)
      .map(p => `${p!.firstName} ${p!.lastName}`)
      .join('; ');

    return {
      id: g.id,
      name: g.name,
      description: g.description || '',
      leader: leader ? `${leader.firstName} ${leader.lastName}` : '',
      meetingDay: g.meetingDay || '',
      meetingTime: g.meetingTime || '',
      location: g.location || '',
      memberCount: g.members.length,
      members: memberNames,
      isActive: g.isActive ? 'Yes' : 'No',
    };
  });

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'leader', header: 'Leader' },
    { key: 'meetingDay', header: 'Meeting Day' },
    { key: 'meetingTime', header: 'Meeting Time' },
    { key: 'location', header: 'Location' },
    { key: 'memberCount', header: 'Member Count' },
    { key: 'members', header: 'Members' },
    { key: 'isActive', header: 'Active' },
  ];

  const csv = arrayToCSV(data as Record<string, unknown>[], columns as { key: string; header: string }[]);
  downloadCSV(csv, filename || `groups-export-${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Prayer Requests to CSV
export function exportPrayerRequestsToCSV(prayers: PrayerRequest[], people: Person[], filename?: string): void {
  const personMap = new Map(people.map(p => [p.id, p]));

  const data = prayers.map(p => {
    const person = personMap.get(p.personId);
    return {
      id: p.id,
      person: person ? `${person.firstName} ${person.lastName}` : '',
      content: p.content,
      isPrivate: p.isPrivate ? 'Yes' : 'No',
      isAnswered: p.isAnswered ? 'Yes' : 'No',
      testimony: p.testimony || '',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'person', header: 'Person' },
    { key: 'content', header: 'Prayer Request' },
    { key: 'isPrivate', header: 'Private' },
    { key: 'isAnswered', header: 'Answered' },
    { key: 'testimony', header: 'Testimony' },
    { key: 'createdAt', header: 'Created At' },
    { key: 'updatedAt', header: 'Updated At' },
  ];

  const csv = arrayToCSV(data as Record<string, unknown>[], columns as { key: string; header: string }[]);
  downloadCSV(csv, filename || `prayer-requests-export-${new Date().toISOString().split('T')[0]}.csv`);
}

// Export all data as a combined report
export interface ExportAllOptions {
  people: Person[];
  giving?: Giving[];
  events?: CalendarEvent[];
  tasks?: Task[];
  groups?: SmallGroup[];
  prayers?: PrayerRequest[];
}

export function exportAllDataToCSV(options: ExportAllOptions): void {
  const date = new Date().toISOString().split('T')[0];

  // Export each type
  exportPeopleToCSV(options.people, `people-${date}.csv`);

  if (options.giving && options.giving.length > 0) {
    exportGivingToCSV(options.giving, options.people, `giving-${date}.csv`);
  }

  if (options.events && options.events.length > 0) {
    exportEventsToCSV(options.events, `events-${date}.csv`);
  }

  if (options.tasks && options.tasks.length > 0) {
    exportTasksToCSV(options.tasks, options.people, `tasks-${date}.csv`);
  }

  if (options.groups && options.groups.length > 0) {
    exportGroupsToCSV(options.groups, options.people, `groups-${date}.csv`);
  }

  if (options.prayers && options.prayers.length > 0) {
    exportPrayerRequestsToCSV(options.prayers, options.people, `prayer-requests-${date}.csv`);
  }
}
