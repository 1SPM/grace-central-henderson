import { CalendarEvent } from '../../types';

export interface RSVP {
  eventId: string;
  personId: string;
  status: 'yes' | 'no' | 'maybe';
  guestCount: number;
}

export type EventCategory = CalendarEvent['category'];
export type FilterType = 'all' | 'events' | 'birthdays' | EventCategory;

export const categoryColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  service: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/20', dot: 'bg-indigo-500' },
  meeting: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/20', dot: 'bg-amber-500' },
  event: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-500/20', dot: 'bg-green-500' },
  'small-group': { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/20', dot: 'bg-purple-500' },
  holiday: { bg: 'bg-rose-100 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-500/20', dot: 'bg-rose-500' },
  birthday: { bg: 'bg-pink-100 dark:bg-pink-500/15', text: 'text-pink-700 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-500/20', dot: 'bg-pink-500' },
  anniversary: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-500/20', dot: 'bg-red-500' },
  other: { bg: 'bg-gray-100 dark:bg-dark-700', text: 'text-gray-700 dark:text-dark-300', border: 'border-gray-200 dark:border-dark-600', dot: 'bg-gray-500' }
};

export const categoryLabels: Record<string, string> = {
  service: 'Services',
  meeting: 'Meetings',
  event: 'Events',
  'small-group': 'Small Groups',
  holiday: 'Holidays',
  birthday: 'Birthdays',
  anniversary: 'Anniversaries',
  other: 'Other'
};

export function getDateSuggestions(): { label: string; date: string }[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const thisSunday = new Date(today);
  const daysUntilSunday = (7 - today.getDay()) % 7;
  thisSunday.setDate(today.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));

  const nextSunday = new Date(thisSunday);
  nextSunday.setDate(thisSunday.getDate() + 7);

  const thisWednesday = new Date(today);
  const daysUntilWednesday = (3 - today.getDay() + 7) % 7;
  thisWednesday.setDate(today.getDate() + (daysUntilWednesday === 0 ? 7 : daysUntilWednesday));

  const thisSaturday = new Date(today);
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
  thisSaturday.setDate(today.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return [
    { label: 'Today', date: formatDate(today) },
    { label: 'Tomorrow', date: formatDate(tomorrow) },
    { label: 'This Sunday', date: formatDate(thisSunday) },
    { label: 'This Wednesday', date: formatDate(thisWednesday) },
    { label: 'This Saturday', date: formatDate(thisSaturday) },
    { label: 'Next Sunday', date: formatDate(nextSunday) },
  ];
}

export const timeSuggestions = [
  { label: '7:00 AM', time: '07:00' },
  { label: '9:00 AM', time: '09:00' },
  { label: '10:00 AM', time: '10:00' },
  { label: '11:00 AM', time: '11:00' },
  { label: '6:00 PM', time: '18:00' },
  { label: '7:00 PM', time: '19:00' },
];
