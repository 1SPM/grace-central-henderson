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
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { isDemoModeActive } from '../config/tenant';
import { setClerkTokenProvider } from '../lib/supabase';

export interface PortalAuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  isDemo: boolean;
  /** True when this session is a staff-issued, read-only portal preview
   * (see api/people/_preview-portal-token.ts) rather than the member's
   * own sign-in. The portal UI shows a persistent banner and every
   * mutating request is rejected server-side regardless of what the UI
   * does — this flag exists for UX (disabling write affordances), not
   * as the security control. */
  isPreview: boolean;
  previewPersonName: string | null;
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

  // Register the same global Clerk-token provider the staff AuthContext
  // uses (src/lib/supabase.ts) — the Portal and staff CRM are mutually
  // exclusive route trees (see isPortalRoute in main.tsx), so only one
  // provider is ever active per page load. Without this, real portal
  // members' Supabase requests other than the explicit portal API routes
  // (e.g. api/neobank, called directly with the global provider) go out
  // with the anon key and silently return nothing. Mirrors the ordering
  // fix already applied to AuthContext.tsx: registration is synchronous
  // and unconditional on identity resolution completing.
  useEffect(() => {
    if (isSignedIn) {
      setClerkTokenProvider(async () => {
        try {
          return await getToken({ template: 'supabase' }) ?? await getToken();
        } catch {
          return await getToken();
        }
      });
    } else {
      setClerkTokenProvider(null);
    }
  }, [isSignedIn, getToken]);

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
    isPreview: false,
    previewPersonName: null,
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
    isPreview: false,
    previewPersonName: null,
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
    isPreview: false,
    previewPersonName: null,
    memberFirstName: null,
    getAuthToken: async () => null,
  };
  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

/** Staff-issued read-only preview session — no Clerk involved at all. The
 * token itself is the credential; api/_lib/authz.ts's resolveMemberActor
 * validates it server-side on every request and rejects anything but GET. */
function PortalAuthProviderPreview({
  token,
  personName,
  children,
}: {
  token: string;
  personName: string | null;
  children: ReactNode;
}) {
  const value: PortalAuthContextValue = {
    isLoaded: true,
    isSignedIn: true,
    isDemo: false,
    isPreview: true,
    previewPersonName: personName,
    memberFirstName: personName,
    getAuthToken: async () => token,
  };
  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

function getPreviewParamsFromUrl(): { token: string; personName: string | null } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('preview_token');
    if (!token) return null;
    return { token, personName: params.get('preview_name') };
  } catch {
    return null;
  }
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const preview = getPreviewParamsFromUrl();
  if (preview) {
    return (
      <PortalAuthProviderPreview token={preview.token} personName={preview.personName}>
        {children}
      </PortalAuthProviderPreview>
    );
  }
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
