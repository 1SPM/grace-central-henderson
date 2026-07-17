/**
 * Member Portal authentication context.
 *
 * Deliberately separate from the staff-facing AuthContext
 * (src/contexts/AuthContext.tsx) — that context's user-sync logic
 * assumes a `users` row and staff onboarding (create-church, publicMetadata
 * role claims) that a portal member will never have. Mounting the portal
 * behind its own ClerkProvider avoids fighting that logic, per the Members
 * Portal assessment's recommendation to build a real, separate frontend
 * shell rather than retrofitting the static prototype or the staff app.
 *
 * Same three-mode shape as the staff AuthContext (real Clerk / demo /
 * blocked) for consistency, but resolving a *member* identity, not staff.
 */
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { isDemoModeActive } from '../config/tenant';

export interface PortalAuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  isDemo: boolean;
  memberFirstName: string | null;
  getAuthToken: () => Promise<string | null>;
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
}

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// Hostname-derived, not a raw env var — see isDemoModeActive in config/tenant.ts.
const isDemoModeEnabled = isDemoModeActive();

function PortalAuthProviderInner({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (!isSignedIn) return null;
    try {
      return (await getToken({ template: 'supabase' })) ?? (await getToken());
    } catch {
      try {
        return await getToken();
      } catch {
        return null;
      }
    }
  }, [isSignedIn, getToken]);

  const value: PortalAuthContextValue = {
    isLoaded,
    isSignedIn: !!isSignedIn,
    isDemo: false,
    memberFirstName: user?.firstName ?? null,
    getAuthToken,
  };

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

function PortalAuthProviderDemo({ children }: { children: ReactNode }) {
  // No real Clerk session in demo mode — api/_lib/authz.ts recognizes the
  // same VITE_ENABLE_DEMO_MODE flag server-side and bootstraps a real
  // `people` row (resolveDemoMemberActor), so a null token here is
  // expected and handled, matching the Admin Dashboard's demo posture.
  const value: PortalAuthContextValue = {
    isLoaded: true,
    isSignedIn: true,
    isDemo: true,
    memberFirstName: null, // resolved server-side from the demo person row instead
    getAuthToken: async () => null,
  };
  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

function PortalAuthProviderBlocked({ children }: { children: ReactNode }) {
  const value: PortalAuthContextValue = {
    isLoaded: true,
    isSignedIn: false,
    isDemo: false,
    memberFirstName: null,
    getAuthToken: async () => null,
  };
  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  if (isDemoModeEnabled) {
    return <PortalAuthProviderDemo>{children}</PortalAuthProviderDemo>;
  }
  if (!clerkPubKey) {
    return <PortalAuthProviderBlocked>{children}</PortalAuthProviderBlocked>;
  }
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <PortalAuthProviderInner>{children}</PortalAuthProviderInner>
    </ClerkProvider>
  );
}
