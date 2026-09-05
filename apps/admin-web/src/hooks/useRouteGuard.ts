/**
 * Route Guard Hook
 *
 * Maps views to required permission levels.
 * Returns whether the current user can access a given view.
 */

import { useAuthContext } from '../contexts/AuthContext';
import type { View } from '../types';

// Views that require settings management permission
const SETTINGS_VIEWS = new Set<View>([
  'settings',
  'forms',
  'email-templates',
  'reports',
  'tags',
  'analytics',
]);

// Views that require at least staff role
const STAFF_VIEWS = new Set<View>([
  'batch-entry',
  'campaigns',
  'statements',
  // GRACE WorkOS: the coarse role check here is a UX convenience only —
  // real module-by-module authorization (Work Orders vs. Approvals vs.
  // Agents vs. Audit) is enforced per-request server-side via
  // requirePermission() against the RBAC model. See SHARED_BACKEND.md
  // "Authorization model" and TECH_DEBT.md TD-044.
  'workos',
]);

// All other views are accessible to any authenticated user

export function useRouteGuard() {
  const { permissions, user } = useAuthContext();
  const role = user?.role || 'volunteer';

  function canAccess(view: View): boolean {
    if (SETTINGS_VIEWS.has(view)) {
      return permissions?.canManageSettings ?? false;
    }
    if (STAFF_VIEWS.has(view)) {
      return role === 'admin' || role === 'staff' || role === 'pastor';
    }
    // All other views are accessible to authenticated users
    return true;
  }

  function getBlockedMessage(view: View): string | null {
    if (!canAccess(view)) {
      if (SETTINGS_VIEWS.has(view)) {
        return 'This page requires administrator or pastor access.';
      }
      return 'This page requires staff-level access.';
    }
    return null;
  }

  return { canAccess, getBlockedMessage, role, permissions };
}
