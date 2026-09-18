/**
 * The allowlist for a portal visitor's carried story.
 *
 * docs/MEMBER_MOBILE_HANDOFF.md sets the rule: "Nothing selected by
 * inference." Everything a handoff may carry is named here, and anything else
 * is a 400 rather than a silent drop — a silent drop lets the client and the
 * allowlist drift apart until nobody knows which one is authoritative.
 *
 * Kept out permanently, in any tier: journal text, care notes, payment data,
 * account identifiers, Clerk ids, email, phone, anything read from
 * localStorage, and the demo persona's sample profile.
 */

/** Panels whose answers always travel when the visitor consents to the carry. */
export const CORE_SECTIONS = ['church', 'leadership', 'connect', 'reflect'] as const;

/**
 * Money-adjacent panels. MEMBER_MOBILE_HANDOFF.md requires these to sit behind
 * a SEPARATE allowlist and a distinct confirmation, so they travel only with
 * consent_money_sections. They are never imported as financial settings.
 *
 * Note the trap this guards: `wallet` is normally fixed KYC-topic labels, but
 * the story UI lets a visitor overwrite any section with free text — so wallet
 * CAN become prose. That is exactly why it is tier 2 rather than tier 1.
 */
export const MONEY_SECTIONS = ['wallet', 'impact'] as const;

export const ALL_SECTIONS: readonly string[] = [...CORE_SECTIONS, ...MONEY_SECTIONS];

/** Bounds. A handoff payload is a few sentences, not a document. */
export const MAX_SECTION_ITEMS = 12;
export const MAX_ITEM_CHARS = 400;
export const MAX_TOTAL_CHARS = 6000;
export const MAX_PREFERRED_NAME_CHARS = 80;

/**
 * Pilot segmentation. Enum-only and non-numeric on purpose: a 1-5 confidence
 * scale invites a derived "score" about a member, which this product does not
 * build. Every field offers an explicit decline.
 */
export const SEGMENT_FIELDS = {
  age_band: ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus', 'prefer_not_to_say'],
  language_preference: ['en', 'es', 'other', 'prefer_not_to_say'],
  attendance_mode: ['in_person', 'online', 'both', 'prefer_not_to_say'],
  digital_confidence: ['very_comfortable', 'comfortable', 'some_help', 'prefer_not_to_say'],
} as const satisfies Record<string, readonly string[]>;

export type SegmentField = keyof typeof SEGMENT_FIELDS;

export type ValidationOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; path: string };

/**
 * @param allowMoney whether tier-2 sections are permitted for this submission
 */
export function validateSections(
  input: unknown,
  allowMoney: boolean,
): ValidationOutcome<Record<string, string[]>> {
  if (input === undefined || input === null) return { ok: true, value: {} };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'sections must be an object', path: 'sections' };
  }

  // Null-prototype: every key written below comes from caller-supplied JSON, so
  // there must be no inherited `__proto__` or `constructor` to reach even if a
  // future edit weakens the allowlist check.
  const out: Record<string, string[]> = Object.create(null);
  let total = 0;

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const permitted = allowMoney ? ALL_SECTIONS : CORE_SECTIONS;
    // Resolve to the matching entry from OUR list rather than reusing the
    // caller's string. What gets written is then provably one of a handful of
    // local constants, not an attacker-influenced property name.
    const section = permitted.find(allowed => allowed === key);
    if (!section) {
      // Distinguish "not a section at all" from "a section you did not consent
      // to send": the second is a client bug worth surfacing precisely.
      const reason = ALL_SECTIONS.includes(key)
        ? `section '${key}' requires the money-sections consent`
        : `unknown section '${key}'`;
      return { ok: false, error: reason, path: `sections.${key}` };
    }
    if (!Array.isArray(raw)) {
      return { ok: false, error: `sections.${key} must be an array`, path: `sections.${key}` };
    }
    if (raw.length > MAX_SECTION_ITEMS) {
      return { ok: false, error: `sections.${key} exceeds ${MAX_SECTION_ITEMS} items`, path: `sections.${key}` };
    }

    const items: string[] = [];
    for (const [i, item] of raw.entries()) {
      if (typeof item !== 'string') {
        return { ok: false, error: `sections.${key}[${i}] must be a string`, path: `sections.${key}` };
      }
      const trimmed = item.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.length > MAX_ITEM_CHARS) {
        return { ok: false, error: `sections.${key}[${i}] exceeds ${MAX_ITEM_CHARS} characters`, path: `sections.${key}` };
      }
      total += trimmed.length;
      items.push(trimmed);
    }
    if (items.length > 0) out[section] = items;
  }

  if (total > MAX_TOTAL_CHARS) {
    return { ok: false, error: `story exceeds ${MAX_TOTAL_CHARS} characters`, path: 'sections' };
  }
  return { ok: true, value: out };
}

export function validateSegments(input: unknown): ValidationOutcome<Record<string, string>> {
  if (input === undefined || input === null) return { ok: true, value: {} };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'segments must be an object', path: 'segments' };
  }

  const out: Record<string, string> = Object.create(null);
  const fields = Object.keys(SEGMENT_FIELDS) as SegmentField[];
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    // Same reasoning as validateSections: write a local constant, never the
    // caller's own string.
    const field = fields.find(allowed => allowed === key);
    if (!field) {
      return { ok: false, error: `unknown segment '${key}'`, path: `segments.${key}` };
    }
    if (typeof raw !== 'string') {
      return { ok: false, error: `segments.${key} must be a string`, path: `segments.${key}` };
    }
    const allowed = SEGMENT_FIELDS[field] as readonly string[];
    if (!allowed.includes(raw)) {
      return { ok: false, error: `segments.${key} must be one of: ${allowed.join(', ')}`, path: `segments.${key}` };
    }
    // An explicit decline carries no information and should not be stored as
    // though the member answered.
    if (raw === 'prefer_not_to_say') continue;
    out[field] = raw;
  }
  return { ok: true, value: out };
}
