/**
 * GRACE WorkOS is privileged — Senior Pastor / System Administrator only
 * (migration 068). This tests the hub's own gate and tab-first ordering,
 * not the individual tab panels (each has its own test file already).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkOsHub } from './WorkOsHub';

const mockPermissions = vi.fn();
vi.mock('../../hooks/useWorkOsPermissions', () => ({
  useWorkOsPermissions: () => mockPermissions(),
}));

// Each tab panel has its own test file and its own heavy data
// dependencies (agent runs, ministry areas, work orders...) — stubbed
// here so this file tests only WorkOsHub's own gating/ordering behavior.
vi.mock('./ExecutiveOverview', () => ({ ExecutiveOverview: () => <div>Overview panel</div> }));
vi.mock('./WorkOrderList', () => ({ WorkOrderList: () => <div>Work Orders panel</div> }));
vi.mock('./WorkOrderDetail', () => ({ WorkOrderDetail: () => <div>Work Order detail</div> }));
vi.mock('./TaskBoard', () => ({ TaskBoard: () => <div>Task Board panel</div> }));
vi.mock('./ApprovalCentre', () => ({ ApprovalCentre: () => <div>Approvals panel</div> }));
vi.mock('./AgentCommandCentre', () => ({ AgentCommandCentre: () => <div>Agents panel</div> }));
vi.mock('./AuditTimeline', () => ({ AuditTimeline: () => <div>Audit panel</div> }));
vi.mock('./CampusView', () => ({ CampusView: () => <div>Campus panel</div> }));

function setHash(hash: string) {
  window.history.replaceState(null, '', hash);
}

function permissionsResult(overrides: Partial<ReturnType<typeof mockPermissions>>) {
  return { hasWorkosAccess: false, isLoading: false, ...overrides };
}

describe('WorkOsHub — privileged access gate', () => {
  afterEach(() => setHash('#/'));

  it('shows an honest "privileged" message for a signed-in staff member without workos.access', () => {
    mockPermissions.mockReturnValue(permissionsResult({ hasWorkosAccess: false }));
    render(<WorkOsHub setView={vi.fn()} />);

    expect(screen.getByText(/GRACE WorkOS is privileged/i)).toBeInTheDocument();
    expect(screen.getByText(/your Action Center/i)).toBeInTheDocument();
    expect(screen.queryByText('Agents panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows nothing (no flash of the denial message) while permissions are still loading', () => {
    mockPermissions.mockReturnValue(permissionsResult({ hasWorkosAccess: false, isLoading: true }));
    render(<WorkOsHub setView={vi.fn()} />);

    expect(screen.queryByText(/GRACE WorkOS is privileged/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('renders the hub with Agents as the first tab and default view for a pastor', () => {
    mockPermissions.mockReturnValue(permissionsResult({ hasWorkosAccess: true }));
    render(<WorkOsHub setView={vi.fn()} />);

    const tabs = screen.getAllByRole('tab').map(t => t.textContent?.trim());
    expect(tabs[0]).toBe('Agents');
    expect(tabs).toEqual(['Agents', 'Overview', 'Work Orders', 'Task Board', 'Approvals', 'Campus', 'Audit']);
    expect(screen.getByText('Agents panel')).toBeInTheDocument();
  });

  it('defaults to the Agents tab when the hash carries no tab param', () => {
    setHash('#/workos');
    mockPermissions.mockReturnValue(permissionsResult({ hasWorkosAccess: true }));
    render(<WorkOsHub setView={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /Agents/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Agents panel')).toBeInTheDocument();
  });
});
