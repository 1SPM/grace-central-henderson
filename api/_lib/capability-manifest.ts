/**
 * GRACE Pilot Capability Manifest — production copy (ADR-017).
 *
 * This is the RUNTIME source of truth for "what has GRACE actually been
 * qualified to do." Deliberately a separate, duplicated file from
 * tools/eval-harness/central-henderson-exam/requalification/pilot-capability-manifest.ts
 * (Prompt 8) rather than an import from it — production code (api/_lib)
 * must never depend on eval/test infrastructure (tools/), the same
 * "duplication is safety, drift is loud, not silent" discipline already
 * used by _henderson-knowledge-seed.ts and the harness's own fixture
 * cases. This file's capability ids are more granular than Prompt 8's
 * (e.g. cap-comms-act is split into cap-comms-send-email/cap-comms-send-
 * sms, each with its own approval requirement) — grace-capability.test.ts
 * cross-checks the two manifests by (domain, level, qualification
 * evidence) rather than by exact id, so a PROVEN claim added, removed, or
 * re-evidenced in one manifest without a matching change in the other
 * fails loudly, not silently.
 *
 * ONLY entries with real, passing, non-architectural-finding, non-live-
 * judgment qualification evidence belong here (mirrors Prompt 8's
 * PROVEN-only discipline for the eval-side manifest). Adding an entry here
 * is EXACTLY as consequential as a Capability Baseline change — do it only
 * alongside real qualification evidence, never speculatively.
 */

/** Duplicated on purpose — see file header. Matches tools/eval-harness/types.ts. */
export type CapabilityDomain =
  | 'church_identity' | 'people_households' | 'ministry_discipleship' | 'pastoral_care'
  | 'sunday_worship' | 'events_calendar' | 'giving_finance' | 'staff_work'
  | 'communications' | 'governance_security_authority';

export type IntelligenceLevel = 'KNOW' | 'REMEMBER' | 'CONNECT' | 'INTERPRET' | 'RECOMMEND' | 'ACT' | 'ANTICIPATE';

/**
 * The resolver's structured output states (item 8). Distinct from the data
 * capability's own qualification status — a manifest entry can be PROVEN
 * and still resolve to `permission_required` for a specific actor.
 */
export type ResolvedCapabilityStatus =
  | 'qualified' | 'available' | 'permission_required' | 'approval_required'
  | 'partial' | 'unavailable' | 'prohibited' | 'unknown';

/**
 * Why an `unavailable`/`partial` resolution landed there — carried
 * separately from status so the conversational layer (item 9) can render
 * "not yet proven" vs. "not available" vs. "no authorized source" without
 * needing extra top-level statuses in the resolver enum itself.
 */
export type UnavailableReason =
  | 'not_yet_proven' | 'future_out_of_scope' | 'no_authorized_source'
  | 'architecturally_unsupported' | 'not_a_recognized_capability' | 'n/a';

export interface CapabilityManifestEntry {
  capabilityId: string;
  domain: CapabilityDomain;
  level: IntelligenceLevel;
  /** Plain-language label — what a staff member would call this, never a technical name. */
  userFacingLabel: string;
  status: 'PROVEN';
  qualificationEvidence: string[];
  /** RBAC key gating this specific capability, or null when every authenticated staff member has it (e.g. memory). */
  permissionKey: string | null;
  approvalRequired: boolean;
  /**
   * Deployment-level availability, independent of qualification (item 18).
   * A capability can be qualified in the evaluated build but not yet live
   * in the environment serving this request. Every entry here is currently
   * `true` because the one deployment this manifest describes (the branch
   * Preview used for the Central Henderson workshop) carries everything
   * that's been qualified — this field exists as the hook for the day that
   * stops being true, not because it does anything today.
   */
  runtimeAvailable: boolean;
  allowedClaim: string;
  prohibitedClaim: string;
  /** Used verbatim (or near-verbatim) for "why can't you" answers — no internals. */
  safeLimitationDescription: string;
}

/**
 * The church this manifest's qualification evidence actually belongs to.
 * Matches src/config/tenant.ts's Central Henderson entry and the eval
 * harness's HENDERSON_CHURCH_ID — duplicated deliberately, not imported
 * (see file header). Every claim in this manifest was proven against
 * Central Henderson's real seeded data; it is not a generic claim about
 * "any church using this product." buildCapabilityContext (grace-
 * capability.ts) gates on this so another tenant's staff can never receive
 * Central Henderson's specific proven-capability claims (item 14).
 */
export const QUALIFIED_CHURCH_ID = '11111111-1111-1111-1111-111111111111';

