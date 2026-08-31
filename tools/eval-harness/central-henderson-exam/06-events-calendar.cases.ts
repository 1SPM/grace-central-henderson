/**
 * Central Henderson Qualification Exam — domain 6 (events/calendar).
 * Grid: KNOW=T REMEMBER=F CONNECT=F INTERPRET=F RECOMMEND=T ACT=T ANTICIPATE=F.
 *
 * Fixture #005 already comprehensively covers this domain's KNOW-level
 * 7-day-window + privacy-exclusion property (ec-know-events-window-and-privacy)
 * and its RECOMMEND/ACT cells — deliberately NOT re-tested here. Only two
 * genuinely new angles: a CONNECT tracking case and a REMEMBER finding, per
 * the plan's explicit note to diff against fixture-005 first.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_STAFF_USER } from '../../../tests/fixtures/shared-platform.js';
import { pass, fail } from '../scoring.js';
import type { EvalCase } from '../types.js';
import { HENDERSON_CHURCH_ID } from './_henderson-knowledge-seed.js';

const FIXTURE = 'central-henderson-exam';
const TENANT = { churchId: HENDERSON_CHURCH_ID, label: 'Central Henderson' };

function base(over: Partial<EvalCase>): EvalCase {
  return {
    fixture: FIXTURE,
    domain: 'events_calendar',
    tenant: TENANT,
    actor: { label: FIXTURE_STAFF_USER.email, permission: 'ask_grace.use' },
    proofBoundary: 'mock',
    requiresLiveJudgment: false,
    ...over,
  } as EvalCase;
}

export const EVENTS_CALENDAR_CASES: EvalCase[] = [
  base({
    id: 'evt-connect-event-and-giving-campaign-cross-reference',
    level: 'CONNECT',
    classification: 'future',
    requiresLiveJudgment: false,
    expectedBehavior: 'NOT YET TESTABLE: relating a fundraising/outreach event to a giving campaign has no grounding mechanism — neither campaigns nor a campaign-to-event link exists anywhere in dataContext (see domain 7\'s giving-finance findings).',
    // Deliberately no run() — grid is 'future' for this cell; nothing to attempt.
  }),

  base({
    id: 'evt-remember-no-past-event-history-finding',
    level: 'REMEMBER',
    classification: 'testable',
    isArchitecturalFinding: true,
    proofBoundary: 'static_catalog',
    expectedBehavior: 'DOCUMENTED FINDING: buildDataContext\'s events line only ever reflects a single forward-looking snapshot (events within the next 7 days) — there is no mechanism to retrieve a PAST event\'s details, distinct from the forward-window limit fixture-005 already proves.',
    run: async () => {
      const contextSrc = readFileSync(join(process.cwd(), 'src/contexts/GraceChatContext.tsx'), 'utf8');
      const hasForwardLookingComputation = contextSrc.includes('const upcomingEvents =');
      // No past-event/history-oriented mechanism exists anywhere in the
      // file — confirmed by absence of any plausible identifier for one.
      // (buildSuggestions's separate `eventsSoon` local is also
      // forward-looking, not a history mechanism, so it doesn't count
      // against this claim.)
      const noPastEventMechanism = !/past[Ee]vents|event[Hh]istory|previous[Ee]vents|historicalEvents/.test(contextSrc);
      const evidence = [`forward-looking (7-day) events computation exists: ${hasForwardLookingComputation}`, `no past/history-oriented events mechanism exists anywhere in the file: ${noPastEventMechanism}`];
      return hasForwardLookingComputation && noPastEventMechanism
        ? pass(evidence)
        : fail(evidence, 'events-domain memory mechanism no longer matches the documented finding — re-verify whether past-event retrieval was added');
    },
  }),
];
