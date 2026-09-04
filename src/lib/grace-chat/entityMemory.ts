/** Extracts only an explicit request for a current person record. */
export function requestedEntityMemoryName(query: string): string | null {
  const match = query.trim().match(/^what\s+do\s+you\s+remember\s+about\s+(.+?)[?!.]*$/i);
  const name = match?.[1]?.trim().replace(/\s+/g, ' ');
  return name && name.length <= 120 ? name : null;
}
