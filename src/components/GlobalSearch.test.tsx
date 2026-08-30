import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalSearch } from './GlobalSearch';

const mockCanAccess = vi.hoisted(() => ({ current: (_view: string): boolean => true }));

vi.mock('../hooks/useRouteGuard', () => ({
  useRouteGuard: () => ({ canAccess: (view: string) => mockCanAccess.current(view), getBlockedMessage: () => null }),
}));

vi.mock('../hooks/useWorkOsPermissions', () => ({
  useWorkOsPermissions: () => ({ permissions: new Set<string>() }),
}));

function noop() {}

function renderPalette() {
  render(
    <GlobalSearch
      people={[]}
      tasks={[]}
      prayers={[]}
      onSelectPerson={noop}
      onSelectTask={noop}
      onSelectPrayer={noop}
      onNavigate={noop}
      onClose={noop}
      onRunAction={noop}
    />
  );
}

describe('GlobalSearch — view visibility respects route access', () => {
  it('does not offer a restricted view (Settings) to a user who cannot access it', () => {
    mockCanAccess.current = (view) => view !== 'settings';
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(/do something, jump somewhere/i), { target: { value: 'Settings' } });

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('offers GRACE WorkOS to a user who can access it', () => {
    mockCanAccess.current = () => true;
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(/do something, jump somewhere/i), { target: { value: 'WorkOS' } });

    expect(screen.getByText('GRACE WorkOS')).toBeInTheDocument();
  });

  it('does not offer GRACE WorkOS to a user who cannot access it', () => {
    mockCanAccess.current = (view) => view !== 'workos';
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(/do something, jump somewhere/i), { target: { value: 'WorkOS' } });

    expect(screen.queryByText('GRACE WorkOS')).not.toBeInTheDocument();
  });

  it('excludes restricted views from the default (no-query) suggestion list', () => {
    mockCanAccess.current = (view) => view !== 'settings' && view !== 'analytics' && view !== 'reports';
    renderPalette();

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });
});
