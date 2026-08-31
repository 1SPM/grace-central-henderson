/**
 * Central Henderson GRACE Authority & Sensitivity Map (item 6) — discovery
 * template for the sensitive domains named explicitly in the request:
 * giving, pastoral care, prayer, spiritual conversations, household/family
 * information, staff matters, communications consent.
 *
 * This does NOT design new permission architecture — it captures
 * requirements for a decision that hasn't been made yet. Every field is a
 * discovery question; `capture` holds the answer once a real session
 * happens.
 */

export interface SensitivityQuestionSet {
  whoMaySee: string | null;
  whoMayAskGrace: string | null;
  whoMayChange: string | null;
  whoMayAuthorizeGraceToAct: string | null;
  mayGraceSummarize: string | null;
  mayGraceCombineAcrossDomains: string | null;
  mayGraceRetainInMemory: string | null;
}

function blankQuestionSet(): SensitivityQuestionSet {
  return {
    whoMaySee: null,
    whoMayAskGrace: null,
    whoMayChange: null,
    whoMayAuthorizeGraceToAct: null,
    mayGraceSummarize: null,
    mayGraceCombineAcrossDomains: null,
    mayGraceRetainInMemory: null,
  };
}

export interface SensitiveAreaEntry {
  areaId: string;
  area: string;
  relatedGapIds: string[];
  whyThisIsSensitive: string;
  capture: SensitivityQuestionSet;
}

export const AUTHORITY_SENSITIVITY_MAP: SensitiveAreaEntry[] = [
  {
    areaId: 'auth-giving',
    area: 'Giving',
    relatedGapIds: ['dg-giving-persona-vocabulary-mismatch', 'dg-giving-care-authority-unresolved'],
    whyThisIsSensitive: 'Individual giving records are among the most sensitive data any church holds — visibility mistakes are trust-destroying and, in some cases, legally sensitive.',
    capture: blankQuestionSet(),
  },
  {
    areaId: 'auth-pastoral-care',
    area: 'Pastoral care',
    relatedGapIds: ['dg-giving-care-authority-unresolved'],
    whyThisIsSensitive: 'Care situations often involve crisis, grief, or conflict — information shared expecting confidentiality.',
    capture: blankQuestionSet(),
  },
  {
    areaId: 'auth-prayer',
    area: 'Prayer requests',
    relatedGapIds: ['dg-prayer-staleness-signal'],
    whyThisIsSensitive: 'Prayer requests frequently disclose health, marriage, financial, or family crises — submitted with an expectation of limited visibility.',
    capture: blankQuestionSet(),
  },
  {
    areaId: 'auth-spiritual-conversations',
    area: 'Spiritual conversations',
    relatedGapIds: [],
    whyThisIsSensitive: 'A conversation about someone\'s faith journey, doubt, or struggle is inherently personal, and GRACE is explicitly barred from inferring or scoring spiritual state (docs/AI_BOUNDARIES.md) — this area tests where the line on even neutral recall sits.',
    capture: blankQuestionSet(),
  },
  {
    areaId: 'auth-household-family',
    area: 'Household / family information',
    relatedGapIds: ['dg-households-not-exposed'],
    whyThisIsSensitive: 'Family composition can reveal separations, custody situations, blended families, or estrangement not otherwise visible from an individual record.',
    capture: blankQuestionSet(),
  },
  {
    areaId: 'auth-staff-matters',
    area: 'Staff matters',
    relatedGapIds: ['dg-workos-decision-queue-visibility'],
    whyThisIsSensitive: 'Staff performance, approvals, and internal work items are employment-adjacent — different disclosure norms than member-facing data.',
    capture: blankQuestionSet(),
  },
  {
    areaId: 'auth-communications-consent',
    area: 'Communications consent',
    relatedGapIds: ['dg-comms-consent-visibility'],
    whyThisIsSensitive: 'Opt-out status itself can be sensitive (someone may not want it known they opted out), and getting this wrong has real compliance exposure.',
    capture: blankQuestionSet(),
  },
];
