import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBar } from './ActionBar';
import type { DecisionQueueItem } from '../hooks/useDecisionQueue';

function item(overrides: Partial<DecisionQueueItem> & Pick<DecisionQueueItem, 'id' | 'kind' | 'severity'>): DecisionQueueItem {
  return {
    title: 'Item',
    created_at: '2026-08-29T00:00:00.000Z',
    age_hours: 1,
    href: `#/${overrides.kind}`,
    required_permission: 'approvals.view',
    subject_type: 'x',
    subject_id: '1',
    ...overrides,
  };
}

describe('ActionBar', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing while loading', () => {
    const { container } = render(<ActionBar items={[]} isLoading={true} currentView="dashboard" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the queue is empty', () => {
    const { container } = render(<ActionBar items={[]} isLoading={false} currentView="dashboard" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on the workos view, where the full Decision Queue panel is the surface', () => {
    const items = [item({ id: '1', kind: 'crisis', severity: 'critical' })];
    const { container } = render(<ActionBar items={items} isLoading={false} currentView="workos" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a chip per signal kind with its count and links to the canonical href', () => {
    const items = [
      item({ id: '1', kind: 'approval', severity: 'normal' }),
      item({ id: '2', kind: 'approval', severity: 'normal' }),
      item({ id: '3', kind: 'crisis', severity: 'critical', href: '#/pastoral-care?tab=requests' }),
    ];
    render(<ActionBar items={items} isLoading={false} currentView="dashboard" />);

    expect(screen.getByText('Approvals (2)')).toBeInTheDocument();
    const crisisLink = screen.getByText('Crisis care (1)').closest('a');
    expect(crisisLink).toHaveAttribute('href', '#/pastoral-care?tab=requests');
  });

  it('collapses to a summary pill and persists the choice across remounts', () => {
    const items = [item({ id: '1', kind: 'crisis', severity: 'critical' })];
    const { unmount } = render(<ActionBar items={items} isLoading={false} currentView="dashboard" />);

    fireEvent.click(screen.getByLabelText('Collapse action bar'));
    expect(screen.getByText('1 awaiting attention')).toBeInTheDocument();
    expect(localStorage.getItem('graceActionBar.collapsed')).toBe('true');

    unmount();
    render(<ActionBar items={items} isLoading={false} currentView="dashboard" />);
    expect(screen.getByText('1 awaiting attention')).toBeInTheDocument();
  });
});
