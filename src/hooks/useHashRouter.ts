/**
 * Hash-based router hook for SPA navigation
 *
 * Maps View types to URL hashes (e.g., #/people, #/calendar)
 * and supports browser back/forward navigation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { View } from '../types';

// Map views to URL-friendly path segments
const VIEW_TO_PATH: Record<View, string> = {
  home: 'redesign',
  dashboard: 'dashboard',
  feed: 'actions',
  people: 'people',
  person: 'person',
  tasks: 'tasks',
  pipeline: 'visitors',
  attendance: 'attendance',
  calendar: 'calendar',
  volunteers: 'volunteers',
  groups: 'groups',
  families: 'families',
  skills: 'skills',
  prayer: 'prayer',
  giving: 'giving',
  'online-giving': 'online-giving',
  'batch-entry': 'batch-entry',
  pledges: 'pledges',
  campaigns: 'campaigns',
  statements: 'statements',
  'charity-baskets': 'charity-baskets',
  'donation-tracker': 'donation-tracker',
  'member-stats': 'member-stats',
  tags: 'tags',
  reports: 'reports',
  birthdays: 'birthdays',
  agents: 'agents',
  settings: 'settings',
  'connect-card': 'connect-card',
  directory: 'directory',
  'child-checkin': 'child-checkin',
  forms: 'forms',
  'email-templates': 'email-templates',
  'member-portal': 'member-portal',
  'member-directory': 'member-directory',
  'member-giving': 'member-giving',
  'member-events': 'member-events',
  'member-checkin': 'member-checkin',
  'sunday-prep': 'sunday-prep',
  'live-service': 'live-service',
  'event-registration': 'event-registration',
  reminders: 'reminders',
  'planning-center-import': 'planning-center-import',
  'qr-checkin': 'qr-checkin',
  'follow-up-automation': 'follow-up-automation',
  'pastoral-care': 'pastoral-care',
  'life-services': 'life-services',
  'wedding-services': 'wedding-services',
  'funeral-services': 'funeral-services',
  'estate-planning': 'estate-planning',
  'leader-management': 'leader-management',
  analytics: 'analytics',
  announcements: 'announcements',
  'discipleship-engagement': 'discipleship-engagement',
  leadership: 'leadership',
  grace: 'grace',
  mail: 'mail',
  'financial-hub': 'financial-hub',
  wallets: 'wallets',
};

// Reverse map: path -> view
const PATH_TO_VIEW: Record<string, View> = {};
for (const [view, path] of Object.entries(VIEW_TO_PATH)) {
  if (path) {
    PATH_TO_VIEW[path] = view as View;
  }
}

function parseHash(): { view: View; personId: string | null } {
  const hash = window.location.hash.replace(/^#\/?/, '');
  // Signed-in users land on the classic app (mockup-updated dashboard).
  // The alternate redesign shell is at #/redesign.
  if (!hash) {
    return { view: 'dashboard', personId: null };
  }

  const parts = hash.split('/');
  const basePath = parts[0];

  // Handle person/:id routes
  if (basePath === 'person' && parts[1]) {
    return { view: 'person', personId: parts[1] };
  }

  // Handle wallets/:personId deep link to Impact Card account detail
  if (basePath === 'wallets' && parts[1]) {
    return { view: 'wallets', personId: parts[1] };
  }

  // Legacy routes → Congregation hub
  if (basePath === 'skills') {
    window.history.replaceState(null, '', '#/people?tab=skills');
    return { view: 'people', personId: null };
  }

  // Legacy routes → Leadership hub
  if (basePath === 'grace' || basePath === 'leader-management') {
    return { view: 'leadership', personId: null };
  }

  // Legacy routes → Discipleship & Engagement hub
  if (basePath === 'discipleship' || basePath === 'portal-activity') {
    window.history.replaceState(null, '', '#/discipleship-engagement');
    return { view: 'discipleship-engagement', personId: null };
  }

  // Removed feature routes → Home. Keeps old bookmarks from landing on NotFound.
  if (['financial-hub', 'follow-up-automation', 'planning-center-import', 'reminders', 'agents'].includes(basePath)) {
    window.history.replaceState(null, '', '#/dashboard');
    return { view: 'dashboard', personId: null };
  }

  const view = PATH_TO_VIEW[basePath];
  return { view: view || 'dashboard', personId: null };
}

function buildHash(view: View, personId?: string | null): string {
  const path = VIEW_TO_PATH[view] || '';
  if (!path) return '';
  if (view === 'person' && personId) {
    return `#/${path}/${personId}`;
  }
  if (view === 'wallets' && personId) {
    return `#/${path}/${personId}`;
  }
  return `#/${path}`;
}

interface UseHashRouterReturn {
  view: View;
  setView: (view: View) => void;
  selectedPersonId: string | null;
  setSelectedPersonId: (id: string | null) => void;
}

export function useHashRouter(): UseHashRouterReturn {
  const [state, setState] = useState(() => parseHash());
  const isPopstateRef = useRef(false);

  // Update URL when view changes (skip during popstate to avoid double push)
  const setView = useCallback((newView: View) => {
    setState(prev => {
      const personId = newView === 'person' || newView === 'wallets' ? prev.personId : null;
      const hash = buildHash(newView, personId);
      const currentHash = window.location.hash;
      const normalizedCurrent = currentHash === '#/' ? '' : currentHash;
      if (normalizedCurrent !== hash) {
        window.history.pushState(null, '', hash || window.location.pathname);
      }
      return { view: newView, personId };
    });
  }, []);

  const setSelectedPersonId = useCallback((id: string | null) => {
    setState(prev => {
      if (id && (prev.view === 'person' || prev.view === 'wallets')) {
        const hash = buildHash(prev.view, id);
        window.history.replaceState(null, '', hash);
      }
      return { ...prev, personId: id };
    });
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      isPopstateRef.current = true;
      const parsed = parseHash();
      setState(parsed);
      // Reset flag after React processes the update
      requestAnimationFrame(() => {
        isPopstateRef.current = false;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return {
    view: state.view,
    setView,
    selectedPersonId: state.personId,
    setSelectedPersonId,
  };
}
