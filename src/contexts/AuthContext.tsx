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
import { supabase } from '../lib/supabase';

interface AuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  permissions: UserPermissions | null;
  signOut: () => Promise<void>;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  hasAnyPermission: (permissions: (keyof UserPermissions)[]) => boolean;
  inviteUser: (params: InviteUserParams) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (userId: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  removeUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  getOrganizationUsers: () => Promise<{ success: boolean; users?: User[]; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Get Clerk publishable key from environment
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync Clerk user with our database
  useEffect(() => {
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
            // Create new user in database
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert({
                clerk_id: clerkUser.id,
                email: clerkUser.emailAddresses[0]?.emailAddress || '',
                first_name: clerkUser.firstName,
                last_name: clerkUser.lastName,
                role: 'staff', // Default role
                church_id: 'demo-church', // Default church
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
            churchId: 'demo-church',
            createdAt: new Date().toISOString(),
          };
          setUser(mockUser);
          authService.setCurrentUser(mockUser);
        }
      } catch (error) {
        console.error('Error syncing user:', error);
      }

      setIsLoading(false);
    }

    syncUser();
  }, [clerkLoaded, clerkSignedIn, clerkUser]);

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

  const value: AuthContextType = {
    isLoaded: clerkLoaded && !isLoading,
    isSignedIn: clerkSignedIn || false,
    user,
    permissions: user ? ROLE_PERMISSIONS[user.role] : null,
    signOut,
    hasPermission,
    hasAnyPermission,
    inviteUser,
    updateUserRole,
    removeUser,
    getOrganizationUsers,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Main Auth Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // If Clerk is not configured, provide a demo auth context
  if (!clerkPubKey) {
    return (
      <AuthProviderDemo>{children}</AuthProviderDemo>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </ClerkProvider>
  );
}

// Demo auth provider for when Clerk is not configured
function AuthProviderDemo({ children }: { children: React.ReactNode }) {
  const demoUser: User = {
    id: 'demo-user',
    clerkId: 'demo-clerk-id',
    email: 'demo@grace-crm.com',
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'admin',
    churchId: 'demo-church',
    createdAt: new Date().toISOString(),
  };

  const value: AuthContextType = {
    isLoaded: true,
    isSignedIn: true, // Auto sign-in for demo mode
    user: demoUser,
    permissions: ROLE_PERMISSIONS.admin,
    signOut: async () => {
      // Demo mode - no actual sign out
    },
    hasPermission: (permission) => ROLE_PERMISSIONS.admin[permission],
    hasAnyPermission: (permissions) => permissions.some(p => ROLE_PERMISSIONS.admin[p]),
    inviteUser: async () => ({ success: false, error: 'Demo mode - invites disabled' }),
    updateUserRole: async () => ({ success: false, error: 'Demo mode - role updates disabled' }),
    removeUser: async () => ({ success: false, error: 'Demo mode - user removal disabled' }),
    getOrganizationUsers: async () => ({ success: true, users: [demoUser] }),
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
