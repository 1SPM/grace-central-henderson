import type { View } from '../types';
import { openCongregation } from './congregationNav';
import { openSunday } from './sundayNav';
import { openLeadership } from './leadershipNav';

export type ActionCenterTab = 'followups' | 'mail';

export function parseActionCenterTab(): ActionCenterTab {
  if (typeof window === 'undefined') return 'followups';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'followups';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  return tab === 'mail' ? 'mail' : 'followups';
}

export function actionCenterHash(tab: ActionCenterTab = 'followups'): string {
  return tab === 'mail' ? '#/actions?tab=mail' : '#/actions';
}

/** Navigate to Action Center, optionally opening the Mail tab. */
export function openActionCenter(
  tab: ActionCenterTab,
  setView: (view: View) => void,
): void {
  setView('feed');
  window.history.replaceState(null, '', actionCenterHash(tab));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Route helper — maps legacy views to tabbed hubs. */
export function navigateView(view: View | string, setView: (v: View) => void): void {
  if (['financial-hub', 'follow-up-automation', 'planning-center-import', 'reminders'].includes(view)) {
    setView('dashboard');
    return;
  }
  if (view === 'mail') {
    openActionCenter('mail', setView);
    return;
  }
  if (view === 'groups') {
    openCongregation('groups', setView);
    return;
  }
  if (view === 'calendar') {
    openSunday('calendar', setView);
    return;
  }
  if (view === 'live-service') {
    openSunday('live', setView);
    return;
  }
  if (view === 'grace' || view === 'leader-management') {
    openLeadership(view === 'leader-management' ? 'manage' : 'team', setView);
    return;
  }
  setView(view as View);
}
