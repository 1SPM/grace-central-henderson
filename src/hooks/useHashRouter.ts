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
  dashboard: '',
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
  discipleship: 'discipleship',
  grace: 'grace',
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
  if (!hash) {
    return { view: 'dashboard', personId: null };
  }

  const parts = hash.split('/');
  const basePath = parts[0];

  // Handle person/:id routes
  if (basePath === 'person' && parts[1]) {
    return { view: 'person', personId: parts[1] };
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
      const personId = newView === 'person' ? prev.personId : null;
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
      if (id && prev.view === 'person') {
        const hash = buildHash('person', id);
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
