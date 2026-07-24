import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardActionControls } from './CardActionControls';
import type { CardRecord } from '../../lib/services/impactCard';
import { cancelCard, freezeCard, issueReplacementCard, unfreezeCard } from '../../lib/services/impactCard';

vi.mock('../../lib/services/impactCard', () => ({
  freezeCard: vi.fn(() => Promise.resolve()),
  cancelCard: vi.fn(() => Promise.resolve()),
  issueReplacementCard: vi.fn(() => Promise.resolve()),
  unfreezeCard: vi.fn(() => Promise.resolve()),
}));

function makeCard(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: 'card-1',
    i2c_card_id: 'i2c-1',
    masked_pan: '•••• 4242',
    cardholder_name: 'Kevin Martinez',
    cardholder_person_id: 'person-1',
    expiry_month: 12,
    expiry_year: 2028,
    status: 'active',
    daily_limit_micro_usd: 100_000_000,
    monthly_limit_micro_usd: 1_000_000_000,
    issued_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CardActionControls', () => {
  const withBusy = vi.fn(async (_id: string, fn: () => Promise<unknown>) => {
    await fn();
  });

  beforeEach(() => {
    withBusy.mockClear();
    vi.mocked(freezeCard).mockClear();
    vi.mocked(cancelCard).mockClear();
    vi.mocked(issueReplacementCard).mockClear();
    vi.mocked(unfreezeCard).mockClear();
  });

  it('shows Freeze / Issue replacement / Cancel for an active card, not Unfreeze', () => {
    render(<CardActionControls card={makeCard({ status: 'active' })} busyId={null} withBusy={withBusy} />);
    expect(screen.getByText('Freeze')).toBeInTheDocument();
    expect(screen.getByText('Issue replacement')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Unfreeze')).toBeNull();
  });

  it('shows Unfreeze / Issue replacement / Cancel for a frozen card, not Freeze', () => {
    render(<CardActionControls card={makeCard({ status: 'frozen' })} busyId={null} withBusy={withBusy} />);
    expect(screen.getByText('Unfreeze')).toBeInTheDocument();
    expect(screen.getByText('Issue replacement')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Freeze')).toBeNull();
  });

  it('shows no actions for a cancelled card (already terminal)', () => {
    render(<CardActionControls card={makeCard({ status: 'cancelled' })} busyId={null} withBusy={withBusy} />);
    expect(screen.queryByText('Freeze')).toBeNull();
    expect(screen.queryByText('Unfreeze')).toBeNull();
    expect(screen.queryByText('Issue replacement')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('requires a 3+ character reason before Freeze can be confirmed, then calls freezeCard with the reason', () => {
    render(<CardActionControls card={makeCard({ id: 'card-9', status: 'active' })} busyId={null} withBusy={withBusy} />);
    fireEvent.click(screen.getByText('Freeze'));

    const confirmButton = screen.getByText('Freeze card');
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Staff reason (required)…'), { target: { value: 'ab' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Staff reason (required)…'), { target: { value: 'Reported lost' } });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
    expect(withBusy).toHaveBeenCalledWith('card-9', expect.any(Function));
    expect(freezeCard).toHaveBeenCalledWith('card-9', 'Reported lost');
  });

  it('cancel goes through the same reason modal and calls cancelCard with the reason', () => {
    render(<CardActionControls card={makeCard({ id: 'card-2', status: 'active' })} busyId={null} withBusy={withBusy} />);
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.change(screen.getByPlaceholderText('Staff reason (required)…'), { target: { value: 'Member requested closure' } });
    fireEvent.click(screen.getByText('Cancel card'));
    expect(cancelCard).toHaveBeenCalledWith('card-2', 'Member requested closure');
  });

  it('issue replacement uses a replace-<id> busy key and calls issueReplacementCard with the reason', () => {
    render(<CardActionControls card={makeCard({ id: 'card-3', status: 'active' })} busyId={null} withBusy={withBusy} />);
    fireEvent.click(screen.getByText('Issue replacement'));
    fireEvent.change(screen.getByPlaceholderText('Staff reason (required)…'), { target: { value: 'Card damaged' } });
    const matches = screen.getAllByText('Issue replacement');
    fireEvent.click(matches[matches.length - 1]);
    expect(withBusy).toHaveBeenCalledWith('replace-card-3', expect.any(Function));
    expect(issueReplacementCard).toHaveBeenCalledWith('card-3', 'Card damaged');
  });

  it('unfreeze fires immediately with no reason modal', () => {
    render(<CardActionControls card={makeCard({ id: 'card-4', status: 'frozen' })} busyId={null} withBusy={withBusy} />);
    fireEvent.click(screen.getByText('Unfreeze'));
    expect(screen.queryByPlaceholderText('Staff reason (required)…')).toBeNull();
    expect(withBusy).toHaveBeenCalledWith('card-4', expect.any(Function));
    expect(unfreezeCard).toHaveBeenCalledWith('card-4');
  });

  it('renders icon-only buttons (no visible label text) in compact mode', () => {
    render(<CardActionControls card={makeCard({ status: 'active' })} busyId={null} withBusy={withBusy} compact />);
    expect(screen.queryByText('Freeze')).toBeNull();
    expect(screen.getByTitle('Freeze card')).toBeInTheDocument();
    expect(screen.getByTitle('Cancel card')).toBeInTheDocument();
  });

  it('disables the freeze button while its own action is busy', () => {
    render(<CardActionControls card={makeCard({ id: 'card-5', status: 'active' })} busyId="card-5" withBusy={withBusy} />);
    expect(screen.getByText('Freeze').closest('button')).toBeDisabled();
  });
});
