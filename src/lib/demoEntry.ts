/**
 * Demo marketing entry — gate CRM access until a visitor clicks a CTA.
 * Used when VITE_ENABLE_DEMO_MODE=true (grace-crm-two demo deploy).
 */

import { DEMO_ONBOARDING_SKIP } from '../config/centralHenderson';

const DEMO_ENTERED_KEY = 'grace_demo_entered';
export const DEMO_ENTERED_EVENT = 'grace-demo-entered';

export const isDemoModeEnabled = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

export { DEMO_ONBOARDING_SKIP };

export function hasEnteredDemo(): boolean {
  try {
    return sessionStorage.getItem(DEMO_ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

export function applyDemoOnboardingSkip(): void {
  try {
    // Hide sidebar setup checklist (3-day first-seen gate in App.tsx)
    localStorage.setItem(
      'grace.checklistFirstSeenAt',
      String(Date.now() - 4 * 24 * 60 * 60 * 1000),
    );
  } catch {
    // ignore storage errors
  }
}

export function enterDemoSession(): void {
  try {
    sessionStorage.setItem(DEMO_ENTERED_KEY, '1');
  } catch {
    // ignore storage errors
  }
  applyDemoOnboardingSkip();
  window.dispatchEvent(new Event(DEMO_ENTERED_EVENT));
}

export function clearDemoSession(): void {
  try {
    sessionStorage.removeItem(DEMO_ENTERED_KEY);
  } catch {
    // ignore storage errors
  }
}

export function navigateToDemoCrm(): void {
  enterDemoSession();
  if (window.location.pathname !== '/') {
    window.location.href = '/#dashboard';
    return;
  }
  window.location.hash = 'dashboard';
}

/** Strip ?enter=demo from URL and land on the CRM dashboard. Call once on app boot. */
export function handleDemoEntryQuery(): void {
  if (!isDemoModeEnabled) return;
  const params = new URLSearchParams(window.location.search);
  const enter = params.get('enter');
  if (enter !== 'demo' && enter !== '1') return;

  enterDemoSession();
  const url = new URL(window.location.href);
  url.searchParams.delete('enter');
  url.hash = 'dashboard';
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
