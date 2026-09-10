import type { View } from '../types';

export type CareTab = 'dispatch' | 'life-services' | 'requests';

function hashParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(qIndex + 1));
}

export function parseCareTab(): CareTab {
  const tab = hashParams().get('tab');
  if (tab === 'life-services') return 'life-services';
  if (tab === 'requests') return 'requests';
  return 'dispatch';
}

export function parseCareLeaderId(): string | null {
  return hashParams().get('leader');
}

export function careHash(tab: CareTab = 'dispatch', leaderId?: string | null): string {
  const params = new URLSearchParams();
  if (tab === 'life-services' || tab === 'requests') params.set('tab', tab);
  if (leaderId) params.set('leader', leaderId);
  const qs = params.toString();
  return qs ? `#/pastoral-care?${qs}` : '#/pastoral-care';
}

/** Navigate to Pastoral Care hub, optionally opening Life Services or filtering by leader. */
export function openCare(
  tab: CareTab,
  setView: (view: View) => void,
  leaderId?: string | null,
): void {
  setView('pastoral-care');
  window.history.replaceState(null, '', careHash(tab, leaderId));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
