import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch } from '../lib/services/workos';

interface PermissionsResponse {
  user_id: string;
  church_id: string;
  permissions: string[];
}

/**
 * The caller's effective WorkOS permission set — used to decide which
 * panels/buttons to show. A UX convenience only; every mutation is
 * re-checked server-side regardless of what this returns.
 */
export function useWorkOsPermissions() {
  const { getAuthToken, isSignedIn, isLoaded } = useAuthContext();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workosFetch<PermissionsResponse>('/api/workos/permissions', getAuthToken);
      setPermissions(new Set(data.permissions));
    } catch {
      setPermissions(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  const has = useCallback((key: string) => permissions.has(key), [permissions]);

  return { permissions, has, isLoading, refresh };
}
