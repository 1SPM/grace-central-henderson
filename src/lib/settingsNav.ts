import type { View } from '../types';

export type SettingsTab = 'general' | 'forms' | 'email-templates' | 'reports' | 'tags' | 'analytics';

const TAB_TO_VIEW: Record<SettingsTab, View> = {
  general: 'settings',
  forms: 'forms',
  'email-templates': 'email-templates',
  reports: 'reports',
  tags: 'tags',
  analytics: 'analytics',
};

export function parseSettingsTab(): SettingsTab {
  if (typeof window === 'undefined') return 'general';
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return 'general';
  const tab = new URLSearchParams(hash.slice(qIndex + 1)).get('tab');
  if (tab === 'forms') return 'forms';
  if (tab === 'email-templates') return 'email-templates';
  if (tab === 'reports') return 'reports';
  if (tab === 'tags') return 'tags';
  if (tab === 'analytics') return 'analytics';
  return 'general';
}

export function settingsHash(tab: SettingsTab = 'general'): string {
  if (tab === 'general') return '#/settings';
  return `#/settings?tab=${tab}`;
}

/** Navigate to Settings, optionally opening a tools tab. */
export function openSettings(tab: SettingsTab, setView: (view: View) => void): void {
  setView(TAB_TO_VIEW[tab]);
  window.history.replaceState(null, '', settingsHash(tab));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function settingsTabFromView(view: View): SettingsTab | null {
  if (view === 'settings') return 'general';
  if (view === 'forms') return 'forms';
  if (view === 'email-templates') return 'email-templates';
  if (view === 'reports') return 'reports';
  if (view === 'tags') return 'tags';
  if (view === 'analytics') return 'analytics';
  return null;
}
