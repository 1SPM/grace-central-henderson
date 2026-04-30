export interface GraceBrainEntry {
  id: string;
  text: string;
  createdAt: string;
}

export const GRACE_BRAIN_STORAGE_KEY = 'grace:brain:v1';

function normalizeMemoryText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function makeBrainId(text: string, createdAt: string): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'memory';
  return `${createdAt}-${slug}`;
}

export function parseBrainDirective(input: string): string | null {
  const trimmed = normalizeMemoryText(input);
  const match = trimmed.match(/^remember(?:\s+that)?\s+(.+)$/i);
  if (!match) return null;
  const memory = normalizeMemoryText(match[1]);
  return memory.length >= 2 ? memory : null;
}

export function addBrainEntry(
  entries: GraceBrainEntry[],
  text: string,
  limit = 50,
  createdAt = new Date().toISOString(),
): GraceBrainEntry[] {
  const normalized = normalizeMemoryText(text);
  if (!normalized) return entries;

  const key = normalized.toLowerCase();
  if (entries.some(entry => entry.text.toLowerCase() === key)) return entries.slice(0, limit);
  return [
    { id: makeBrainId(normalized, createdAt), text: normalized, createdAt },
    ...entries,
  ].slice(0, limit);
}

export function buildBrainContext(entries: GraceBrainEntry[], limit = 20): string {
  const active = entries.slice(0, limit).map(entry => `- ${entry.text}`);
  if (active.length === 0) return '';
  return `Grace memory — persistent notes the church staff asked Grace to remember:\n${active.join('\n')}`;
}

export function serializeBrainEntries(entries: GraceBrainEntry[]): string {
  return JSON.stringify(entries);
}

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
