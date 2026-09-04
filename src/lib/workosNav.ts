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
  return (VALID_TABS as string[]).includes(tab ?? '') ? (tab as WorkOsTab) : 'agents';
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

export function workosHash(tab: WorkOsTab = 'agents', id?: string | null): string {
  const params = new URLSearchParams();
  if (tab !== 'agents') params.set('tab', tab);
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

/**
 * Follow one of the app's own `#/view?…` links from a click handler.
 *
 * The app is not hash-routed: only WorkOsHub, Congregation and SundayPage
 * listen for hashchange, and only to sync a tab. A plain `<a href="#/workos…">`
 * therefore changes the URL and nothing else — which is how the dashboard's
 * "Approvals (1)" chip was a dead link in the 2026-09-04 browser rehearsal,
 * right after GRACE said "I've sent it to the Decision Queue".
 *
 * Returns false for anything that is not an in-app hash link, so the caller
 * can let the browser have it.
 */
export function openHashRoute(href: string, setView: (view: View) => void): boolean {
  const match = /^#\/([a-z-]+)(\?.*)?$/.exec(href);
  if (!match) return false;
  const [, view, query = ''] = match;
  const params = new URLSearchParams(query.slice(1));
  if (view === 'workos') {
    const tab = params.get('tab');
    openWorkOs((VALID_TABS as string[]).includes(tab ?? '') ? (tab as WorkOsTab) : 'agents', setView, params.get('id'));
    return true;
  }
  setView(view as View);
  window.history.replaceState(null, '', href);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  return true;
}
