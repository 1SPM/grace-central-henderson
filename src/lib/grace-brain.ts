/**
 * Pre-ADR-014 client-side "Grace memory" storage format.
 *
 * The writing/prompt-injection side of this (addBrainEntry,
 * buildBrainContext, parseBrainDirective) moved server-side into
 * api/_lib/grace-memory.ts, which persists to grace_memories instead of
 * localStorage. Only the read side survives here, for the one-time
 * import in GraceChatContext.tsx that carries a returning user's old
 * localStorage entries into server memory (see the migration effect
 * there) so demo continuity isn't lost across the cutover.
 */

export interface GraceBrainEntry {
  id: string;
  text: string;
  createdAt: string;
}

export const GRACE_BRAIN_STORAGE_KEY = 'grace:brain:v1';

export function deserializeBrainEntries(raw: string | null | undefined): GraceBrainEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is GraceBrainEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Record<string, unknown>;
      return typeof candidate.id === 'string'
        && typeof candidate.text === 'string'
        && typeof candidate.createdAt === 'string';
    });
  } catch {
    return [];
  }
}