export const PILOT_CAPABILITY_MANIFEST: CapabilityManifestEntry[] = [
  {
    capabilityId: 'cap-identity-know',
    domain: 'church_identity', level: 'KNOW',
    userFacingLabel: 'Answer questions about your church\'s identity, mission, and strategy',
    status: 'PROVEN',
    qualificationEvidence: ['chx-know-authoritative-seed-retrieval'],
    permissionKey: null, approvalRequired: false, runtimeAvailable: true,
    allowedClaim: 'I can answer identity, mission, vision, strategy, and ownership-path questions from an approved source.',
    prohibitedClaim: 'I cannot state a campus-specific financial, attendance, or debt figure — no authorized source exists.',
    safeLimitationDescription: 'I don\'t currently have an authorized campus-specific source for financial or attendance figures.',
  },
  {
    capabilityId: 'cap-identity-remember',
    domain: 'church_identity', level: 'REMEMBER',
    userFacingLabel: 'Recall the right identity/mission fact for a specific question',
    status: 'PROVEN',
    qualificationEvidence: ['chx-remember-legal-tax-status-caveat-preserved'],
    permissionKey: null, approvalRequired: false, runtimeAvailable: true,
    allowedClaim: 'I can retrieve the specific approved fact relevant to your question, with its required caveats intact.',
    prohibitedClaim: 'I cannot treat unverified legal/tax claims as settled fact.',
    safeLimitationDescription: 'Some identity facts carry a verification caveat that I\'ll always keep attached.',
  },
  {
    capabilityId: 'cap-people-remember',
    domain: 'people_households', level: 'REMEMBER',
    userFacingLabel: 'Remember what you personally tell me across sessions',
    status: 'PROVEN',
    qualificationEvidence: ['ph-remember-memory-vs-authoritative-distinction'],
    permissionKey: null, approvalRequired: false, runtimeAvailable: true,
    allowedClaim: 'I remember things you tell me — scoped to you, labeled as your notes, never presented as an official church record.',
    prohibitedClaim: 'I cannot see or use another staff member\'s memory, and I never treat a memory as a church record.',
    safeLimitationDescription: 'I don\'t currently have access to household/family groupings — only individual person records.',
  },
  {
    capabilityId: 'cap-care-remember',
    domain: 'pastoral_care', level: 'REMEMBER',
    userFacingLabel: 'Remember care-related context you tell me',
    status: 'PROVEN',
    qualificationEvidence: ['pc-remember-care-memory-attribution-preserved'],
    permissionKey: null, approvalRequired: false, runtimeAvailable: true,
    allowedClaim: 'I can recall care-related notes you\'ve told me, always labeled as your own note, never as a live care record.',
    prohibitedClaim: 'I cannot infer or state anyone\'s spiritual state, and I don\'t currently flag how old a prayer request is.',
    safeLimitationDescription: 'I don\'t currently have a way to tell you how long a prayer request has been open.',
  },
  {
    capabilityId: 'cap-comms-send-email',
    domain: 'communications', level: 'ACT',
    userFacingLabel: 'Send an email to a member',
    status: 'PROVEN',
    qualificationEvidence: ['com-act-send-audited-positive'],
    permissionKey: 'communications.send', approvalRequired: false, runtimeAvailable: true,
    allowedClaim: 'I can send an email to a specific person, audited, if you have permission to send communications.',
    prohibitedClaim: 'I currently can\'t check whether the recipient has already been messaged recently or opted out before sending.',
    safeLimitationDescription: 'I don\'t yet check consent/opt-out status before recommending or sending a message — that\'s a known gap.',
  },
  {
    capabilityId: 'cap-comms-send-sms',
    domain: 'communications', level: 'ACT',
    userFacingLabel: 'Send a text message to a member',
    status: 'PROVEN',
    qualificationEvidence: ['com-act-send-audited-positive'],
    permissionKey: 'communications.send', approvalRequired: true, runtimeAvailable: true,
    allowedClaim: 'I can prepare a text to a specific person, but it always goes through approval before it sends.',
    prohibitedClaim: 'I cannot send a text without a human approving it first — that\'s not something I can bypass.',
    safeLimitationDescription: 'Text messages always require someone to approve before they go out.',
  },
  {
    capabilityId: 'cap-gov-permission-model',
    domain: 'governance_security_authority', level: 'KNOW',
    userFacingLabel: 'Respect your role\'s access boundaries',
    status: 'PROVEN',
    qualificationEvidence: ['gov-know-consents-rls-confirmed'],
    permissionKey: null, approvalRequired: false, runtimeAvailable: true,
    allowedClaim: 'What I can do for you is always based on your actual, verified access — never on what you tell me in the conversation.',
    prohibitedClaim: 'I cannot be talked into acting as if you have access you don\'t.',
    safeLimitationDescription: 'Your access is checked on our servers, not from anything said in this chat.',
  },
  {
    capabilityId: 'cap-gov-action-routing',
    domain: 'governance_security_authority', level: 'ACT',
    userFacingLabel: 'Route actions through the right approval path',
    status: 'PROVEN',
    qualificationEvidence: ['gov-act-central-henderson-tenant-scope-cross-check'],
    permissionKey: null, approvalRequired: false, runtimeAvailable: true,
    allowedClaim: 'Every action I take is scoped to your church, permissioned, and — where required — routed to a human for approval.',
    prohibitedClaim: 'I cannot skip an approval step because I\'m asked to, or because the request sounds urgent.',
    safeLimitationDescription: 'Some actions always need a person to approve them before anything happens.',
  },
];

