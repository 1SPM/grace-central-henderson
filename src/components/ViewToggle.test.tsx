import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle } from './ViewToggle';

describe('ViewToggle', () => {
  it('renders card and table view buttons', () => {
    render(<ViewToggle view="card" onViewChange={() => {}} />);

    expect(screen.getByTitle('Card view')).toBeInTheDocument();
    expect(screen.getByTitle('Table view')).toBeInTheDocument();
  });

  it('highlights card view button when view is card', () => {
    render(<ViewToggle view="card" onViewChange={() => {}} />);

    const cardButton = screen.getByTitle('Card view');
    expect(cardButton).toHaveClass('bg-white');
  });

  it('highlights table view button when view is table', () => {
    render(<ViewToggle view="table" onViewChange={() => {}} />);

    const tableButton = screen.getByTitle('Table view');
    expect(tableButton).toHaveClass('bg-white');
  });

  it('calls onViewChange with "card" when card button is clicked', () => {
    const onViewChange = vi.fn();
    render(<ViewToggle view="table" onViewChange={onViewChange} />);

    fireEvent.click(screen.getByTitle('Card view'));

    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith('card');
  });

  it('calls onViewChange with "table" when table button is clicked', () => {
    const onViewChange = vi.fn();
    render(<ViewToggle view="card" onViewChange={onViewChange} />);

    fireEvent.click(screen.getByTitle('Table view'));

    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith('table');
  });
});
