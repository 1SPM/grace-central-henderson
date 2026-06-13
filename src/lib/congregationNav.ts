import type { View } from '../types';

export type CongregationTab = 'directory' | 'groups';

export function parseCongregationTab(): CongregationTab {
  if (typeof window === 'undefined') return 'directory';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'directory';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  return tab === 'groups' ? 'groups' : 'directory';
}

export function congregationHash(tab: CongregationTab = 'directory'): string {
  return tab === 'groups' ? '#/people?tab=groups' : '#/people';
}

/** Navigate to Congregation, optionally opening the Groups tab. */
export function openCongregation(
  tab: CongregationTab,
  setView: (view: View) => void,
): void {
  setView('people');
  window.history.replaceState(null, '', congregationHash(tab));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
