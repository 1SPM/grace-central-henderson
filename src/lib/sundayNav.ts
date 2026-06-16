import type { View } from '../types';

export type SundayTab = 'prep' | 'calendar' | 'attendance' | 'announcements';

export function parseSundayTab(): SundayTab {
  if (typeof window === 'undefined') return 'prep';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'prep';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  if (tab === 'calendar') return 'calendar';
  if (tab === 'attendance') return 'attendance';
  if (tab === 'announcements') return 'announcements';
  return 'prep';
}

export function sundayHash(tab: SundayTab = 'prep'): string {
  if (tab === 'calendar') return '#/sunday-prep?tab=calendar';
  if (tab === 'attendance') return '#/sunday-prep?tab=attendance';
  if (tab === 'announcements') return '#/sunday-prep?tab=announcements';
  return '#/sunday-prep';
}

/** Navigate to Sunday hub, optionally opening a specific tab. */
export function openSunday(tab: SundayTab, setView: (view: View) => void): void {
  setView('sunday-prep');
  window.history.replaceState(null, '', sundayHash(tab));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
