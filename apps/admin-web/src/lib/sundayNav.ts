import type { View } from '../types';
import type { ConnectSubjectKind } from '../config/sermonConnectSubjects';

export type SundayTab = 'prep' | 'calendar' | 'attendance' | 'announcements' | 'archive';

export interface SundayArchiveFilter {
  kind?: ConnectSubjectKind;
  filter?: string;
}

export function parseSundayTab(): SundayTab {
  if (typeof window === 'undefined') return 'prep';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'prep';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  if (tab === 'calendar') return 'calendar';
  if (tab === 'attendance') return 'attendance';
  if (tab === 'announcements') return 'announcements';
  if (tab === 'archive') return 'archive';
  return 'prep';
}

export function parseSundayArchiveFilter(): SundayArchiveFilter {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return {};
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  const kind = params.get('kind');
  const filter = params.get('filter') ?? undefined;
  if (kind === 'topics' || kind === 'scripture' || kind === 'illustrations') {
    return { kind, filter };
  }
  return { filter };
}

export function sundayHash(tab: SundayTab = 'prep', archiveFilter?: SundayArchiveFilter): string {
  if (tab === 'archive') {
    const params = new URLSearchParams({ tab: 'archive' });
    if (archiveFilter?.kind) params.set('kind', archiveFilter.kind);
    if (archiveFilter?.filter) params.set('filter', archiveFilter.filter);
    return `#/sunday-prep?${params.toString()}`;
  }
  if (tab === 'calendar') return '#/sunday-prep?tab=calendar';
  if (tab === 'attendance') return '#/sunday-prep?tab=attendance';
  if (tab === 'announcements') return '#/sunday-prep?tab=announcements';
  return '#/sunday-prep';
}

/** Navigate to Sunday hub, optionally opening a specific tab. */
export function openSunday(
  tab: SundayTab,
  setView: (view: View) => void,
  archiveFilter?: SundayArchiveFilter,
): void {
  setView('sunday-prep');
  window.history.replaceState(null, '', sundayHash(tab, archiveFilter));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
