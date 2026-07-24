import { useCallback, useEffect, useState } from 'react';
import {
  fetchMyCard,
  setImpactRoute as setImpactRouteRequest,
  NeobankFetchError,
  type MyCardData,
} from '../../lib/services/impactCard';
import { usePortalAuth } from '../PortalAuthContext';

export type PortalImpactCardState = 'loading' | 'ready' | 'unavailable' | 'signed_out' | 'preview';

export function usePortalImpactCard() {
  const { isPreview } = usePortalAuth();
  const [data, setData] = useState<MyCardData | null>(null);
  const [state, setState] = useState<PortalImpactCardState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSavingRoute, setIsSavingRoute] = useState(false);

  const refresh = useCallback(async () => {
    // A staff preview session carries a pvt_-prefixed token, not a real
    // Clerk session — api/neobank authenticates via requireClerkAuth
    // directly (it doesn't go through the preview-token path
    // resolveMemberActor supports), so there is nothing to fetch here.
    // Show an explicit state instead of attempting a call that can only
    // fail.
    if (isPreview) {
      setData(null);
      setState('preview');
      return;
    }
    setState('loading');
    setErrorMessage('');
    try {
      const result = await fetchMyCard();
      if (result === null) {
        // fetchMyCard() returns null when there is no Clerk session — the
        // demo-mode Members Portal shell doesn't have one, since
        // /api/neobank isn't yet wired to the demo-bootstrap actor
        // resolution the rest of the portal uses (see TECH_DEBT.md).
        setData(null);
        setState('signed_out');
        return;
      }
      setData(result);
      setState('ready');
    } catch (err) {
      const message = err instanceof NeobankFetchError ? err.detail : 'Could not load your Impact Card.';
      setErrorMessage(message);
      setData(null);
      setState('unavailable');
    }
  }, [isPreview]);

  useEffect(() => { void refresh(); }, [refresh]);

  const setImpactRoute = useCallback(async (personId: string, routeLabel: string, routeFund: string) => {
    setIsSavingRoute(true);
    try {
      await setImpactRouteRequest(personId, routeLabel, routeFund);
      await refresh();
    } finally {
      setIsSavingRoute(false);
    }
  }, [refresh]);

  return { data, state, errorMessage, isSavingRoute, refresh, setImpactRoute };
}
