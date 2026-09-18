/**
 * Holds a redeemed story across the Clerk sign-up redirect.
 *
 * After /claim redeems the handoff token, the member taps "Create my account"
 * and Clerk navigates away to its own pages and back. Anything in React state
 * is gone by the time provisioning runs, so the attach handle has to be
 * parked somewhere — sessionStorage, which is per-tab and dies with the tab.
 *
 * WHAT IS PARKED, AND WHAT IS NOT. Only the draft id, the attach nonce and the
 * preferred name. The story text itself is never written to storage: it has
 * already been delivered to the page, and a member's own words about what they
 * are hoping to find should not outlive the tab in a place another script on
 * the origin could read.
 *
 * The nonce is what makes this safe. A draft id alone is guessable-adjacent —
 * it appears in URLs and logs — so the server requires the nonce, consumes it
 * once, and scopes the attach by church.
 */

const STORAGE_KEY = 'grace.portal.pending-story-claim';

export interface PendingStoryClaim {
  draftId: string;
  attachNonce: string;
  preferredName?: string | null;
  /** ISO timestamp; the server enforces this too, this just avoids a pointless call. */
  attachExpiresAt?: string | null;
}

function isUuidish(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);
}

export function savePendingStoryClaim(claim: PendingStoryClaim): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      draftId: claim.draftId,
      attachNonce: claim.attachNonce,
      preferredName: claim.preferredName ?? null,
      attachExpiresAt: claim.attachExpiresAt ?? null,
    }));
  } catch {
    // Private mode or storage disabled: sign-up still works, the story just
    // will not attach. Never break account creation over a research record.
  }
}

/** Re-validated on every read: sessionStorage is user-writable. */
export function readPendingStoryClaim(): PendingStoryClaim | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingStoryClaim>;
    if (!isUuidish(parsed.draftId)) return null;
    if (typeof parsed.attachNonce !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(parsed.attachNonce)) return null;
    if (parsed.attachExpiresAt && Date.parse(parsed.attachExpiresAt) < Date.now()) return null;
    return {
      draftId: parsed.draftId,
      attachNonce: parsed.attachNonce,
      preferredName: typeof parsed.preferredName === 'string' ? parsed.preferredName : null,
      attachExpiresAt: parsed.attachExpiresAt ?? null,
    };
  } catch {
    return null;
  }
}

/** Called once the attach has been attempted — the nonce is single-use. */
export function clearPendingStoryClaim(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see savePendingStoryClaim */
  }
}
