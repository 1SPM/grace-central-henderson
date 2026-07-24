import { useEffect, useState } from 'react';
import { LayoutDashboard, ClipboardList, Kanban, ClipboardCheck, Bot, History } from 'lucide-react';
import { HubPageHeader } from '../ui/HubPageHeader';
import { parseWorkOsTab, parseWorkOsId, openWorkOs, type WorkOsTab } from '../../lib/workosNav';
import { ExecutiveOverview } from './ExecutiveOverview';
import { WorkOrderList } from './WorkOrderList';
import { WorkOrderDetail } from './WorkOrderDetail';
import { TaskBoard } from './TaskBoard';
import { ApprovalCentre } from './ApprovalCentre';
import { AgentCommandCentre } from './AgentCommandCentre';
import { AuditTimeline } from './AuditTimeline';
import type { View } from '../../types';

const TABS: { id: WorkOsTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'work-orders', label: 'Work Orders', icon: ClipboardList },
  { id: 'tasks', label: 'Task Board', icon: Kanban },
  { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'audit', label: 'Audit', icon: History },
];

interface WorkOsHubProps {
  setView: (v: View) => void;
  defaultTab?: WorkOsTab;
}

export function WorkOsHub({ setView, defaultTab }: WorkOsHubProps) {
  const [tab, setTab] = useState<WorkOsTab>(defaultTab ?? parseWorkOsTab());
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(parseWorkOsId());

  useEffect(() => {
    const onHashChange = () => {
      setTab(parseWorkOsTab());
      setSelectedWorkOrderId(parseWorkOsId());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function handleTabChange(next: WorkOsTab) {
    setSelectedWorkOrderId(null);
    openWorkOs(next, setView);
  }

  function handleOpenWorkOrder(id: string) {
    setSelectedWorkOrderId(id);
    openWorkOs('work-orders', setView, id);
  }

  function handleBackToList() {
    setSelectedWorkOrderId(null);
    openWorkOs('work-orders', setView);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="px-4 sm:px-6 pt-6">
        <HubPageHeader
          icon={LayoutDashboard}
          title="GRACE WorkOS"
          subtitle="The operational control centre — Work Orders, tasks, approvals, agents, and the audit trail."
        />
      </div>

      <div className="px-4 sm:px-6 mt-4 border-b border-gray-200 dark:border-dark-700">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="GRACE WorkOS sections">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => handleTabChange(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                  active
                    ? 'border-slate-900 dark:border-white text-gray-900 dark:text-dark-100'
                    : 'border-transparent text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200'
                }`}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div role="tabpanel">
        {tab === 'overview' && <ExecutiveOverview setView={setView} />}
        {tab === 'work-orders' && (
          selectedWorkOrderId
            ? <WorkOrderDetail workOrderId={selectedWorkOrderId} onBack={handleBackToList} />
            : <WorkOrderList onOpen={handleOpenWorkOrder} />
        )}
        {tab === 'tasks' && <TaskBoard onOpenWorkOrder={handleOpenWorkOrder} />}
        {tab === 'approvals' && <ApprovalCentre />}
        {tab === 'agents' && <AgentCommandCentre />}
        {tab === 'audit' && <AuditTimeline />}
      </div>
    </div>
  );
}
