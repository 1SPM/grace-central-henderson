import type { User } from '../lib/services/auth';

export function greetingWord(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** How the signed-in operator should be addressed in the UI and AI prompts. */
export function resolveAddressee(firstName?: string | null, role?: User['role'] | null): string {
  const name = firstName?.trim() || 'there';
  if (role === 'pastor' || role === 'admin' || role === 'staff') {
    return `Pastor ${name}`;
  }
  return name;
}

export function resolveGreeting(now: Date, firstName?: string | null, role?: User['role'] | null) {
  return {
    salutation: greetingWord(now.getHours()),
    addressee: resolveAddressee(firstName, role),
  };
}