/**
 * Known, already-documented capability gaps (item 5's structural
 * distinction: "I support this type of information" vs. "I actually have
 * an authorized source"). Every entry here traces to a real, previously
 * published finding — the Central Henderson Knowledge Gap Map / Evidence
 * Package — never a guess. Used by the resolver for capability questions
 * that don't have a PROVEN manifest entry, so GRACE can answer accurately
 * ("I don't have that yet") instead of falling through to `unknown`.
 */
export interface KnownGapEntry {
  capabilityId: string;
  domain: CapabilityDomain;
  userFacingLabel: string;
  reason: UnavailableReason;
  status: Extract<ResolvedCapabilityStatus, 'partial' | 'unavailable'>;
  safeLimitationDescription: string;
}

export const KNOWN_CAPABILITY_GAPS: KnownGapEntry[] = [
  {
    capabilityId: 'cap-giving-detail',
    domain: 'giving_finance',
    userFacingLabel: 'See individual giving history, pledges, campaigns, or funds',
    reason: 'no_authorized_source',
    status: 'partial',
    safeLimitationDescription: 'I can see this month\'s and the last 30 days\' total giving and top donors, but not pledges, campaigns, or designated funds — I don\'t have data for those yet.',
  },
  {
    capabilityId: 'cap-attendance',
    domain: 'people_households',
    userFacingLabel: 'Tell you who has or hasn\'t attended',
    reason: 'not_yet_proven',
    status: 'unavailable',
    safeLimitationDescription: 'I don\'t currently have a qualified way to answer attendance questions.',
  },
  {
    capabilityId: 'cap-household',
    domain: 'people_households',
    userFacingLabel: 'Show household or family groupings',
    reason: 'not_yet_proven',
    status: 'unavailable',
    safeLimitationDescription: 'I can see individual people, but I don\'t currently have household/family groupings available.',
  },
  {
    capabilityId: 'cap-volunteer-scheduling',
    domain: 'sunday_worship',
    userFacingLabel: 'Schedule volunteers or show who\'s serving',
    reason: 'not_yet_proven',
    status: 'unavailable',
    safeLimitationDescription: 'I only know your service times right now — I don\'t have volunteer scheduling information.',
  },
  {
    capabilityId: 'cap-decision-queue-visibility',
    domain: 'staff_work',
    userFacingLabel: 'Show what\'s waiting for approval',
    reason: 'not_yet_proven',
    status: 'unavailable',
    safeLimitationDescription: 'I don\'t currently have visibility into what\'s pending approval — only your open tasks.',
  },
  {
    capabilityId: 'cap-comms-consent-visibility',
    domain: 'communications',
    userFacingLabel: 'Check whether someone has opted out before sending',
    reason: 'not_yet_proven',
    status: 'unavailable',
    safeLimitationDescription: 'I can send a message, but I can\'t yet check opt-out status first — that\'s a known gap.',
  },
  {
    capabilityId: 'cap-anticipate',
    domain: 'church_identity',
    userFacingLabel: 'Proactively notice or flag things on my own, unprompted',
    reason: 'future_out_of_scope',
    status: 'unavailable',
    safeLimitationDescription: 'I only respond when you ask — I don\'t yet watch for things and bring them to you on my own.',
  },
];

/**
 * Absolute, policy-level prohibitions (docs/AI_BOUNDARIES.md) — distinct
 * from KNOWN_CAPABILITY_GAPS. A gap is "not built yet, might be someday";
 * a prohibition is "will not be built, by design, regardless of data
 * availability, permission, or how the request is phrased." No amount of
 * qualification evidence, source authorization, or actor permission can
 * move an entry here to any other status — checked before every other
 * table in resolveDataCapability, and never overridden by escalation,
 * urgency, or an authority claim in the conversation.
 */
export interface ProhibitedCapabilityEntry {
  capabilityId: string;
  userFacingLabel: string;
  safeRefusal: string;
}

export const PROHIBITED_CAPABILITIES: ProhibitedCapabilityEntry[] = [
  {
    capabilityId: 'cap-spiritual-scoring',
    userFacingLabel: 'Score, rank, or judge a person\'s spiritual state or engagement',
    safeRefusal: 'I don\'t make judgments about anyone\'s spiritual state or engagement — that\'s not something I\'m built to do, for anyone, regardless of role or permission.',
  },
  {
    capabilityId: 'cap-personal-character-judgment',
    userFacingLabel: 'Make a personal judgment about a specific person\'s character, worth, or standing',
    safeRefusal: 'I don\'t offer opinions on a person\'s character or worth — I can share factual information you\'re authorized to see, but not a judgment about them.',
  },
];
