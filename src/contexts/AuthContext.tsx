/**
 * Authentication Context - Clerk Integration
 *
 * Provides authentication state and methods throughout the app.
 * Wraps Clerk's ClerkProvider and extends it with CRM-specific functionality.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useUser, useClerk } from '@clerk/clerk-react';
import {
  authService,
  User,
  UserRole,
  UserPermissions,
  ROLE_PERMISSIONS,
  InviteUserParams,
} from '../lib/services/auth';
import { supabase, setClerkTokenProvider } from '../lib/supabase';
import { resolveAuthMode } from './authMode';
import { TEMP_DISPLAY_NAME } from '../lib/greeting';
import { hasEnteredDemo, DEMO_ENTERED_EVENT } from '../lib/demoEntry';
import { isDemoModeActive } from '../config/tenant';

// Default church ID for demo/fallback mode. When Supabase is configured but
// Clerk is not (single-tenant interim setup), VITE_DEFAULT_CHURCH_ID points
// at the real church row so reads and writes carry a valid UUID.
const DEFAULT_CHURCH_ID: string = import.meta.env.VITE_DEFAULT_CHURCH_ID || 'demo-church';

interface AuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  churchId: string;
  permissions: UserPermissions | null;
  signOut: () => Promise<void>;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  hasAnyPermission: (permissions: (keyof UserPermissions)[]) => boolean;
  inviteUser: (params: InviteUserParams) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (userId: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  removeUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  getOrganizationUsers: () => Promise<{ success: boolean; users?: User[]; error?: string }>;
  /**
   * Returns a Clerk session bearer token for calling the shared-platform
   * WorkOS API routes (api/work-orders/*, api/approvals/*, etc.), or null
   * when no real Clerk session exists (demo mode / auth not configured —
   * those routes have their own demo-mode bootstrap server-side, see
   * api/_lib/authz.ts). Never throws.
   */
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Get Clerk publishable key from environment
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Demo mode is hostname-derived (see isDemoModeActive in config/tenant.ts) —
// NOT a raw env var. A single shared env var toggled for the Faithful
// Church demo tenant previously reopened the auth bypass for every other
// domain this Vercel project serves, including real clients.
const isDemoModeEnabled = isDemoModeActive();
const isProduction = import.meta.env.PROD;

// Hook to use auth context
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

