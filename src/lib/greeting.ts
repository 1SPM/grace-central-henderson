import type { User } from '../lib/services/auth';

/** Interim display name until Clerk provides a real first name (VITE_TEMP_NAME). */
export const TEMP_DISPLAY_NAME =
  import.meta.env.VITE_TEMP_NAME?.trim() || 'Nick';

export function greetingWord(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** How the signed-in operator should be addressed in the UI and AI prompts. */
export function resolveAddressee(firstName?: string | null, role?: User['role'] | null): string {
  const trimmed = firstName?.trim();
  const usingTemp = !trimmed;
  const name = trimmed || TEMP_DISPLAY_NAME;
  // Interim single-tenant setup: treat temp fallback as pastor-facing admin UI.
  const effectiveRole = role ?? (usingTemp ? 'pastor' : null);
  if (effectiveRole === 'pastor' || effectiveRole === 'admin' || effectiveRole === 'staff') {
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

/** Church-local hour (0–23) for time-of-day salutations. */
export function getChurchHour(timezone: string, now = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(fmt.format(now), 10);
}

/** Full time-of-day greeting for GRACE panels, e.g. "Good evening, Pastor Nick". */
export function resolveGraceSalutation(
  hour: number,
  firstName?: string | null,
  role?: User['role'] | null,
): string {
  const { salutation, addressee } = resolveGreeting(
    new Date(2000, 0, 1, hour, 0, 0),
    firstName,
    role,
  );
  return `${salutation}, ${addressee}`;
}
