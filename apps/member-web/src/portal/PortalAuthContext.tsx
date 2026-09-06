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
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { isDemoModeActive } from '@grace/platform-core/tenant';
import { setClerkTokenProvider } from '@grace/platform-core/supabase';

export interface PortalAuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  isDemo: boolean;
  memberFirstName: string | null;
  getAuthToken: () => Promise<string | null>;
  /** True while a freshly-signed-in member is being completed into a
   * usable identity (api/portal/_self-signup.ts) — see
   * PortalAuthProviderInner's provisioning effect. PortalGate shows a
   * loading state rather than the sign-in wall or a broken shell while
   * this is true. */
  isProvisioning: boolean;
  /** Set if provisioning failed (e.g. this host isn't a recognized
   * church domain) — distinct from a normal loading state. */
  provisioningError: string | null;
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

// Anonymous member-portal access for a signed-out visitor on a known
// DEMO host. Deliberately separate from isDemoModeEnabled above — that
// flag is permanently host-locked with "no env var able to override that
// in production" (see its own docstring) precisely because it ALSO drives
// the staff app's auth mode (contexts/authMode.ts resolveAuthMode, checked
// before Clerk config), so widening it would have effects beyond this
// portal preview link.
//
// CORRECTION (members-portal audit, Phase 0): this used to list
// gracecrm-centralhenderson.org — Central Henderson's own LIVE domain —
// on the theory that it "mirrors the server-side HOST_CHURCH_IDS
// allowlist." That premise was wrong even when written: the server's
// resolveMemberActor gates on DEMO_HOSTS (api/_lib/authz.ts), not
// HOST_CHURCH_IDS, and DEMO_HOSTS deliberately EXCLUDES that host — it
// is the fix for the exact TD-043 bypass this list was quietly
// reopening. The practical symptom: a signed-out visitor who found
// /portal on the live domain got the full portal shell (isSignedIn:
// true via treatAsDemo below) while every api/portal/* call 401'd,
// because the server correctly refused to bootstrap a demo actor for a
// real tenant.
//
// Every host that legitimately needs signed-out demo access already
// gets routed to PortalAuthProviderDemo by isDemoModeEnabled above,
// before this component ever mounts — so this set exists only for a
// demo host NOT already covered by that check. There is no such host
// today. Keep this empty; if one is ever needed, it must be a host in
// api/_lib/authz.ts's DEMO_HOSTS, never a real tenant's own domain.
// Enforced by PortalAuthContext.test.ts.
export const PORTAL_DEMO_HOSTS = new Set<string>([]);
const isPortalDemoHost = typeof window !== 'undefined' && PORTAL_DEMO_HOSTS.has(window.location.hostname);

/** Reads the church_id claim out of a Clerk session JWT client-side, no
 * library needed — just enough to decide whether self-signup needs to
 * run. Never trusted for anything security-relevant: every server route
 * re-verifies the token and re-derives church_id itself
 * (api/_lib/auth-helper.ts). A malformed/unexpected token shape reads as
 * "no claim" rather than throwing, so it safely falls through to
 * attempting self-signup. */
function tokenHasChurchClaim(token: string): boolean {
  try {
    const payloadSegment = token.split('.')[1];
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { app_metadata?: { church_id?: string }; church_id?: string };
    return !!(payload.app_metadata?.church_id ?? payload.church_id);
  } catch {
    return false;
  }
}

function PortalAuthProviderInner({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [provisioningDone, setProvisioningDone] = useState(false);

  // Completes a first-time (or church_id-claim-less) sign-in into a
  // usable identity: a brand-new Clerk sign-up has no church association
  // at all until api/portal/_self-signup.ts sets it. Runs once per
  // sign-in; idempotent on the server, so re-running for an
  // already-provisioned member is a cheap no-op rather than something
  // that needs its own "already done" tracking here beyond
  // provisioningDone (which just stops it from re-firing on every
  // re-render while isSignedIn stays true).
  useEffect(() => {
    if (!isSignedIn || provisioningDone) return;
    let cancelled = false;

    (async () => {
      setIsProvisioning(true);
      setProvisioningError(null);
      try {
        // The DEFAULT session token (no template) carries app_metadata —
        // the 'supabase' template is scoped for direct Supabase RLS calls
        // only (see setClerkTokenProvider below) and isn't guaranteed to
        // include it.
        const token = await getToken({ skipCache: true });
        if (!token) throw new Error('no_session_token');

        if (!tokenHasChurchClaim(token)) {
          const resp = await fetch('/api/portal/self-signup', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body.error || `self_signup_failed_${resp.status}`);
          }
          // Clerk's cached token won't reflect the metadata write just
          // made until forced — every getToken() call after this in the
          // session (getAuthToken below, setClerkTokenProvider) needs the
          // refreshed claim.
          await getToken({ skipCache: true });
        }
        if (!cancelled) setProvisioningDone(true);
      } catch (err) {
        if (!cancelled) {
          setProvisioningError(
            err instanceof Error && err.message === 'signup_not_available_on_this_domain'
              ? "This isn't a recognized church address yet. Contact your church administrator."
              : "We couldn't finish setting up your account. Please try again in a moment.",
          );
        }
      } finally {
        if (!cancelled) setIsProvisioning(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isSignedIn, provisioningDone, getToken]);

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

  // No real session on a known portal-demo host: behave like the demo
  // provider (isDemo: true) instead of falling through to the sign-in
  // wall below. A real session always wins — this only ever applies
  // while Clerk reports signed-out, so it can't downgrade anyone's real
  // identity. getAuthToken already returns null when !isSignedIn, which
  // is exactly what the demo posture needs (see resolveDemoMemberActor).
  const treatAsDemo = isLoaded && !isSignedIn && isPortalDemoHost;

  const value: PortalAuthContextValue = {
    isLoaded,
    isSignedIn: !!isSignedIn || treatAsDemo,
    isDemo: treatAsDemo,
    memberFirstName: user?.firstName ?? null,
    getAuthToken,
    isProvisioning: !!isSignedIn && isProvisioning,
    provisioningError,
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
    isProvisioning: false,
    provisioningError: null,
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
    isProvisioning: false,
    provisioningError: null,
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
