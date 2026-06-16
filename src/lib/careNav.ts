import type { View } from '../types';

export type CareTab = 'dispatch' | 'life-services';

export function parseCareTab(): CareTab {
  if (typeof window === 'undefined') return 'dispatch';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'dispatch';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  if (tab === 'life-services') return 'life-services';
  return 'dispatch';
}

export function careHash(tab: CareTab = 'dispatch'): string {
  if (tab === 'life-services') return '#/pastoral-care?tab=life-services';
  return '#/pastoral-care';
}

/** Navigate to Pastoral Care hub, optionally opening Life Services. */
export function openCare(tab: CareTab, setView: (view: View) => void): void {
  setView('pastoral-care');
  window.history.replaceState(null, '', careHash(tab));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
