/**
 * Regression coverage for the fix landed 2026-09-05: an already-onboarded
 * Clerk account landing on /signup (e.g. bounced here by AuthContext's
 * syncUser after a stale clerk_id) used to be marched through
 * church-details → plan-confirm → Stripe again, which is what produced
 * "Could not activate trial" for an already-subscribed church. If Clerk's
 * publicMetadata already shows a church_id, skip straight to the dashboard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SignUpFlow } from './SignUpFlow';

const mockUseAuth = vi.fn();
const mockUseUser = vi.fn();

vi.mock('@clerk/clerk-react', () => ({
  SignUp: () => <div>clerk-sign-up-form</div>,
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as unknown as { location: unknown }).location;
  (window as unknown as { location: { pathname: string } }).location = { pathname: '/signup' } as Location;
});

describe('SignUpFlow', () => {
  it('sends an already-onboarded Clerk account straight to the dashboard instead of the wizard', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, getToken: vi.fn() });
    mockUseUser.mockReturnValue({ user: { fullName: 'Pat Admin', publicMetadata: { church_id: 'church-1' } } });

    render(<SignUpFlow />);

    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.queryByText('Tell us about your church')).not.toBeInTheDocument();
  });

  it('still walks a genuinely new account through church-details', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, getToken: vi.fn() });
    mockUseUser.mockReturnValue({ user: { fullName: 'New Pastor', publicMetadata: {} } });

    render(<SignUpFlow />);

    await waitFor(() => expect(screen.getByText('Tell us about your church')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/signup');
  });

  it('shows the Clerk sign-up form before authentication', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, getToken: vi.fn() });
    mockUseUser.mockReturnValue({ user: null });

    render(<SignUpFlow />);

    expect(screen.getByText('clerk-sign-up-form')).toBeInTheDocument();
  });
});
