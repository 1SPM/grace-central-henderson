import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OwnerPicker } from './OwnerPicker';

const STAFF = [
  { user_id: 'u-naomi', name: 'Naomi Ito', title: 'Director of Finance' },
  { user_id: 'u-trevor', name: 'Trevor Hicks', title: 'Volunteer Coordinator' },
];

describe('OwnerPicker (accountability control)', () => {
  it('assigns a named staff member', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<OwnerPicker ownerUserId={null} staff={STAFF} canManage onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u-naomi' } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('u-naomi'));
  });

  it('clears the owner with an explicit null, not undefined', async () => {
    // The whole point: `undefined` is silently dropped on the way to the
    // server (TD-045), so "unassign" has to send a real null.
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<OwnerPicker ownerUserId="u-naomi" staff={STAFF} canManage onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    expect(onChange.mock.calls[0][0]).toBeNull();
  });

  it('offers "nobody yet" as a real choice rather than hiding unowned work', () => {
    render(<OwnerPicker ownerUserId={null} staff={STAFF} canManage onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: /nobody yet — unowned/i })).toBeInTheDocument();
  });

  it('says so when there is no staff to assign, instead of offering placeholders', () => {
    render(<OwnerPicker ownerUserId={null} staff={[]} canManage onChange={vi.fn()} />);
    expect(screen.getByText(/no active staff accounts yet/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('keeps an owner who has left the staff list visible rather than reading as unowned', () => {
    render(<OwnerPicker ownerUserId="u-departed" staff={STAFF} canManage onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Former staff member' })).toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('u-departed');
  });

  it('shows the owner but no control to someone who cannot manage Work Orders', () => {
    render(<OwnerPicker ownerUserId="u-naomi" staff={STAFF} canManage={false} onChange={vi.fn()} />);
    expect(screen.getByText('Naomi Ito')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('tells a read-only viewer plainly when nobody owns the work', () => {
    render(<OwnerPicker ownerUserId={null} staff={STAFF} canManage={false} onChange={vi.fn()} />);
    expect(screen.getByText(/nobody owns this yet/i)).toBeInTheDocument();
  });

  it('surfaces a save failure instead of silently reverting', async () => {
    const onChange = vi.fn().mockRejectedValue(new Error('owner_not_in_church'));
    render(<OwnerPicker ownerUserId={null} staff={STAFF} canManage onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u-trevor' } });
    await waitFor(() => expect(screen.getByText('owner_not_in_church')).toBeInTheDocument());
  });
});
