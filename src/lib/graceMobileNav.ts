import type { View } from '../types';

/** Primary bottom-nav tabs for GRACE Mobile. */
export type GraceMobileTab = 'home' | 'brief' | 'people' | 'sunday' | 'work';

/**
 * Every deep-linkable GRACE Mobile screen. Brief and Ask Grace render as
 * "stack" screens (back chevron, no tab highlighted) rather than bar tabs,
 * but stay addressable via ?tab= so shared links keep working.
 */
export type GraceMobileScreen = GraceMobileTab | 'grace';

/** Maps a GRACE Mobile screen to the admin View it renders (home is bespoke). */
export const MOBILE_TAB_TO_VIEW: Record<Exclude<GraceMobileScreen, 'home'>, View> = {
  brief: 'feed',
  people: 'people',
  sunday: 'sunday-prep',
  work: 'tasks',
  grace: 'grace',
};

/** The four bottom-bar tabs. "More" is a sheet, not a route. */
export const BAR_TABS: GraceMobileTab[] = ['home', 'people', 'sunday', 'work'];

/** Screens presented with a back chevron instead of a highlighted tab. */
export const STACK_SCREENS: ReadonlySet<GraceMobileScreen> = new Set(['brief', 'grace']);

const VALID_SCREENS: GraceMobileScreen[] = ['home', 'brief', 'people', 'sunday', 'work', 'grace'];

/** Read the requested screen from the current URL (?tab=…). */
export function parseMobileTab(): GraceMobileScreen {
  if (typeof window === 'undefined') return 'home';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  const hashTab = qIndex >= 0 ? new URLSearchParams(hash.slice(qIndex + 1)).get('tab') : null;
  const candidate = (tab || hashTab) as GraceMobileScreen | null;
  return candidate && VALID_SCREENS.includes(candidate) ? candidate : 'home';
}

/** Shareable URL for the GRACE Mobile app. */
export function graceMobileUrl(tab?: GraceMobileScreen): string {
  if (typeof window === 'undefined') return '/mobile';
  const base = `${window.location.origin}/mobile`;
  return tab && tab !== 'home' ? `${base}?tab=${tab}` : base;
}
