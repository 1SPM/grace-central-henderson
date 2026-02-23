export type AuthMode = 'clerk' | 'demo' | 'blocked';

export interface AuthModeInput {
  clerkPublishableKey?: string;
  isProduction: boolean;
  isDemoModeEnabled: boolean;
}

export function resolveAuthMode({
  clerkPublishableKey,
  isProduction,
  isDemoModeEnabled,
}: AuthModeInput): AuthMode {
  if (clerkPublishableKey) {
    return 'clerk';
  }

  if (isProduction && !isDemoModeEnabled) {
    return 'blocked';
  }

  return 'demo';
}
