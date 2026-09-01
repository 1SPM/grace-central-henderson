/**
 * The merged mobile Work Queue: legacy per-person tasks, WorkOS work
 * orders (useMyWork), and pending approvals classified into the shared
 * attention vocabulary (attentionPolicy.ts) and bucketed by due date the
 * same way ActionFeed groups its feed.
 */
import type { Task } from '../types';
import type { Approval } from '../types/shared-platform';
import type { MyWorkOrder } from '../hooks/useMyWork';
import { attentionRank, type AttentionState } from './attentionPolicy';
import { parseDateFlexible } from '../utils/validation';

export type TimeBucket = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'noDate';

export type WorkQueueSection = 'high' | 'week' | 'later';

export interface WorkQueueItem {
  id: string;
  source: 'task' | 'work_order' | 'approval';
  title: string;
  /** Secondary context (category / ministry / entity), without the due label. */
  context?: string;
  dueDate?: string | null;
  attention: AttentionState;
  bucket: TimeBucket;
  section: WorkQueueSection;
}

const BUCKET_ORDER: Record<TimeBucket, number> = {
  overdue: 0,
  today: 1,
  tomorrow: 2,
  thisWeek: 3,
  later: 4,
  noDate: 5,
};

export const SECTION_LABELS: Record<WorkQueueSection, string> = {
  high: 'High priority',
  week: 'This week',
  later: 'Later',
};

export function bucketForDueDate(dueDate: string | null | undefined, now = new Date()): TimeBucket {
  if (!dueDate) return 'noDate';
  const due = parseDateFlexible(dueDate);
  if (Number.isNaN(due.getTime())) return 'noDate';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - startOfToday.getTime()) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return 'thisWeek';
  return 'later';
}

function sectionFor(attention: AttentionState, bucket: TimeBucket, source: WorkQueueItem['source']): WorkQueueSection {
  if (attention === 'urgent' || attention === 'blocked') return 'high';
  if (source === 'approval') return 'high';
  if (bucket === 'overdue' || bucket === 'today') return 'high';
  if (bucket === 'tomorrow' || bucket === 'thisWeek') return 'week';
  return 'later';
}

const TASK_CATEGORY_LABELS: Record<Task['category'], string> = {
  'follow-up': 'Follow-up',
  care: 'Care',
  admin: 'Admin',
  outreach: 'Outreach',
};

function prettify(value: string): string {
  return value
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function buildWorkQueue(
  {
    tasks,
    workOrders,
    approvals,
  }: {
    tasks: Task[];
    workOrders: MyWorkOrder[];
    approvals: Approval[];
  },
  now = new Date(),
): WorkQueueItem[] {
  const items: WorkQueueItem[] = [];

  for (const task of tasks) {
    if (task.completed) continue;
    const bucket = bucketForDueDate(task.dueDate, now);
    const attention: AttentionState =
      bucket === 'overdue' || task.priority === 'high'
        ? 'urgent'
        : task.priority === 'medium'
          ? 'needs_review'
          : 'informational';
    items.push({
      id: `task:${task.id}`,
      source: 'task',
      title: task.title,
      context: TASK_CATEGORY_LABELS[task.category] ?? prettify(task.category),
      dueDate: task.dueDate || null,
      attention,
      bucket,
      section: sectionFor(attention, bucket, 'task'),
    });
  }

  for (const order of workOrders) {
    if (order.status === 'completed' || order.status === 'cancelled') continue;
    const bucket = bucketForDueDate(order.due_date, now);
    const attention: AttentionState =
      order.status === 'blocked'
        ? 'blocked'
        : order.priority === 'urgent' || bucket === 'overdue'
          ? 'urgent'
          : order.status === 'awaiting_approval' || order.priority === 'high'
            ? 'needs_review'
            : 'informational';
    items.push({
      id: `wo:${order.id}`,
      source: 'work_order',
      title: order.title,
      context: order.ministry ? prettify(order.ministry) : 'Work order',
      dueDate: order.due_date,
      attention,
      bucket,
      section: sectionFor(attention, bucket, 'work_order'),
    });
  }

  for (const approval of approvals) {
    if (approval.status !== 'pending') continue;
    const bucket: TimeBucket = 'noDate';
    const attention: AttentionState =
      approval.risk_level === 'critical' || approval.risk_level === 'high' ? 'urgent' : 'needs_review';
    items.push({
      id: `approval:${approval.id}`,
      source: 'approval',
      title: approval.proposed_action || 'Approval requested',
      context: approval.entity_type ? prettify(approval.entity_type) : 'Approval',
      dueDate: null,
      attention,
      bucket,
      section: sectionFor(attention, bucket, 'approval'),
    });
  }

  return items.sort((a, b) => {
    const byAttention = attentionRank(a.attention) - attentionRank(b.attention);
    if (byAttention !== 0) return byAttention;
    const byBucket = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
    if (byBucket !== 0) return byBucket;
    const aDue = a.dueDate ? parseDateFlexible(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? parseDateFlexible(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });
}
