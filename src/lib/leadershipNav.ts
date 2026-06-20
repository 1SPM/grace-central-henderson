import type { View } from '../types';
import { careHash } from './careNav';

export type LeadershipHubTab = 'team' | 'faq';

export type LeadershipWorkspaceTab = 'team' | 'analytics' | 'manage';

export type LeadershipProfileTab = 'overview' | 'contact' | 'companion';

function hashParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(qIndex + 1));
}

export function parseLeadershipHubTab(): LeadershipHubTab {
  const tab = hashParams().get('tab');
  return tab === 'faq' ? 'faq' : 'team';
}

export function parseLeadershipWorkspaceTab(): LeadershipWorkspaceTab {
  const tab = hashParams().get('tab');
  if (tab === 'analytics') return 'analytics';
  if (tab === 'manage') return 'manage';
  if (tab === 'faq') return 'team';
  return 'team';
}

export function parseLeadershipLeaderId(): string | null {
  return hashParams().get('leader');
}

export function parseLeadershipProfileTab(): LeadershipProfileTab {
  const tab = hashParams().get('profileTab');
  if (tab === 'contact') return 'contact';
  if (tab === 'companion') return 'companion';
  return 'overview';
}

export function leadershipHash(
  hubTab: LeadershipHubTab = 'team',
  workspaceTab?: LeadershipWorkspaceTab,
  leaderId?: string | null,
  profileTab?: LeadershipProfileTab,
): string {
  const params = new URLSearchParams();
  if (hubTab === 'faq') {
    params.set('tab', 'faq');
  } else if (workspaceTab && workspaceTab !== 'team') {
    params.set('tab', workspaceTab);
  }
  if (leaderId) params.set('leader', leaderId);
  if (profileTab && profileTab !== 'overview') params.set('profileTab', profileTab);
  const qs = params.toString();
  return qs ? `#/leadership?${qs}` : '#/leadership';
}

/** Redirect legacy leadership workspace tabs removed from the hub. Returns true if redirected. */
export function resolveLegacyLeadershipHash(
  fallbackLeaderId?: string | null,
  onNavigate?: (view: View | string) => void,
): boolean {
  if (typeof window === 'undefined') return false;
  const tab = hashParams().get('tab');
  if (tab === 'activity') {
    onNavigate?.('pastoral-care');
    window.history.replaceState(null, '', careHash('dispatch'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return true;
  }
  if (tab === 'companions' || tab === 'companion') {
    const leaderId = parseLeadershipLeaderId() ?? fallbackLeaderId ?? null;
    window.history.replaceState(
      null,
      '',
      leadershipHash('team', 'team', leaderId, 'companion'),
    );
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return true;
  }
  return false;
}

/** Navigate to Leadership hub, optionally opening a workspace tab. */
export function openLeadership(
  workspaceTab: LeadershipWorkspaceTab | LeadershipHubTab = 'team',
  setView: (view: View) => void,
  leaderId?: string | null,
  profileTab?: LeadershipProfileTab,
): void {
  setView('leadership');
  const hubTab: LeadershipHubTab = workspaceTab === 'faq' ? 'faq' : 'team';
  const wsTab = workspaceTab === 'faq' ? undefined : (workspaceTab as LeadershipWorkspaceTab);
  window.history.replaceState(null, '', leadershipHash(hubTab, wsTab, leaderId, profileTab));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
