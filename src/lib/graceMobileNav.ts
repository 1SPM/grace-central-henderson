import type { View } from '../types';

/** Primary bottom-nav tabs for GRACE Mobile. */
export type GraceMobileTab = 'home' | 'actions' | 'people' | 'sunday' | 'giving';

/** Maps a GRACE Mobile tab to the admin View it renders (home is bespoke). */
export const MOBILE_TAB_TO_VIEW: Record<Exclude<GraceMobileTab, 'home'>, View> = {
  actions: 'feed',
  people: 'people',
  sunday: 'sunday-prep',
  giving: 'giving',
};

const VALID_TABS: GraceMobileTab[] = ['home', 'actions', 'people', 'sunday', 'giving'];

/** Read the requested tab from the current URL (?tab=…). */
export function parseMobileTab(): GraceMobileTab {
  if (typeof window === 'undefined') return 'home';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  const hashTab = qIndex >= 0 ? new URLSearchParams(hash.slice(qIndex + 1)).get('tab') : null;
  const candidate = (tab || hashTab) as GraceMobileTab | null;
  return candidate && VALID_TABS.includes(candidate) ? candidate : 'home';
}

/** Shareable URL for the GRACE Mobile app. */
export function graceMobileUrl(tab?: GraceMobileTab): string {
  if (typeof window === 'undefined') return '/mobile';
  const base = `${window.location.origin}/mobile`;
  return tab && tab !== 'home' ? `${base}?tab=${tab}` : base;
}
