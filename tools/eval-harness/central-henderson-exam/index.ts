/**
 * The Central Henderson GRACE Qualification Exam — all 10 knowledge
 * domains, in one place. Measures what GRACE actually knows and safely
 * understands about Central Henderson today; does not expand it.
 *
 * Every case uses ONLY authoritative or explicitly approved Central
 * Henderson sources: the real grace_knowledge seed (migration 076, copied
 * verbatim in _henderson-knowledge-seed.ts — not Fixture #001's
 * hand-authored approximation), real operational-data patterns already
 * used by the existing fixtures (people/tasks/giving/events/prayers via
 * GraceData, grace_memories via the shared chat harness), and real source
 * files/migrations for every architectural-finding case. Nothing here
 * invents a Central Henderson fact or fills a gap with general/model
 * knowledge — where authoritative data doesn't exist, the case documents
 * that as a finding or a NOT YET PROVEN/FUTURE tracking case instead.
 */
import { CHURCH_IDENTITY_CASES } from './01-church-identity.cases.js';
import { PEOPLE_HOUSEHOLDS_CASES } from './02-people-households.cases.js';
import { MINISTRY_DISCIPLESHIP_CASES } from './03-ministry-discipleship.cases.js';
import { PASTORAL_CARE_CASES } from './04-pastoral-care.cases.js';
import { SUNDAY_WORSHIP_CASES } from './05-sunday-worship.cases.js';
import { EVENTS_CALENDAR_CASES } from './06-events-calendar.cases.js';
import { GIVING_FINANCE_CASES } from './07-giving-finance.cases.js';
import { STAFF_WORK_CASES } from './08-staff-work.cases.js';
import { COMMUNICATIONS_CASES } from './09-communications.cases.js';
import { GOVERNANCE_SECURITY_AUTHORITY_CASES } from './10-governance-security-authority.cases.js';
import type { EvalCase } from '../types.js';

export const ALL_EXAM_CASES: EvalCase[] = [
  ...CHURCH_IDENTITY_CASES,
  ...PEOPLE_HOUSEHOLDS_CASES,
  ...MINISTRY_DISCIPLESHIP_CASES,
  ...PASTORAL_CARE_CASES,
  ...SUNDAY_WORSHIP_CASES,
  ...EVENTS_CALENDAR_CASES,
  ...GIVING_FINANCE_CASES,
  ...STAFF_WORK_CASES,
  ...COMMUNICATIONS_CASES,
  ...GOVERNANCE_SECURITY_AUTHORITY_CASES,
];

const seenIds = new Set<string>();
for (const c of ALL_EXAM_CASES) {
  if (seenIds.has(c.id)) throw new Error(`Duplicate exam case id: ${c.id}`);
  seenIds.add(c.id);
}
