import type { View } from '../types';

export type SundayTab = 'prep' | 'calendar';

export function parseSundayTab(): SundayTab {
  if (typeof window === 'undefined') return 'prep';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'prep';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  return tab === 'calendar' ? 'calendar' : 'prep';
}

export function sundayHash(tab: SundayTab = 'prep'): string {
  return tab === 'calendar' ? '#/sunday-prep?tab=calendar' : '#/sunday-prep';
}

/** Navigate to Sunday hub, optionally opening the Calendar tab. */
export function openSunday(tab: SundayTab, setView: (view: View) => void): void {
  setView('sunday-prep');
  window.history.replaceState(null, '', sundayHash(tab));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