// Inner provider that uses Clerk hooks
function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Register a Clerk-token provider with the Supabase client so every
  // Supabase request rides on the Clerk session JWT (enabling church-scoped
  // RLS via Supabase third-party auth — see src/lib/supabase.ts).
  //
  // Registration is synchronous and this effect is declared BEFORE the
  // syncUser effect below, so React's in-order effect execution guarantees
  // the provider is in place before the first users-table query fires. The
  // previous version awaited a dynamic import here, which raced syncUser:
  // when syncUser's query won, it went out with the anon key, RLS returned
  // zero rows, and the signed-in user was silently degraded to 'volunteer'.
  useEffect(() => {
    if (clerkSignedIn) {
      // Use template if your Clerk dashboard has a "supabase" template;
      // otherwise the default session token works for native third-party.
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
  }, [clerkSignedIn, getToken]);

  // Sync Clerk user with our database
  useEffect(() => {
    /**
     * Last-resort identity when the users-table read fails (RLS
     * misconfiguration, transient network/Supabase issue): derive the
     * user from Clerk publicMetadata instead of silently degrading a
     * real staff member to 'volunteer'. publicMetadata is only writable
     * server-side with the Clerk secret key (set during onboarding by
     * POST /api/billing/create-church), so for DISPLAY-level gating
     * it is exactly as trustworthy as the JWT claim derived from it.
     * All real authorization stays server-side (requirePermission/RLS)
     * — this only decides which pages the UI offers to render.
     */
    function clerkMetadataFallbackUser(u: NonNullable<typeof clerkUser>): User | null {
      const metaChurchId = u.publicMetadata?.church_id as string | undefined;
      const metaRole = u.publicMetadata?.role as string | undefined;
      const validRoles: UserRole[] = ['admin', 'pastor', 'staff', 'volunteer', 'member'];
      if (!metaChurchId || !metaRole || !validRoles.includes(metaRole as UserRole)) return null;
      return {
        id: u.id, // no DB row id available; Clerk id is stable and unique
        clerkId: u.id,
        email: u.emailAddresses[0]?.emailAddress || '',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        imageUrl: u.imageUrl,
        role: metaRole as UserRole,
        churchId: metaChurchId,
        createdAt: new Date().toISOString(),
      };
    }

    async function syncUser() {
      if (!clerkLoaded) return;

      if (!clerkSignedIn || !clerkUser) {
        setUser(null);
        authService.setCurrentUser(null);
        setIsLoading(false);
        return;
      }

      try {
        // Check if user exists in our database
        if (supabase) {
          const { data: existingUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('clerk_id', clerkUser.id)
            .single();

          if (existingUser && !error) {
            const mappedUser: User = {
              id: existingUser.id,
              clerkId: existingUser.clerk_id,
              email: existingUser.email,
              firstName: existingUser.first_name || clerkUser.firstName || '',
              lastName: existingUser.last_name || clerkUser.lastName || '',
              imageUrl: clerkUser.imageUrl,
              role: existingUser.role || 'staff',
              churchId: existingUser.church_id,
              createdAt: existingUser.created_at,
              lastActiveAt: new Date().toISOString(),
            };
            setUser(mappedUser);
            authService.setCurrentUser(mappedUser);
          } else {
            // User has no `users` row yet. The church_id comes from
            // publicMetadata set by POST /api/billing/create-church —
            // it must already exist before we write a users row.
            // If it's missing, the user hasn't finished onboarding;
            // redirect to /signup rather than inserting a row with a
            // wrong church (which RLS would reject anyway — the JWT
            // carries no church_id claim until create-church runs).
            const churchIdFromMeta = clerkUser.publicMetadata?.church_id as string | undefined;
            if (!churchIdFromMeta) {
              // Not yet onboarded — bounce to sign-up to complete church creation.
              if (window.location.pathname !== '/signup') {
                window.location.pathname = '/signup';
              }
              setIsLoading(false);
              return;
            }

            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert({
                clerk_id: clerkUser.id,
                email: clerkUser.emailAddresses[0]?.emailAddress || '',
                first_name: clerkUser.firstName,
                last_name: clerkUser.lastName,
                role: (clerkUser.publicMetadata?.role as string | undefined) || 'staff',
                church_id: churchIdFromMeta,
              })
              .select()
              .single();

            if (newUser && !createError) {
              const mappedUser: User = {
                id: newUser.id,
                clerkId: newUser.clerk_id,
                email: newUser.email,
                firstName: newUser.first_name || '',
                lastName: newUser.last_name || '',
                imageUrl: clerkUser.imageUrl,
                role: newUser.role || 'staff',
                churchId: newUser.church_id,
                createdAt: newUser.created_at,
              };
              setUser(mappedUser);
              authService.setCurrentUser(mappedUser);
            } else {
              // The row may already exist but be invisible to this
              // client (RLS reads returning zero rows also make the
              // insert fail on the duplicate clerk_id). Don't strand a
              // legitimately-onboarded user as 'volunteer' — fall back
              // to their server-set Clerk metadata.
              const fallbackUser = clerkMetadataFallbackUser(clerkUser);
              if (fallbackUser) {
                setUser(fallbackUser);
                authService.setCurrentUser(fallbackUser);
              }
            }
          }
        } else {
          // Demo mode - create a mock user
          const mockUser: User = {
            id: 'demo-user',
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress || 'demo@grace-crm.com',
            firstName: clerkUser.firstName || 'Demo',
            lastName: clerkUser.lastName || 'User',
            imageUrl: clerkUser.imageUrl,
            role: 'admin',
            churchId: DEFAULT_CHURCH_ID,
            createdAt: new Date().toISOString(),
          };
          setUser(mockUser);
          authService.setCurrentUser(mockUser);
        }
      } catch {
        // User sync threw (network/Supabase outage). Same reasoning as
        // above: prefer the server-set Clerk metadata over degrading a
        // real staff member to 'volunteer' until the next auth change.
        const fallbackUser = clerkMetadataFallbackUser(clerkUser);
        if (fallbackUser) {
          setUser(fallbackUser);
          authService.setCurrentUser(fallbackUser);
        }
      }

      setIsLoading(false);
    }

    syncUser();
  }, [clerkLoaded, clerkSignedIn, clerkUser]);

  // Identify the user to observability tools when auth state changes.
  // No PII is sent — just opaque IDs and the church tag for filtering.
  useEffect(() => {
    void (async () => {
      const { setSentryUser } = await import('../lib/observability/sentry');
      const { identifyUser, resetUser } = await import('../lib/observability/posthog');
      if (user) {
        setSentryUser(user.id, user.churchId);
        identifyUser(user.id, user.churchId);
      } else {
        setSentryUser(undefined, undefined);
        resetUser();
      }
    })();
  }, [user]);

  const signOut = useCallback(async () => {
    await clerkSignOut();
    setUser(null);
    authService.setCurrentUser(null);
  }, [clerkSignOut]);

  const hasPermission = useCallback(
    (permission: keyof UserPermissions): boolean => {
      return authService.hasPermission(user, permission);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions: (keyof UserPermissions)[]): boolean => {
      return authService.hasAnyPermission(user, permissions);
    },
    [user]
  );

  const inviteUser = useCallback(
    async (params: InviteUserParams) => {
      return authService.inviteUser(params);
    },
    []
  );

  const updateUserRole = useCallback(
    async (userId: string, role: UserRole) => {
      return authService.updateUserRole(userId, role);
    },
    []
  );

  const removeUser = useCallback(
    async (userId: string) => {
      return authService.removeUser(userId);
    },
    []
  );

  const getOrganizationUsers = useCallback(async () => {
    return authService.getOrganizationUsers();
  }, []);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (!clerkSignedIn) return null;
    try {
      return (await getToken({ template: 'supabase' })) ?? (await getToken());
    } catch {
      try {
        return await getToken();
      } catch {
        return null;
      }
    }
  }, [clerkSignedIn, getToken]);

  const value: AuthContextType = {
    isLoaded: clerkLoaded && !isLoading,
    isSignedIn: clerkSignedIn || false,
    user,
    churchId: user?.churchId || DEFAULT_CHURCH_ID,
    permissions: user ? ROLE_PERMISSIONS[user.role] : null,
    signOut,
    hasPermission,
    hasAnyPermission,
    inviteUser,
    updateUserRole,
    removeUser,
    getOrganizationUsers,
    getAuthToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Main Auth Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authMode = resolveAuthMode({
    clerkPublishableKey: clerkPubKey,
    isProduction,
    isDemoModeEnabled,
  });

  if (authMode === 'blocked') {
    return (
      <AuthProviderSecurityBlock>{children}</AuthProviderSecurityBlock>
    );
  }

  if (authMode === 'demo') {
    return (
      <AuthProviderDemo>{children}</AuthProviderDemo>
    );
  }

  if (!clerkPubKey) {
    return (
      <AuthProviderSecurityBlock>{children}</AuthProviderSecurityBlock>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </ClerkProvider>
  );
}

// Security block when auth is not configured in production
function AuthProviderSecurityBlock({ children }: { children: React.ReactNode }) {
  const value: AuthContextType = {
    isLoaded: true,
    isSignedIn: false,
    user: null,
    churchId: DEFAULT_CHURCH_ID,
    permissions: null,
    signOut: async () => {},
    hasPermission: () => false,
    hasAnyPermission: () => false,
    inviteUser: async () => ({ success: false, error: 'Authentication not configured' }),
    updateUserRole: async () => ({ success: false, error: 'Authentication not configured' }),
    removeUser: async () => ({ success: false, error: 'Authentication not configured' }),
    getOrganizationUsers: async () => ({ success: false, error: 'Authentication not configured' }),
    getAuthToken: async () => null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Demo auth provider for when Clerk is not configured
// SECURITY: Only enabled in development or when explicitly opted-in
// Uses 'admin' role so demo users can explore all features (including Settings)
function AuthProviderDemo({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(() => hasEnteredDemo());

  useEffect(() => {
    const sync = () => setEntered(hasEnteredDemo());
    window.addEventListener(DEMO_ENTERED_EVENT, sync);
    return () => window.removeEventListener(DEMO_ENTERED_EVENT, sync);
  }, []);

  const demoUser: User = {
    id: 'demo-user',
    clerkId: 'demo-clerk-id',
    email: 'demo@grace-crm.com',
    firstName: TEMP_DISPLAY_NAME,
    lastName: 'User',
    role: 'pastor',
    churchId: DEFAULT_CHURCH_ID,
    createdAt: new Date().toISOString(),
  };

  const value: AuthContextType = {
    isLoaded: true,
    isSignedIn: entered,
    user: entered ? demoUser : null,
    churchId: DEFAULT_CHURCH_ID,
    permissions: entered ? ROLE_PERMISSIONS.pastor : null,
    signOut: async () => {
      // Demo mode - no actual sign out
    },
    hasPermission: (permission) => entered && ROLE_PERMISSIONS.pastor[permission],
    hasAnyPermission: (permissions) => entered && permissions.some(p => ROLE_PERMISSIONS.pastor[p]),
    inviteUser: async () => ({ success: false, error: 'Demo mode - invites disabled' }),
    updateUserRole: async () => ({ success: false, error: 'Demo mode - role updates disabled' }),
    removeUser: async () => ({ success: false, error: 'Demo mode - user removal disabled' }),
    getOrganizationUsers: async () => ({ success: true, users: entered ? [demoUser] : [] }),
    // No real Clerk session in demo mode — the WorkOS API routes recognize
    // VITE_ENABLE_DEMO_MODE server-side and bootstrap their own actor
    // (api/_lib/authz.ts resolveDemoStaffActor), so a null token here is
    // expected and handled, not a bug.
    getAuthToken: async () => null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Auth UI Components for sign in/up flows
export function SignInPage() {
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-dark-850 rounded-2xl shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100 mb-4">
            Demo Mode
          </h1>
          <p className="text-gray-600 dark:text-dark-300 mb-6">
            Clerk authentication is not configured. Configure your Clerk publishable key to enable authentication.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
          >
            Continue to Demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}

export function SignUpPage() {
  if (!clerkPubKey) {
    return <SignInPage />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}

// Protected route wrapper
export function ProtectedRoute({
  children,
  requiredPermission,
  fallback,
}: {
  children: React.ReactNode;
  requiredPermission?: keyof UserPermissions;
  fallback?: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, hasPermission } = useAuthContext();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <SignInPage />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-dark-300">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
