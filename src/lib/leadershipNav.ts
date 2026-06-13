import type { View } from '../types';

export type LeadershipHubTab = 'team' | 'faq';

export type LeadershipWorkspaceTab = 'team' | 'activity' | 'companions' | 'analytics' | 'manage';

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
  if (tab === 'activity') return 'activity';
  if (tab === 'companions' || tab === 'companion') return 'companions';
  if (tab === 'analytics') return 'analytics';
  if (tab === 'manage') return 'manage';
  if (tab === 'faq') return 'team';
  // Legacy: clergy, roster
  return 'team';
}

export function parseLeadershipLeaderId(): string | null {
  return hashParams().get('leader');
}

export function leadershipHash(
  hubTab: LeadershipHubTab = 'team',
  workspaceTab?: LeadershipWorkspaceTab,
  leaderId?: string | null,
): string {
  const params = new URLSearchParams();
  if (hubTab === 'faq') {
    params.set('tab', 'faq');
  } else if (workspaceTab && workspaceTab !== 'team') {
    params.set('tab', workspaceTab);
  }
  if (leaderId) params.set('leader', leaderId);
  const qs = params.toString();
  return qs ? `#/leadership?${qs}` : '#/leadership';
}

/** Navigate to Leadership hub, optionally opening a workspace tab. */
export function openLeadership(
  workspaceTab: LeadershipWorkspaceTab | LeadershipHubTab = 'team',
  setView: (view: View) => void,
  leaderId?: string | null,
): void {
  setView('leadership');
  const hubTab: LeadershipHubTab = workspaceTab === 'faq' ? 'faq' : 'team';
  const wsTab = workspaceTab === 'faq' ? undefined : (workspaceTab as LeadershipWorkspaceTab);
  window.history.replaceState(null, '', leadershipHash(hubTab, wsTab, leaderId));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
