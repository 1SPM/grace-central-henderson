import type { View } from '../types';

export type WorkOsTab = 'overview' | 'work-orders' | 'tasks' | 'approvals' | 'agents' | 'campus' | 'audit';

const VALID_TABS: WorkOsTab[] = ['overview', 'work-orders', 'tasks', 'approvals', 'agents', 'campus', 'audit'];

function hashParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(qIndex + 1));
}

export function parseWorkOsTab(): WorkOsTab {
  const tab = hashParams().get('tab');
  return (VALID_TABS as string[]).includes(tab ?? '') ? (tab as WorkOsTab) : 'overview';
}

export function parseWorkOsId(): string | null {
  return hashParams().get('id');
}

/** Optional room context for the Campus tab. */
export function parseCampusRoom(): string | null {
  return hashParams().get('room');
}

/** Address one campus room without inventing a second routing system. */
export function campusHash(room?: string | null): string {
  const params = new URLSearchParams({ tab: 'campus' });
  if (room) params.set('room', room);
  return `#/workos?${params.toString()}`;
}

export function workosHash(tab: WorkOsTab = 'overview', id?: string | null): string {
  const params = new URLSearchParams();
  if (tab !== 'overview') params.set('tab', tab);
  if (id) params.set('id', id);
  const qs = params.toString();
  return qs ? `#/workos?${qs}` : '#/workos';
}

/** Navigate to the WorkOS hub, optionally opening a specific tab and/or Work Order. */
export function openWorkOs(tab: WorkOsTab, setView: (view: View) => void, id?: string | null): void {
  setView('workos');
  window.history.replaceState(null, '', workosHash(tab, id));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
