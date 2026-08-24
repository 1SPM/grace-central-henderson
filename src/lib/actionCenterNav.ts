import type { View } from '../types';
import { openCongregation } from './congregationNav';
import { openSunday } from './sundayNav';
import { openLeadership } from './leadershipNav';
import { openCare } from './careNav';
import { openSettings, type SettingsTab } from './settingsNav';

export type ActionCenterTab = 'mywork' | 'followups' | 'mail' | 'birthdays' | 'live' | 'volunteers';

// "My Work" reads first — what GRACE's agents are doing on your behalf,
// and whether you need to step in, is the thing worth checking before
// anything else here. Mirrors GRACE WorkOS putting Agents first for the
// pastor (src/components/workos/WorkOsHub.tsx).
export function parseActionCenterTab(): ActionCenterTab {
  if (typeof window === 'undefined') return 'mywork';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'mywork';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  if (tab === 'followups') return 'followups';
  if (tab === 'mail') return 'mail';
  if (tab === 'birthdays') return 'birthdays';
  if (tab === 'live') return 'live';
  if (tab === 'volunteers') return 'volunteers';
  return 'mywork';
}

export function actionCenterHash(tab: ActionCenterTab = 'mywork'): string {
  if (tab === 'followups') return '#/actions?tab=followups';
  if (tab === 'mail') return '#/actions?tab=mail';
  if (tab === 'birthdays') return '#/actions?tab=birthdays';
  if (tab === 'live') return '#/actions?tab=live';
  if (tab === 'volunteers') return '#/actions?tab=volunteers';
  return '#/actions';
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
  if (['financial-hub', 'follow-up-automation', 'planning-center-import', 'reminders', 'agents'].includes(view)) {
    setView('dashboard');
    return;
  }
  if (view === 'mail') {
    openActionCenter('mail', setView);
    return;
  }
  if (view === 'birthdays') {
    openActionCenter('birthdays', setView);
    return;
  }
  if (view === 'live-service') {
    openActionCenter('live', setView);
    return;
  }
  if (view === 'volunteers') {
    openActionCenter('volunteers', setView);
    return;
  }
  if (view === 'life-services') {
    openCare('life-services', setView);
    return;
  }
  if (view === 'groups') {
    openCongregation('groups', setView);
    return;
  }
  if (view === 'families') {
    openCongregation('families', setView);
    return;
  }
  if (view === 'skills') {
    openCongregation('skills', setView);
    return;
  }
  if (view === 'child-checkin') {
    openSunday('attendance', setView);
    return;
  }
  if (view === 'forms' || view === 'email-templates' || view === 'reports' || view === 'tags' || view === 'analytics') {
    openSettings(view as SettingsTab, setView);
    return;
  }
  if (view === 'calendar') {
    openSunday('calendar', setView);
    return;
  }
  if (view === 'grace' || view === 'leader-management') {
    openLeadership(view === 'leader-management' ? 'manage' : 'team', setView);
    return;
  }
  setView(view as View);
}
