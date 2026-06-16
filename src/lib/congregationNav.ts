import type { View } from '../types';

export type CongregationTab = 'directory' | 'groups' | 'skills';

export function parseCongregationTab(): CongregationTab {
  if (typeof window === 'undefined') return 'directory';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'directory';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  if (tab === 'groups') return 'groups';
  if (tab === 'skills') return 'skills';
  return 'directory';
}

export function congregationHash(tab: CongregationTab = 'directory'): string {
  if (tab === 'groups') return '#/people?tab=groups';
  if (tab === 'skills') return '#/people?tab=skills';
  return '#/people';
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
