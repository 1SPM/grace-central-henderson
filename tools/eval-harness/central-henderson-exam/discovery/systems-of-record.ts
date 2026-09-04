/**
 * Central Henderson GRACE Source Register — Systems of Record discovery
 * template (item 5). These are QUESTIONS to ask, not answers — every
 * field below is a discovery prompt, not filled-in data. Do NOT assume
 * GRACE/Supabase is the authoritative system for any of these; that is
 * exactly the assumption this template exists to test.
 *
 * Captured answer shape mirrors what the workshop should record:
 * System of Record → Data Owner → Access Method → Update Frequency →
 * Sensitivity → GRACE Authority. This becomes the seed of Central's
 * GRACE data map (see source-register.ts for the resulting register).
 */
import type { KnowledgeDomain } from '../../types.js';

export interface SystemOfRecordQuestion {
  categoryId: string;
  domain: KnowledgeDomain;
  category: string;
  discoveryQuestion: string;
  capture: {
    systemOfRecord: string | null;
    dataOwner: string | null;
    accessMethod: string | null;
    updateFrequency: string | null;
    sensitivity: string | null;
    graceAuthority: string | null;
  };
}

function blankCapture() {
  return {
    systemOfRecord: null,
    dataOwner: null,
    accessMethod: null,
    updateFrequency: null,
    sensitivity: null,
    graceAuthority: null,
  };
}

export const SYSTEMS_OF_RECORD_QUESTIONS: SystemOfRecordQuestion[] = [
  {
    categoryId: 'sor-people-member-records',
    domain: 'people_households',
    category: 'People / member records',
    discoveryQuestion: 'Where does your official record of a person — visitor, member, whatever term you use — actually live?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-households-families',
    domain: 'people_households',
    category: 'Households / families',
    discoveryQuestion: 'How do you group family members together today, and where is that grouping recorded?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-attendance',
    domain: 'people_households',
    category: 'Attendance',
    discoveryQuestion: 'How is attendance actually tracked — check-in system, headcount, something else — and where does it land?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-groups',
    domain: 'ministry_discipleship',
    category: 'Groups',
    discoveryQuestion: 'Where do you track which small groups exist and who\'s in them?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-discipleship-next-steps',
    domain: 'ministry_discipleship',
    category: 'Discipleship / next steps',
    discoveryQuestion: 'How do you track someone\'s spiritual next step or discipleship progress, if at all?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-pastoral-care',
    domain: 'pastoral_care',
    category: 'Pastoral care',
    discoveryQuestion: 'Where do pastoral care situations get recorded, and who has access to that record?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-prayer-requests',
    domain: 'pastoral_care',
    category: 'Prayer requests',
    discoveryQuestion: 'Where do prayer requests get submitted and tracked, and how do you know when one\'s been resolved?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-volunteers',
    domain: 'sunday_worship',
    category: 'Volunteers',
    discoveryQuestion: 'Where do you keep track of who volunteers, in what role, and their availability?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-sunday-scheduling',
    domain: 'sunday_worship',
    category: 'Sunday scheduling',
    discoveryQuestion: 'Show us where a Sunday service actually gets planned and who\'s scheduled to serve.',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-events-calendar',
    domain: 'events_calendar',
    category: 'Events / calendar',
    discoveryQuestion: 'Where does an event get created, and where does the public or your staff see it?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-giving',
    domain: 'giving_finance',
    category: 'Giving',
    discoveryQuestion: 'What system actually processes and records giving, and who has access to the detail behind the totals?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-funds-campaigns',
    domain: 'giving_finance',
    category: 'Funds / campaigns',
    discoveryQuestion: 'If you run designated funds or campaigns, where does that live separately from general giving?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-staff-tasks-work',
    domain: 'staff_work',
    category: 'Staff tasks / work',
    discoveryQuestion: 'Where does your team track what needs to get done, and where do things that need a pastor\'s sign-off wait?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-communications',
    domain: 'communications',
    category: 'Communications',
    discoveryQuestion: 'What system do you use to send church-wide messages, and how do you know who\'s opted out?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-policies',
    domain: 'governance_security_authority',
    category: 'Policies',
    discoveryQuestion: 'Where do your written policies live — for care, communications, data handling — and who maintains them?',
    capture: blankCapture(),
  },
  {
    categoryId: 'sor-permissions-roles',
    domain: 'governance_security_authority',
    category: 'Permissions / roles',
    discoveryQuestion: 'Who decides who\'s allowed to see or change what, and how is that decision recorded today?',
    capture: blankCapture(),
  },
];
