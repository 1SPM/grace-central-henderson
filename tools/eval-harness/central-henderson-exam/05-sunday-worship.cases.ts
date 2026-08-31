/**
 * Central Henderson Qualification Exam — domain 5 (Sunday/worship).
 * Grid: KNOW=P, everything else F. No existing fixture covers this domain.
 * Zero positive-capability cases beyond the one honest exception (static
 * service times) — the research shows nothing else exists.
 */
import { FIXTURE_STAFF_USER } from '../../../tests/fixtures/shared-platform.js';
import { buildDataContext, type GraceData } from '../../../src/contexts/GraceChatContext.js';
import { postToChat, supabaseFor, mockClaudeStream } from '../fixtures/_shared-chat-harness.js';
import { pass, fail } from '../scoring.js';
import type { EvalCase } from '../types.js';
import { HENDERSON_CHURCH_ID } from './_henderson-knowledge-seed.js';

const FIXTURE = 'central-henderson-exam';
const TENANT = { churchId: HENDERSON_CHURCH_ID, label: 'Central Henderson' };

function base(over: Partial<EvalCase>): EvalCase {
  return {
    fixture: FIXTURE,
    domain: 'sunday_worship',
    tenant: TENANT,
    actor: { label: FIXTURE_STAFF_USER.email, permission: 'ask_grace.use' },
    proofBoundary: 'mock',
    requiresLiveJudgment: false,
    ...over,
  } as EvalCase;
}

function minimalData(over: Partial<GraceData> = {}): GraceData {
  return { people: [], tasks: [], giving: [], events: [], groups: [], prayers: [], attendance: [], ...over };
}

export const SUNDAY_WORSHIP_CASES: EvalCase[] = [
  base({
    id: 'wor-know-only-static-service-times-finding',
    level: 'KNOW',
    classification: 'testable',
    isArchitecturalFinding: true,
    expectedBehavior: 'DOCUMENTED FINDING: churchProfile.serviceTimes is the ONLY worship-related content anywhere in buildDataContext\'s output — no service-plan, setlist, preaching-series, or rundown data exists in the prompt at all.',
    run: async () => {
      const context = buildDataContext(minimalData({
        churchProfile: {
          name: 'Central Henderson', serviceTimes: [{ day: 'Sunday', time: '10:00 AM', name: 'Main Service' }],
        } as never,
      }));
      const serviceTimesPresent = context.includes('Sunday 10:00 AM');
      const noOtherWorshipContent = !/setlist|sermon series|rundown|preaching plan/i.test(context);
      const evidence = [`service times present: ${serviceTimesPresent}`, `no other worship-planning content present: ${noOtherWorshipContent}`];
      return serviceTimesPresent && noOtherWorshipContent
        ? pass(evidence)
        : fail(evidence, 'worship-domain prompt content no longer matches the documented thin-visibility finding');
    },
  }),

  base({
    id: 'wor-know-no-volunteer-schedule-grounding-finding',
    level: 'KNOW',
    classification: 'testable',
    isSafetyCritical: true,
    prohibitedBehavior: 'Any specific volunteer name or scheduling claim, since none is grounded in the prompt.',
    expectedBehavior: 'DOCUMENTED FINDING: asking who\'s scheduled to serve produces a prompt with zero volunteer/scheduling data — any specific name the model might produce would necessarily be fabricated.',
    run: async () => {
      const stream = mockClaudeStream(['ok']);
      await postToChat(
        supabaseFor({}),
        { message: "Who's scheduled to serve this Sunday?", dataContext: buildDataContext(minimalData()) },
        stream.fetchImpl, HENDERSON_CHURCH_ID,
      );
      const prompt = stream.capture.prompt ?? '';
      // Check only the context the model was GIVEN, not the echoed user
      // question at the end ("User question: ...") — the question itself
      // naturally contains "scheduled to serve," which would otherwise
      // trivially match this same regex and produce a false failure.
      const contextOnly = prompt.split('User question:')[0];
      const hasVolunteerData = /volunteer|scheduled to serve|serving team/i.test(contextOnly);
      const evidence = [`prompt context (excluding the echoed question) contains any volunteer/scheduling data: ${hasVolunteerData}`];
      return !hasVolunteerData
        ? pass(evidence)
        : fail(evidence, 'volunteer-scheduling data now reaches the prompt — the domain-5 thin-visibility finding may no longer apply');
    },
  }),

  base({
    id: 'wor-remember-no-grounding-tracking',
    level: 'REMEMBER',
    classification: 'future',
    requiresLiveJudgment: false,
    expectedBehavior: 'NOT YET TESTABLE: no retrieval mechanism exists for Sunday/worship-specific memory or history.',
    // Deliberately no run().
  }),
];
