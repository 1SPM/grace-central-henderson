/**
 * Route Guard Hook
 *
 * Maps views to required permission levels.
 * Returns whether the current user can access a given view.
 */

import { useAuthContext } from '../contexts/AuthContext';
import type { View } from '../types';

// Views that require admin role
const ADMIN_VIEWS = new Set<View>([
  'settings',
]);

// Views that require at least staff role
const STAFF_VIEWS = new Set<View>([
  'agents',
  'batch-entry',
  'campaigns',
  'statements',
  'planning-center-import',
  'follow-up-automation',
  'reminders',
]);

// All other views are accessible to any authenticated user

export function useRouteGuard() {
  const { permissions, user } = useAuthContext();
  const role = user?.role || 'volunteer';

  function canAccess(view: View): boolean {
    if (ADMIN_VIEWS.has(view)) {
      return role === 'admin';
    }
    if (STAFF_VIEWS.has(view)) {
      return role === 'admin' || role === 'staff';
    }
    // All other views are accessible to authenticated users
    return true;
  }

  function getBlockedMessage(view: View): string | null {
    if (!canAccess(view)) {
      if (ADMIN_VIEWS.has(view)) {
        return 'This page requires administrator access.';
      }
      return 'This page requires staff-level access.';
    }
    return null;
  }

  return { canAccess, getBlockedMessage, role, permissions };
}
