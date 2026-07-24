import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';
import type {
  WorkOrder,
  WorkOrderTask,
  WorkOrderDependency,
  WorkOrderEvidence,
  WorkOrderStatus,
  Approval,
  CompletionReport,
} from '../types/shared-platform';

export interface WorkOrderDetail {
  work_order: WorkOrder;
  tasks: WorkOrderTask[];
  dependencies: WorkOrderDependency[];
  evidence: WorkOrderEvidence[];
}

interface ListResponse { work_orders: WorkOrder[] }
type DetailResponse = WorkOrderDetail;
interface CreateResponse { work_order: WorkOrder }
interface PilotResponse { work_order: WorkOrder; tasks: WorkOrderTask[] }
interface CompletionReportResponse { report: CompletionReport; artifact: unknown; persisted: boolean }
interface ApprovalRequestResponse { approval: Approval; work_order: WorkOrder }

export function useWorkOrders() {
  const { getAuthToken } = useAuthContext();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const list = useCallback(async (filters?: { status?: WorkOrderStatus; ministry?: string }) => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.ministry) params.set('ministry', filters.ministry);
      const qs = params.toString();
      const data = await workosFetch<ListResponse>(`/api/work-orders${qs ? `?${qs}` : ''}`, getAuthToken);
      setWorkOrders(data.work_orders);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load Work Orders');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void list(); }, [list]);

  const getDetail = useCallback(async (id: string): Promise<WorkOrderDetail | null> => {
    try {
      return await workosFetch<DetailResponse>(`/api/work-orders?id=${encodeURIComponent(id)}`, getAuthToken);
    } catch {
      return null;
    }
  }, [getAuthToken]);

  const create = useCallback(async (input: {
    title: string;
    description?: string;
    priority?: string;
    ministry?: string;
    sensitivity?: string;
    due_date?: string;
  }): Promise<WorkOrder> => {
    const data = await workosFetch<CreateResponse>('/api/work-orders', getAuthToken, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await list();
    return data.work_order;
  }, [getAuthToken, list]);

  const updateStatus = useCallback(async (id: string, status: WorkOrderStatus): Promise<WorkOrder> => {
    const data = await workosFetch<CreateResponse>(`/api/work-orders?id=${encodeURIComponent(id)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await list();
    return data.work_order;
  }, [getAuthToken, list]);

  const addTask = useCallback(async (input: { work_order_id: string; title: string; description?: string; priority?: string; owner_user_id?: string; due_date?: string }) => {
    return workosFetch<{ task: WorkOrderTask }>('/api/work-orders/tasks', getAuthToken, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }, [getAuthToken]);

  const updateTask = useCallback(async (taskId: string, input: Partial<Pick<WorkOrderTask, 'status' | 'title' | 'description' | 'priority' | 'owner_user_id' | 'due_date' | 'position'>>) => {
    return workosFetch<{ task: WorkOrderTask }>(`/api/work-orders/tasks?id=${encodeURIComponent(taskId)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }, [getAuthToken]);

  const addDependency = useCallback(async (workOrderId: string, dependsOnWorkOrderId: string) => {
    return workosFetch<{ dependency: WorkOrderDependency }>('/api/work-orders/dependencies', getAuthToken, {
      method: 'POST',
      body: JSON.stringify({ work_order_id: workOrderId, depends_on_work_order_id: dependsOnWorkOrderId }),
    });
  }, [getAuthToken]);

  const addEvidence = useCallback(async (input: { work_order_id: string; task_id?: string; kind: string; url?: string; content?: string }) => {
    return workosFetch<{ evidence: WorkOrderEvidence }>('/api/work-orders/evidence', getAuthToken, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }, [getAuthToken]);

  const requestApproval = useCallback(async (workOrderId: string, input: { proposed_action: string; risk_level?: string; approver_user_id?: string; notes?: string }) => {
    const data = await workosFetch<ApprovalRequestResponse>('/api/work-orders/request-approval', getAuthToken, {
      method: 'POST',
      body: JSON.stringify({ work_order_id: workOrderId, ...input }),
    });
    await list();
    return data;
  }, [getAuthToken, list]);

  const createPilotReadinessDemo = useCallback(async (): Promise<PilotResponse> => {
    const data = await workosFetch<PilotResponse>('/api/work-orders/pilot-readiness', getAuthToken, { method: 'POST' });
    await list();
    return data;
  }, [getAuthToken, list]);

  const getCompletionReport = useCallback(async (workOrderId: string): Promise<CompletionReportResponse> => {
    return workosFetch<CompletionReportResponse>(`/api/work-orders/completion-report?id=${encodeURIComponent(workOrderId)}`, getAuthToken);
  }, [getAuthToken]);

  return {
    workOrders,
    isLoading,
    error,
    forbidden,
    list,
    getDetail,
    create,
    updateStatus,
    addTask,
    updateTask,
    addDependency,
    addEvidence,
    requestApproval,
    createPilotReadinessDemo,
    getCompletionReport,
  };
}
