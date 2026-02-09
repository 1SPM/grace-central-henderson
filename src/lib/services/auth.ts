/**
 * Authentication Service - Clerk Integration
 *
 * Provides authentication capabilities using Clerk.
 * Handles user sessions, roles, and permissions.
 */

import { secureFetch } from '../../utils/security';
import { createLogger } from '../../utils/logger';

const log = createLogger('auth-service');

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  role: UserRole;
  churchId: string;
  createdAt: string;
  lastActiveAt?: string;
}

export type UserRole = 'admin' | 'pastor' | 'staff' | 'volunteer' | 'member';

export interface UserPermissions {
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewGiving: boolean;
  canManageGiving: boolean;
  canViewPeople: boolean;
  canManagePeople: boolean;
  canViewPrayers: boolean;
  canManagePrayers: boolean;
  canViewTasks: boolean;
  canManageTasks: boolean;
  canViewReports: boolean;
  canExportData: boolean;
  canSendCommunications: boolean;
}

// Role-based permission definitions
export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canManageUsers: true,
    canManageSettings: true,
    canViewGiving: true,
    canManageGiving: true,
    canViewPeople: true,
    canManagePeople: true,
    canViewPrayers: true,
    canManagePrayers: true,
    canViewTasks: true,
    canManageTasks: true,
    canViewReports: true,
    canExportData: true,
    canSendCommunications: true,
  },
  pastor: {
    canManageUsers: true,
    canManageSettings: true,
    canViewGiving: true,
    canManageGiving: true,
    canViewPeople: true,
    canManagePeople: true,
    canViewPrayers: true,
    canManagePrayers: true,
    canViewTasks: true,
    canManageTasks: true,
    canViewReports: true,
    canExportData: true,
    canSendCommunications: true,
  },
  staff: {
    canManageUsers: false,
    canManageSettings: false,
    canViewGiving: true,
    canManageGiving: true,
    canViewPeople: true,
    canManagePeople: true,
    canViewPrayers: true,
    canManagePrayers: true,
    canViewTasks: true,
    canManageTasks: true,
    canViewReports: true,
    canExportData: true,
    canSendCommunications: true,
  },
  volunteer: {
    canManageUsers: false,
    canManageSettings: false,
    canViewGiving: false,
    canManageGiving: false,
    canViewPeople: true,
    canManagePeople: false,
    canViewPrayers: true,
    canManagePrayers: false,
    canViewTasks: true,
    canManageTasks: false,
    canViewReports: false,
    canExportData: false,
    canSendCommunications: false,
  },
  member: {
    canManageUsers: false,
    canManageSettings: false,
    canViewGiving: false,
    canManageGiving: false,
    canViewPeople: false,
    canManagePeople: false,
    canViewPrayers: true,
    canManagePrayers: false,
    canViewTasks: false,
    canManageTasks: false,
    canViewReports: false,
    canExportData: false,
    canSendCommunications: false,
  },
};

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  permissions: UserPermissions | null;
}

export interface SignInResult {
  success: boolean;
  error?: string;
}

export interface InviteUserParams {
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

export interface InviteResult {
  success: boolean;
  inviteId?: string;
  error?: string;
}

class AuthService {
  private publishableKey: string | null = null;
  private isInitialized: boolean = false;
  private currentUser: User | null = null;

  configure(config: { publishableKey: string }) {
    this.publishableKey = config.publishableKey;
    this.isInitialized = true;
  }

  isConfigured(): boolean {
    return !!this.publishableKey && this.isInitialized;
  }

  // Get permissions for a role
  getPermissionsForRole(role: UserRole): UserPermissions {
    return ROLE_PERMISSIONS[role];
  }

  // Check if user has a specific permission
  hasPermission(
    user: User | null,
    permission: keyof UserPermissions
  ): boolean {
    if (!user) return false;
    const permissions = ROLE_PERMISSIONS[user.role];
    return permissions[permission];
  }

  // Check if user has any of the specified permissions
  hasAnyPermission(
    user: User | null,
    permissions: (keyof UserPermissions)[]
  ): boolean {
    if (!user) return false;
    const userPermissions = ROLE_PERMISSIONS[user.role];
    return permissions.some((p) => userPermissions[p]);
  }

  // Check if user has all of the specified permissions
  hasAllPermissions(
    user: User | null,
    permissions: (keyof UserPermissions)[]
  ): boolean {
    if (!user) return false;
    const userPermissions = ROLE_PERMISSIONS[user.role];
    return permissions.every((p) => userPermissions[p]);
  }

  // Get the display name for a role
  getRoleDisplayName(role: UserRole): string {
    const names: Record<UserRole, string> = {
      admin: 'Administrator',
      pastor: 'Pastor',
      staff: 'Staff Member',
      volunteer: 'Volunteer',
      member: 'Member',
    };
    return names[role];
  }

  // Get all roles for role selection dropdowns
  getAllRoles(): Array<{ id: UserRole; name: string; description: string }> {
    return [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full access to all features and settings',
      },
      {
        id: 'pastor',
        name: 'Pastor',
        description: 'Full access to all church data and communications',
      },
      {
        id: 'staff',
        name: 'Staff Member',
        description: 'Access to people, tasks, giving, and communications',
      },
      {
        id: 'volunteer',
        name: 'Volunteer',
        description: 'Limited access to people and prayer requests',
      },
      {
        id: 'member',
        name: 'Member',
        description: 'View-only access to prayer requests',
      },
    ];
  }

  // Sync Clerk user with local database
  async syncUserWithDatabase(clerkUser: {
    id: string;
    emailAddresses: Array<{ emailAddress: string }>;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string;
  }): Promise<User | null> {
    try {
      // This would typically call your Supabase backend
      // to create or update the user record
      const response = await secureFetch('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkId: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          imageUrl: clerkUser.imageUrl,
        }),
      });

      if (!response.ok) {
        log.error('Failed to sync user with database');
        return null;
      }

      const user = await response.json();
      this.currentUser = user;
      return user;
    } catch (error) {
      log.error('Error syncing user', error);
      return null;
    }
  }

  // Invite a new user to the organization
  async inviteUser(params: InviteUserParams): Promise<InviteResult> {
    try {
      const response = await secureFetch('/api/auth/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to send invitation',
        };
      }

      return {
        success: true,
        inviteId: result.inviteId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Update user role
  async updateUserRole(userId: string, role: UserRole): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await secureFetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const result = await response.json();
        return {
          success: false,
          error: result.error || 'Failed to update user role',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Remove user from organization
  async removeUser(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await secureFetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        return {
          success: false,
          error: result.error || 'Failed to remove user',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Get all users in the organization
  async getOrganizationUsers(): Promise<{
    success: boolean;
    users?: User[];
    error?: string;
  }> {
    try {
      const response = await secureFetch('/api/auth/users');

      if (!response.ok) {
        const result = await response.json();
        return {
          success: false,
          error: result.error || 'Failed to get users',
        };
      }

      const users = await response.json();
      return {
        success: true,
        users,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Set current user (called by AuthContext)
  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }
}

// Export singleton instance
export const authService = new AuthService();
