/**
 * Responsive-navigation test for the Members Portal shell: both the
 * desktop sidebar and the mobile bottom tab bar are present in the DOM
 * (Tailwind responsive classes decide which is visible at runtime), and
 * clicking a tab switches the rendered page.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { PortalShell } from './PortalShell';

vi.mock('./pages/PortalHome', () => ({ PortalHome: () => <div data-testid="page-home">Home page</div> }));
vi.mock('./pages/PortalChurch', () => ({ PortalChurch: () => <div data-testid="page-church">Church page</div> }));
vi.mock('./pages/PortalJourney', () => ({ PortalJourney: () => <div data-testid="page-journey">Journey page</div> }));
vi.mock('./pages/PortalCommunity', () => ({ PortalCommunity: () => <div data-testid="page-community">Community page</div> }));
vi.mock('./pages/PortalGiving', () => ({ PortalGiving: () => <div data-testid="page-giving">Giving page</div> }));
vi.mock('./pages/PortalProfile', () => ({ PortalProfile: () => <div data-testid="page-profile">Profile page</div> }));

describe('PortalShell (responsive navigation test)', () => {
  afterEach(() => window.history.replaceState(null, '', '#/'));

  it('renders both a desktop sidebar and a mobile bottom tab bar', async () => {
    render(<PortalShell />);
    await waitFor(() => expect(screen.getByTestId('page-home')).toBeInTheDocument());

    const desktopNav = screen.getByTestId('portal-nav-desktop');
    const mobileNav = screen.getByTestId('portal-nav-mobile');
    expect(desktopNav).toBeInTheDocument();
    expect(mobileNav).toBeInTheDocument();
    // Desktop nav is hidden below the sm breakpoint; mobile nav is sm:hidden.
    expect(desktopNav.className).toMatch(/hidden/);
    expect(mobileNav.className).toMatch(/sm:hidden/);
  });

  it('defaults to the My Home tab', async () => {
    render(<PortalShell />);
    await waitFor(() => expect(screen.getByTestId('page-home')).toBeInTheDocument());
  });

  it('switches pages when a desktop nav item is clicked', async () => {
    render(<PortalShell />);
    await waitFor(() => expect(screen.getByTestId('page-home')).toBeInTheDocument());

    const desktopNav = screen.getByTestId('portal-nav-desktop');
    fireEvent.click(within(desktopNav).getByText('My Journey'));

    await waitFor(() => expect(screen.getByTestId('page-journey')).toBeInTheDocument());
  });

  it('switches pages when a mobile tab-bar item is tapped', async () => {
    render(<PortalShell />);
    await waitFor(() => expect(screen.getByTestId('page-home')).toBeInTheDocument());

    const mobileNav = screen.getByTestId('portal-nav-mobile');
    fireEvent.click(within(mobileNav).getByLabelText('My Community'));

    await waitFor(() => expect(screen.getByTestId('page-community')).toBeInTheDocument());
  });

  it('switches to the Give tab', async () => {
    render(<PortalShell />);
    await waitFor(() => expect(screen.getByTestId('page-home')).toBeInTheDocument());

    const desktopNav = screen.getByTestId('portal-nav-desktop');
    fireEvent.click(within(desktopNav).getByText('Give'));

    await waitFor(() => expect(screen.getByTestId('page-giving')).toBeInTheDocument());
  });

  it('marks the active tab with aria-current for assistive tech', async () => {
    render(<PortalShell />);
    await waitFor(() => expect(screen.getByTestId('page-home')).toBeInTheDocument());

    const desktopNav = screen.getByTestId('portal-nav-desktop');
    const homeButton = within(desktopNav).getByText('My Home').closest('button');
    expect(homeButton).toHaveAttribute('aria-current', 'page');
  });
});
