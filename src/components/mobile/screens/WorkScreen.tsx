import { useMemo, useState } from 'react';
import { Briefcase, CheckSquare, CircleDollarSign, Flag } from 'lucide-react';
import type { Task, View } from '../../../types';
import { useMyWork } from '../../../hooks/useMyWork';
import { useApprovals } from '../../../hooks/useApprovals';
import {
  buildWorkQueue,
  SECTION_LABELS,
  type WorkQueueItem,
  type WorkQueueSection,
} from '../../../lib/workQueue';
import { muted } from '../ui/mobileTheme';
import { MobileCardRow, EmptyCard } from '../ui/MobileCard';
import { SectionLabel } from '../ui/SectionLabel';
import { IconChip } from '../ui/IconChip';
import { Chips, type ChipOption } from '../ui/Chips';
import { MobileSkeleton } from '../ui/MobileSkeleton';
import { relativeDate } from '../ui/mobileFormat';

interface WorkScreenProps {
  tasks: Task[];
  onNavigate: (view: View) => void;
}

type Filter = 'all' | 'high' | 'week' | 'later';

const FILTER_CHIPS: ChipOption<Filter>[] = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High' },
  { id: 'week', label: 'This Week' },
  { id: 'later', label: 'Later' },
];

const SECTION_ORDER: WorkQueueSection[] = ['high', 'week', 'later'];

function itemIcon(item: WorkQueueItem) {
  if (item.source === 'approval') {
    return (
      <IconChip tone="emerald">
        <CircleDollarSign size={17} />
      </IconChip>
    );
  }
  if (item.source === 'work_order') {
    return (
      <IconChip tone="sky">
        <Briefcase size={17} />
      </IconChip>
    );
  }
  if (item.attention === 'urgent') {
    return (
      <IconChip tone="orange">
        <Flag size={17} />
      </IconChip>
    );
  }
  return (
    <IconChip tone="indigo">
      <CheckSquare size={17} />
    </IconChip>
  );
}

function itemDetail(item: WorkQueueItem): string {
  const due = item.dueDate ? relativeDate(item.dueDate) : item.source === 'approval' ? 'Awaiting decision' : 'No due date';
  return item.context ? `${item.context} · ${due}` : due;
}

export function WorkScreen({ tasks, onNavigate }: WorkScreenProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const myWork = useMyWork();
  const approvalState = useApprovals();

  const items = useMemo(
    () =>
      buildWorkQueue({
        tasks,
        workOrders: myWork.workOrders,
        // A 403 means this user can't see approvals — the section simply
        // doesn't exist for them, never an error state.
        approvals: approvalState.forbidden ? [] : approvalState.approvals,
      }),
    [tasks, myWork.workOrders, approvalState.approvals, approvalState.forbidden],
  );

  const sections = useMemo(() => {
    const visible = filter === 'all' ? SECTION_ORDER : ([filter] as WorkQueueSection[]);
    return visible
      .map((section) => ({ section, items: items.filter((item) => item.section === section) }))
      .filter((group) => group.items.length > 0);
  }, [items, filter]);

  const loading = myWork.isLoading || approvalState.isLoading;

  const targetFor = (item: WorkQueueItem): View => (item.source === 'task' ? 'tasks' : 'workos');

  return (
    <div className="px-4 pt-5 pb-6 space-y-4 min-h-full bg-[#070b14]">
      <Chips options={FILTER_CHIPS} selected={filter} onSelect={setFilter} />

      {loading && items.length === 0 ? (
        <MobileSkeleton rows={4} />
      ) : sections.length > 0 ? (
        sections.map((group) => (
          <div key={group.section} className="space-y-2">
            <SectionLabel>{SECTION_LABELS[group.section]}</SectionLabel>
            {group.items.map((item) => (
              <MobileCardRow
                key={item.id}
                icon={itemIcon(item)}
                title={item.title}
                detail={itemDetail(item)}
                chevron
                onClick={() => onNavigate(targetFor(item))}
              />
            ))}
          </div>
        ))
      ) : (
        <EmptyCard>
          {filter === 'all' ? 'Your work queue is clear.' : 'Nothing in this bucket right now.'}
        </EmptyCard>
      )}

      {!loading && items.length > 0 && (
        <p className={`text-xs text-center ${muted}`}>
          Tasks, work orders, and approvals — prioritized together.
        </p>
      )}
    </div>
  );
}
