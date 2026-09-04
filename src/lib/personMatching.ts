/**
 * The one person matcher, shared by the client action path
 * (grace-actions.ts) and the server person-lookup route
 * (api/grace/_entity-memory.ts) so "ambiguous" means one thing in this
 * product.
 *
 * This file is imported by API code running under Node ESM, where every
 * relative specifier must carry its extension and every transitive import
 * is shipped to the function. Keep it a LEAF: no imports, no `../types`.
 * (See api/_lib/esmImportBoundary.test.ts for the check that enforces it.)
 *
 * Tiers: exact full name → exact first name → substring of full name,
 * returning EVERY match at whichever tier hit, so `.length > 1` means
 * "resolvePerson would have picked one of these arbitrarily".
 */
export interface MatchablePerson {
  firstName: string;
  lastName: string;
}

export function countPersonMatches<P extends MatchablePerson>(name: string | undefined, people: P[]): P[] {
  if (!name) return [];
  const lower = name.toLowerCase().trim();
  const exact = people.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase() === lower);
  if (exact.length > 0) return exact;
  const firstNameOnly = people.filter(p => p.firstName.toLowerCase() === lower);
  if (firstNameOnly.length > 0) return firstNameOnly;
  return people.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(lower));
}
