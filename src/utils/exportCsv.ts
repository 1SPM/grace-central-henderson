import type { Person, Task, Giving, PrayerRequest } from '../types';

// Escape CSV values that contain commas, quotes, or newlines
function escapeCSVValue(value: string | number | boolean | undefined | null): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Convert array of objects to CSV string
function toCSV<T extends Record<string, unknown>>(data: T[], columns: { key: keyof T; header: string }[]): string {
  const headers = columns.map(col => col.header).join(',');
  const rows = data.map(item =>
    columns.map(col => escapeCSVValue(item[col.key] as string | number | boolean | undefined | null)).join(',')
  );
  return [headers, ...rows].join('\n');
}

// Download CSV file
function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export People to CSV
export function exportPeopleToCSV(people: Person[]): void {
  const columns: { key: keyof Person; header: string }[] = [
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'status', header: 'Status' },
    { key: 'address', header: 'Address' },
    { key: 'city', header: 'City' },
    { key: 'state', header: 'State' },
    { key: 'zip', header: 'ZIP' },
    { key: 'birthDate', header: 'Birth Date' },
    { key: 'joinDate', header: 'Join Date' },
    { key: 'firstVisit', header: 'First Visit' },
    { key: 'tags', header: 'Tags' },
    { key: 'notes', header: 'Notes' },
  ];

  // Transform tags array to string
  const transformedData = people.map(p => ({
    ...p,
    tags: p.tags.join('; '),
  }));

  const csv = toCSV(transformedData, columns);
  downloadCSV(csv, 'grace_people');
}

// Export Tasks to CSV
export function exportTasksToCSV(tasks: Task[], people: Person[]): void {
  // Create a lookup map for people
  const peopleMap = new Map(people.map(p => [p.id, `${p.firstName} ${p.lastName}`]));

  const transformedData = tasks.map(t => ({
    ...t,
    personName: t.personId ? peopleMap.get(t.personId) || 'Unknown' : '',
    dueDate: t.dueDate,
    status: t.completed ? 'Completed' : 'Pending',
  }));

  const columns = [
    { key: 'title' as const, header: 'Title' },
    { key: 'description' as const, header: 'Description' },
    { key: 'personName' as const, header: 'Related Person' },
    { key: 'priority' as const, header: 'Priority' },
    { key: 'category' as const, header: 'Category' },
    { key: 'dueDate' as const, header: 'Due Date' },
    { key: 'status' as const, header: 'Status' },
    { key: 'createdAt' as const, header: 'Created' },
  ];

  const csv = toCSV(transformedData, columns);
  downloadCSV(csv, 'grace_tasks');
}

// Export Giving to CSV
export function exportGivingToCSV(giving: Giving[], people: Person[]): void {
  const peopleMap = new Map(people.map(p => [p.id, `${p.firstName} ${p.lastName}`]));

  const transformedData = giving.map(g => ({
    ...g,
    personName: g.personId ? peopleMap.get(g.personId) || 'Anonymous' : 'Anonymous',
    amount: `$${g.amount.toFixed(2)}`,
  }));

  const columns = [
    { key: 'date' as const, header: 'Date' },
    { key: 'personName' as const, header: 'Donor' },
    { key: 'amount' as const, header: 'Amount' },
    { key: 'fund' as const, header: 'Fund' },
    { key: 'method' as const, header: 'Method' },
    { key: 'isRecurring' as const, header: 'Recurring' },
    { key: 'note' as const, header: 'Note' },
  ];

  const csv = toCSV(transformedData, columns);
  downloadCSV(csv, 'grace_giving');
}

// Export Prayer Requests to CSV
export function exportPrayersToCSV(prayers: PrayerRequest[], people: Person[]): void {
  const peopleMap = new Map(people.map(p => [p.id, `${p.firstName} ${p.lastName}`]));

  const transformedData = prayers.map(p => ({
    ...p,
    personName: peopleMap.get(p.personId) || 'Unknown',
    status: p.isAnswered ? 'Answered' : 'Active',
    visibility: p.isPrivate ? 'Private' : 'Public',
  }));

  const columns = [
    { key: 'createdAt' as const, header: 'Date' },
    { key: 'personName' as const, header: 'Person' },
    { key: 'content' as const, header: 'Request' },
    { key: 'status' as const, header: 'Status' },
    { key: 'visibility' as const, header: 'Visibility' },
    { key: 'testimony' as const, header: 'Testimony' },
  ];

  const csv = toCSV(transformedData, columns);
  downloadCSV(csv, 'grace_prayers');
}
