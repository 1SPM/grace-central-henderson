import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch } from '../lib/services/workos';

export interface MyWorkAgentActivity {
  agent_key: string;
  agent_name: string;
  status: string;
  finished_at: string | null;
  summary: string | null;
  error: string | null;
}

export interface MyWorkOrder {
  id: string;
  title: string;
  status: string;
  priority: string;
  ministry: string | null;
  due_date: string | null;
  agent_activity: MyWorkAgentActivity | null;
}

export interface MyWorkArea {
  area_key: string;
  area_name: string;
  agent_activity: MyWorkAgentActivity | null;
}

interface MyWorkResponse { work_orders: MyWorkOrder[]; areas: MyWorkArea[] }

/**
 * "What's on my plate" — self-scoped, no permission grant required (see
 * api/workos/_my-work.ts): Work Orders and ministry areas I own, each
 * paired with whatever agent supports it and that agent's latest run.
 */
export function useMyWork() {
  const { getAuthToken } = useAuthContext();
  const [workOrders, setWorkOrders] = useState<MyWorkOrder[]>([]);
  const [areas, setAreas] = useState<MyWorkArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flaggingKey, setFlaggingKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workosFetch<MyWorkResponse>('/api/workos/my-work', getAuthToken);
      setWorkOrders(data.work_orders);
      setAreas(data.areas);
    } catch {
      setWorkOrders([]);
      setAreas([]);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const flagWorkOrder = useCallback(async (workOrderId: string, note: string) => {
    setFlaggingKey(`wo:${workOrderId}`);
    try {
      await workosFetch('/api/workos/my-work', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ subject_type: 'work_order', subject_id: workOrderId, note }),
      });
    } finally {
      setFlaggingKey(null);
    }
  }, [getAuthToken]);

  const flagArea = useCallback(async (areaKey: string, note: string) => {
    setFlaggingKey(`area:${areaKey}`);
    try {
      await workosFetch('/api/workos/my-work', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ subject_type: 'ministry_area', area_key: areaKey, note }),
      });
    } finally {
      setFlaggingKey(null);
    }
  }, [getAuthToken]);

  return { workOrders, areas, isLoading, flaggingKey, flagWorkOrder, flagArea, refresh };
}
