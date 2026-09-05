/**
 * Regression coverage for the syncUser bug fixed 2026-09-05: a real
 * Supabase error (network/RLS/outage) on the `users` lookup was treated
 * identically to "genuinely zero rows for this clerk_id", bouncing an
 * existing staff member to /signup's new-church wizard. Only a true
 * PGRST116 (zero rows) should reach that branch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockUseAuth = vi.fn();
const mockUseUser = vi.fn();

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
  useClerk: () => ({ signOut: vi.fn() }),
}));

const mockSingle = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockSingle(),
        }),
      }),
    }),
  },
  setClerkTokenProvider: vi.fn(),
}));

vi.mock('../lib/observability/sentry', () => ({ setSentryUser: vi.fn() }));
vi.mock('../lib/observability/posthog', () => ({ identifyUser: vi.fn(), resetUser: vi.fn() }));

const CLERK_USER = {
  id: 'user_real_admin',
  emailAddresses: [{ emailAddress: 'admin@church.org' }],
  firstName: 'Pat',
  lastName: 'Admin',
  imageUrl: '',
  publicMetadata: {} as Record<string, unknown>,
};

function makeProbe(useAuthContext: typeof import('./AuthContext').useAuthContext) {
  return function Probe() {
    const { user, isLoaded } = useAuthContext();
    if (!isLoaded) return <div>loading</div>;
    return <div>{user ? `signed-in:${user.role}` : 'no-user'}</div>;
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_test_dummy';
  mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, getToken: vi.fn() });
  mockUseUser.mockReturnValue({ user: CLERK_USER });
  delete (window as unknown as { location: unknown }).location;
  (window as unknown as { location: { pathname: string } }).location = { pathname: '/dashboard' } as Location;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthContext syncUser error handling', () => {
  it('does not redirect to /signup when the users lookup fails with a real error (not zero-rows)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } });
    const { AuthProvider, useAuthContext } = await import('./AuthContext');
    const Probe = makeProbe(useAuthContext);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('still redirects to /signup on genuinely zero rows with no church metadata', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    const { AuthProvider, useAuthContext } = await import('./AuthContext');
    const Probe = makeProbe(useAuthContext);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(window.location.pathname).toBe('/signup'));
  });

  it('maps an existing users row normally when the lookup succeeds', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'db-1', clerk_id: 'user_real_admin', email: 'admin@church.org', role: 'admin', church_id: 'church-1', created_at: '2026-01-01' },
      error: null,
    });
    const { AuthProvider, useAuthContext } = await import('./AuthContext');
    const Probe = makeProbe(useAuthContext);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('signed-in:admin')).toBeInTheDocument());
  });
});
