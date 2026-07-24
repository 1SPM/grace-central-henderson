/**
 * Related-party transaction heuristic for Work Order approvals.
 *
 * Nonprofit boards are required to disclose transactions with parties
 * related to leadership (e.g. a grant to an org whose president is a
 * senior leader's family member). This is a coarse, deliberately-
 * conservative heuristic that surfaces a disclosure *question* for a
 * human reviewer — it never blocks an approval and is never treated as
 * a determination. False positives (a coincidental last-name match) are
 * expected and acceptable; false negatives are not checked further here
 * (e.g. it does not resolve corporate officers of an org named in
 * free text — only a literal last-name match against current
 * leadership). Pure function — no IO, directly unit-testable.
 */

export interface RelatedPartyCheckResult {
  flagged: boolean;
  matchedName?: string;
}

export function checkRelatedParty(
  counterpartyName: string,
  leadershipLastNames: string[],
): RelatedPartyCheckResult {
  const words = counterpartyName
    .toLowerCase()
    .split(/[\s,.]+/)
    .filter(w => w.length > 1); // skip single-letter tokens/initials

  const normalizedLastNames = leadershipLastNames
    .filter(n => n && n.trim().length > 1)
    .map(n => n.trim().toLowerCase());

  for (const lastName of normalizedLastNames) {
    if (words.includes(lastName)) {
      return { flagged: true, matchedName: lastName };
    }
  }
  return { flagged: false };
}
