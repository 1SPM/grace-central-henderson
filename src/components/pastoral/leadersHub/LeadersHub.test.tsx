/**
 * "Accessible individually by way of assignment": a signed-in leader who
 * isn't the master admin (the pastor) only ever sees their own profile
 * here — never the roster, never Manage. See the useWorkOsPermissions gate
 * in LeadersHub.tsx.
 */
import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeadersHubContent } from './LeadersHub';
import type { LeaderProfile } from '../../../types';

// LeaderContactTab pulls in useIntegrations -> useAuthContext, an unrelated
// provider chain this test has no reason to stand up — it isn't what's
// under test here (the access gate around it is).
vi.mock('./LeaderContactTab', () => ({ LeaderContactTab: () => null }));

function renderHub(props: ComponentProps<typeof LeadersHubContent>) {
  return render(<LeadersHubContent {...props} />);
}

const mockPermissions = vi.fn();
vi.mock('../../../hooks/useWorkOsPermissions', () => ({
  useWorkOsPermissions: () => mockPermissions(),
}));
vi.mock('../../../hooks/useLeadershipActivity', () => ({
  useLeadershipActivity: () => ({ data: null, loading: false, isLive: false, refresh: vi.fn() }),
}));

const LEADERS: LeaderProfile[] = [
  {
    id: 'leader-a', personId: 'person-a', displayName: 'Pastor A', title: 'Senior Pastor',
    bio: '', expertiseAreas: [], credentials: [], personalityTraits: [], spiritualFocusAreas: [],
    language: 'English', isVerified: true, isAvailable: true, isActive: true, createdAt: '2024-01-01',
  },
  {
    id: 'leader-b', personId: 'person-b', displayName: 'Deacon B', title: 'Pastoral Care',
    bio: '', expertiseAreas: [], credentials: [], personalityTraits: [], spiritualFocusAreas: [],
    language: 'English', isVerified: true, isAvailable: true, isActive: true, createdAt: '2024-01-01',
  },
];

function permissionsResult(overrides: Partial<ReturnType<typeof mockPermissions>>) {
  return {
    permissions: new Set<string>(), has: () => false, personId: null, isMasterAdmin: false,
    isLoading: false, refresh: vi.fn(), ...overrides,
  };
}

describe('LeadersHubContent — per-leader access gate', () => {
  beforeEach(() => mockPermissions.mockReset());

  it('shows only the signed-in leader\'s own profile, never the roster', () => {
    mockPermissions.mockReturnValue(permissionsResult({ personId: 'person-b', isMasterAdmin: false }));
    renderHub({ leaders: LEADERS, sessions: [], embedded: true });

    expect(screen.getByText('Deacon B')).toBeInTheDocument();
    expect(screen.queryByText('Pastor A')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Add leader')).not.toBeInTheDocument();
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
  });

  it('shows a "no profile yet" state for staff with no matching leader profile', () => {
    mockPermissions.mockReturnValue(permissionsResult({ personId: 'person-unlinked', isMasterAdmin: false }));
    renderHub({ leaders: LEADERS, sessions: [], embedded: true });

    expect(screen.getByText(/don't have a public leader profile yet/i)).toBeInTheDocument();
    expect(screen.queryByText('Pastor A')).not.toBeInTheDocument();
    expect(screen.queryByText('Deacon B')).not.toBeInTheDocument();
  });

  it('gives the master admin the full roster and Manage tab', () => {
    mockPermissions.mockReturnValue(permissionsResult({ personId: 'person-a', isMasterAdmin: true }));
    renderHub({ leaders: LEADERS, sessions: [], embedded: true });

    expect(screen.getByText('Pastor A')).toBeInTheDocument();
    expect(screen.getByText('Deacon B')).toBeInTheDocument();
    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getByText('+ Add leader')).toBeInTheDocument();
  });

  it('ignores a non-admin attempt to select another leader', () => {
    mockPermissions.mockReturnValue(permissionsResult({ personId: 'person-b', isMasterAdmin: false }));
    const { rerender } = renderHub({ leaders: LEADERS, sessions: [], embedded: true });
    // Re-render with a different initialLeaderId, simulating a crafted hash —
    // the gate must still resolve to the caller's own leader, not the hash.
    rerender(<LeadersHubContent leaders={LEADERS} sessions={[]} embedded initialLeaderId="leader-a" />);

    expect(screen.getByText('Deacon B')).toBeInTheDocument();
    expect(screen.queryByText('Pastor A')).not.toBeInTheDocument();
  });
});
