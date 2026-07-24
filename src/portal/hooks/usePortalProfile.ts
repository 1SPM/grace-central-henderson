import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface PortalProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  birth_date: string | null;
  photo_url: string | null;
}

export type PortalProfileUpdate = Partial<Pick<PortalProfile, 'first_name' | 'last_name' | 'phone' | 'address' | 'city' | 'state' | 'zip'>>;

export function usePortalProfile() {
  const { getAuthToken } = usePortalAuth();
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ profile: PortalProfile }>('/api/portal/profile', getAuthToken);
      setProfile(result.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your profile');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = useCallback(async (fields: PortalProfileUpdate) => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await workosFetch<{ profile: PortalProfile }>('/api/portal/profile', getAuthToken, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      setProfile(result.profile);
      return result.profile;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [getAuthToken]);

  return { profile, isLoading, error, isSaving, refresh, update };
}
