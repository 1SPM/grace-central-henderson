/**
 * The church's operational map: area → accountable human → supporting agent
 * → campus location, resolved for this church.
 *
 * One hook, three consumers (Campus, WorkOS Overview, Settings), so the
 * pairing can never disagree between them.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';
import type { AreaSurface, ResolvedAreaWithCounts, RoleKey } from '../lib/ministryAreas';

// Re-exported under the hook's existing name so nothing else in the app
// has to change; the shape now comes from one place instead of two.
export type AreaWithCounts = ResolvedAreaWithCounts;

export interface StaffOption { user_id: string; name: string; title: string | null }
export interface AgentOption { key: string; name: string; role: string; implemented: boolean }

interface AreasResponse {
  areas: AreaWithCounts[];
  staff: StaffOption[];
  agents: AgentOption[];
  rooms: string[];
  can_manage: boolean;
}

/** A reassignment. `null` clears the link; omit a field to leave it alone. */
export interface AreaPatch {
  owner_user_id?: string | null;
  agent_key?: string | null;
  campus_room?: string | null;
}

export type { AreaSurface, RoleKey };

export function useMinistryAreas() {
  const { getAuthToken } = useAuthContext();
  const [areas, setAreas] = useState<AreaWithCounts[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<Partial<AreasResponse>>('/api/workos/areas', getAuthToken);
      // Defensive: a truncated or unexpected payload must degrade to "no map
      // yet", never take down the panel it is embedded in.
      setAreas(Array.isArray(data?.areas) ? data.areas : []);
      setStaff(Array.isArray(data?.staff) ? data.staff : []);
      setAgents(Array.isArray(data?.agents) ? data.agents : []);
      setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      setCanManage(data?.can_manage === true);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Could not load the ministry map');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const reassign = useCallback(async (areaKey: string, patch: AreaPatch) => {
    setSavingKey(areaKey);
    setError(null);
    try {
      await workosFetch('/api/workos/areas', getAuthToken, {
        method: 'PUT',
        // JSON.stringify keeps an explicit null; an omitted key stays omitted.
        body: JSON.stringify({ area_key: areaKey, ...patch }),
      });
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that change');
      return false;
    } finally {
      setSavingKey(null);
    }
  }, [getAuthToken, refresh]);

  return { areas, staff, agents, rooms, canManage, isLoading, error, forbidden, savingKey, refresh, reassign };
}
