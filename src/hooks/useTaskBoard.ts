import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';
import type { WorkOrderTask, WorkOrderTaskStatus } from '../types/shared-platform';

export interface TaskBoardTask extends WorkOrderTask {
  work_orders: { id: string; title: string };
}

interface ListResponse { tasks: TaskBoardTask[] }
interface UpdateResponse { task: WorkOrderTask }

/**
 * Cross-Work-Order task board: To Do / In Progress / Blocked / Under
 * Review / Completed. Reuses the same work_order_tasks rows the Work
 * Order detail view shows — this is a different lens on the same data,
 * not a parallel task system.
 */
export function useTaskBoard() {
  const { getAuthToken } = useAuthContext();
  const [tasks, setTasks] = useState<TaskBoardTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<ListResponse>('/api/work-orders/tasks', getAuthToken);
      setTasks(data.tasks);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load the task board');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const moveTask = useCallback(async (taskId: string, status: WorkOrderTaskStatus) => {
    await workosFetch<UpdateResponse>(`/api/work-orders/tasks?id=${encodeURIComponent(taskId)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  // Note: reassigning to a different user works; clearing an owner entirely
  // isn't supported through this path today (the update schema treats a
  // null value as "field not provided," not "clear it") — see
  // TECH_DEBT.md TD-045.
  const reassignTask = useCallback(async (taskId: string, ownerUserId: string) => {
    await workosFetch<UpdateResponse>(`/api/work-orders/tasks?id=${encodeURIComponent(taskId)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ owner_user_id: ownerUserId }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  return { tasks, isLoading, error, forbidden, refresh, moveTask, reassignTask };
}
