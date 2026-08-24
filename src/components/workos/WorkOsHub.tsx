import { useEffect, useState } from 'react';
import { LayoutDashboard, ClipboardList, Kanban, ClipboardCheck, Bot, Map as MapIcon, History, Lock } from 'lucide-react';
import { HubPageHeader } from '../ui/HubPageHeader';
import { parseWorkOsTab, parseWorkOsId, parseCampusRoom, openWorkOs, type WorkOsTab } from '../../lib/workosNav';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { ExecutiveOverview } from './ExecutiveOverview';
import { WorkOrderList } from './WorkOrderList';
import { WorkOrderDetail } from './WorkOrderDetail';
import { TaskBoard } from './TaskBoard';
import { ApprovalCentre } from './ApprovalCentre';
import { AgentCommandCentre } from './AgentCommandCentre';
import { AuditTimeline } from './AuditTimeline';
import { CampusView } from './CampusView';
import type { View } from '../../types';

// Agents first: this is the pastor's top-down view of what's running the
// church day to day, not a report they check last.
const TABS: { id: WorkOsTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'work-orders', label: 'Work Orders', icon: ClipboardList },
  { id: 'tasks', label: 'Task Board', icon: Kanban },
  { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
  { id: 'campus', label: 'Campus', icon: MapIcon },
  { id: 'audit', label: 'Audit', icon: History },
];

interface WorkOsHubProps {
  setView: (v: View) => void;
  defaultTab?: WorkOsTab;
}

export function WorkOsHub({ setView, defaultTab }: WorkOsHubProps) {
  const [tab, setTab] = useState<WorkOsTab>(defaultTab ?? parseWorkOsTab());
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(parseWorkOsId());
  const [campusRoom, setCampusRoom] = useState<string | null>(parseCampusRoom());
  const { hasWorkosAccess, isLoading: permsLoading } = useWorkOsPermissions();

  useEffect(() => {
    const onHashChange = () => {
      setTab(parseWorkOsTab());
      setSelectedWorkOrderId(parseWorkOsId());
      setCampusRoom(parseCampusRoom());
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

  // Privileged, pastor-only — server-side is the real gate (every route
  // this hub calls now requires a permission only Senior Pastor / System
  // Administrator hold, migration 068), this is just an honest landing
  // instead of a hub full of empty panels and 403s for anyone else.
  // Fails closed, not open: while permissions are still resolving, render
  // nothing rather than the full hub — a brief flash of Work Orders/Agents
  // tabs before the denial kicks in would defeat the point of the gate.
  if (permsLoading) return null;
  if (!hasWorkosAccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 text-center">
        <Lock size={28} className="mx-auto text-gray-300 dark:text-dark-600 mb-3" />
        <h1 className="serif text-2xl text-slate-900 dark:text-dark-100">GRACE WorkOS is privileged</h1>
        <p className="text-sm text-gray-500 dark:text-dark-400 mt-2 max-w-md mx-auto">
          This is the Senior Pastor's operational view — Work Orders, approvals, agents, and
          the audit trail, church-wide. Your own assignments and the agent activity relevant
          to you live in your Action Center instead.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="px-4 sm:px-6 pt-6">
        <HubPageHeader
          icon={LayoutDashboard}
          title="GRACE WorkOS"
          subtitle="The operational control centre — Work Orders, tasks, approvals, agents, and the audit trail."
          trailing={
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
              <Lock size={11} /> Privileged — Pastor
            </span>
          }
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
        {tab === 'campus' && <CampusView key={campusRoom ?? 'campus'} setView={setView} defaultRoom={campusRoom} />}
        {tab === 'audit' && <AuditTimeline />}
      </div>
    </div>
  );
}
