import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch } from '../lib/services/workos';

interface PermissionsResponse {
  user_id: string;
  church_id: string;
  permissions: string[];
  person_id: string | null;
  first_name: string | null;
  last_name: string | null;
  is_master_admin: boolean;
}

/**
 * The caller's effective WorkOS permission set — used to decide which
 * panels/buttons to show. A UX convenience only; every mutation is
 * re-checked server-side regardless of what this returns.
 */
export function useWorkOsPermissions() {
  const { getAuthToken, isSignedIn, isLoaded } = useAuthContext();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [personId, setPersonId] = useState<string | null>(null);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workosFetch<PermissionsResponse>('/api/workos/permissions', getAuthToken);
      setPermissions(new Set(data.permissions));
      setPersonId(data.person_id);
      setIsMasterAdmin(data.is_master_admin);
    } catch {
      setPermissions(new Set());
      setPersonId(null);
      setIsMasterAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  const has = useCallback((key: string) => permissions.has(key), [permissions]);

  return { permissions, has, personId, isMasterAdmin, isLoading, refresh };
}
