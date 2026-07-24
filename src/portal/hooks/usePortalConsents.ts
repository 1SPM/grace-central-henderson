import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';
import type { Consent, CommunicationPreferences, ConsentType, ConsentStatus } from '../../types/shared-platform';

/**
 * Communication/privacy preferences — reuses the shared-platform
 * api/consents/_index.ts route built for exactly this (member self-
 * service via resolveMemberActor). No new API surface needed.
 */
export function usePortalConsents() {
  const { getAuthToken } = usePortalAuth();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<ConsentType | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ consents: Consent[]; preferences: CommunicationPreferences | null }>('/api/consents', getAuthToken);
      setConsents(result.consents);
      setPreferences(result.preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your preferences');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const setConsent = useCallback(async (consentType: ConsentType, status: ConsentStatus) => {
    setSavingType(consentType);
    try {
      await workosFetch('/api/consents', getAuthToken, {
        method: 'PATCH',
        body: JSON.stringify({ consent_type: consentType, status }),
      });
      await refresh();
    } finally {
      setSavingType(null);
    }
  }, [getAuthToken, refresh]);

  const statusFor = useCallback((type: ConsentType): ConsentStatus => {
    return consents.find(c => c.consent_type === type)?.status ?? 'denied';
  }, [consents]);

  return { consents, preferences, isLoading, error, savingType, refresh, setConsent, statusFor };
}
