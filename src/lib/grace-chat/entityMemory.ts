/**
 * Detects an explicit request for a person's current record.
 *
 * SAFE TO BROADEN, BECAUSE NOT-FOUND FALLS THROUGH.
 *
 * The first version matched only "what do you remember about X", which missed
 * the phrasing the parity brief itself uses as its example — "Brief me on
 * Pastor James Wilson" — so that request reached the model with no profile
 * data and answered exactly as it had before (E-7).
 *
 * Broadening a client-side intent matcher is normally risky: "Tell me about
 * our giving this month" would be captured, the lookup would fail, and a good
 * model answer would be replaced by "I couldn't find a current record for our
 * giving this month." That failure mode is closed at the caller instead —
 * a `not_found` result does NOT short-circuit; the turn continues to the model
 * (GraceChatContext). So a false positive here costs one cheap indexed query,
 * never a worse answer. That is what lets these patterns stay generous.
 */

const REQUEST_PATTERNS: RegExp[] = [
  /^what\s+do\s+you\s+remember\s+about\s+(.+?)$/i,
  /^what\s+do\s+you\s+know\s+about\s+(.+?)$/i,
  /^brief\s+me\s+(?:on|about)\s+(.+?)$/i,
  /^(?:tell|catch)\s+me\s+(?:up\s+)?(?:on|about)\s+(.+?)$/i,
  /^who\s+is\s+(.+?)$/i,
  /^(?:give\s+me\s+)?(?:the\s+)?(?:background|context|history)\s+(?:on|for|about)\s+(.+?)$/i,
];

/**
 * Titles a staff member would naturally say but that are not part of the
 * stored name. Stripped so "Brief me on Pastor James Wilson" resolves the
 * same record as "Brief me on James Wilson".
 */
const HONORIFICS = /^(?:pastor|rev\.?|reverend|dr\.?|doctor|mr\.?|mrs\.?|ms\.?|miss|elder|deacon|deaconess|bishop|father|sister|brother)\s+/i;

export function requestedEntityMemoryName(query: string): string | null {
  const trimmed = query.trim().replace(/[?!.]+$/, '').trim();
  for (const pattern of REQUEST_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    let name = match[1].trim().replace(/\s+/g, ' ');
    // Strip repeatedly: "Pastor Dr. James Wilson".
    let previous = '';
    while (name !== previous) {
      previous = name;
      name = name.replace(HONORIFICS, '').trim();
    }
    if (!name || name.length > 120) return null;
    // A name has to contain a letter. Guards against "who is it", "tell me
    // about 2026" and similar shapes reaching the lookup.
    if (!/\p{L}/u.test(name)) return null;
    return name;
  }
  return null;
}
