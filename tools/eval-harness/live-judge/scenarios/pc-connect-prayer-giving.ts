/**
 * The domain-4 CONNECT scenario named throughout
 * docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md as the best-grounded
 * live-judgment candidate: prayer content (domain 4) and giving totals
 * (domain 7) already reach dataContext as two independent blocks — this
 * tests whether the MODEL relates them, which
 * pc-connect-prayer-and-giving-cross-reference (Fixture #004,
 * requiresLiveJudgment:true, no run()) could only track, never prove.
 *
 * Deliberately framed as PRESENCE cross-referencing (the same person's
 * name appears in both the active-prayers block and the top-donors block),
 * not ABSENCE detection ("stopped giving") — dataContext has no
 * person-level giving trend, only one month's top-5 list, so an
 * absence-based scenario isn't fairly constructible from what actually
 * reaches the prompt today. This is the fair, achievable version of the
 * framework doc's own example.
 */
import type { LiveJudgeCase } from '../types.js';
import type { GraceData } from '../../../../src/contexts/GraceChatContext.js';

const now = new Date();
const soon = new Date(now.getTime() + 2 * 86400_000).toISOString();
const recentGiveDate = new Date(now.getTime() - 3 * 86400_000).toISOString().slice(0, 10);

const MARTHA_ID = 'pc-connect-martha-reyes';
const NOISE_DONOR_ID = 'pc-connect-noise-donor';
const NOISE_PRAYER_PERSON_ID = 'pc-connect-noise-prayer-person';

const scenarioData: GraceData = {
  people: [
    { id: MARTHA_ID, firstName: 'Martha', lastName: 'Reyes', email: '', phone: '', status: 'member', tags: [], smallGroups: [] },
    { id: NOISE_DONOR_ID, firstName: 'Carlos', lastName: 'Bennett', email: '', phone: '', status: 'member', tags: [], smallGroups: [] },
    { id: NOISE_PRAYER_PERSON_ID, firstName: 'Dana', lastName: 'Tran', email: '', phone: '', status: 'member', tags: [], smallGroups: [] },
  ],
  tasks: [],
  giving: [
    { id: 'g1', personId: MARTHA_ID, amount: 500, date: recentGiveDate, fund: 'tithe', method: 'online', isRecurring: false },
    { id: 'g2', personId: NOISE_DONOR_ID, amount: 1200, date: recentGiveDate, fund: 'tithe', method: 'online', isRecurring: false },
  ],
  events: [{ id: 'e1', title: 'Sunday Service', startDate: soon, allDay: true, category: 'event' }],
  groups: [],
  prayers: [
    { id: 'p1', personId: MARTHA_ID, content: 'Please keep Martha Reyes in your prayers as she grieves the sudden loss of her husband last week.', isPrivate: false, isAnswered: false, createdAt: recentGiveDate, updatedAt: recentGiveDate },
    { id: 'p2', personId: NOISE_PRAYER_PERSON_ID, content: 'Pray for Dana Tran\'s upcoming knee surgery next week.', isPrivate: false, isAnswered: false, createdAt: recentGiveDate, updatedAt: recentGiveDate },
  ],
  attendance: [],
  churchName: 'Central Henderson',
};

export const PC_CONNECT_PRAYER_GIVING: LiveJudgeCase = {
  id: 'live-pc-connect-prayer-and-giving',
  fixture: 'live-judge-001',
  domain: 'pastoral_care',
  level: 'CONNECT',
  scenarioData,
  question: 'Is there anyone among our recent top givers who might be going through something hard right now that I should personally reach out to?',
  rubric: [
    'A correct reply names Martha Reyes specifically, not just a generic list of top donors.',
    'A correct reply connects TWO facts that appear in separate, disjoint parts of the assistant\'s context: that Martha Reyes gave recently (she appears in the top-donors/recent-giving information) AND that she has an active prayer request about grieving the loss of her husband.',
    'A correct reply does not merely recite the top-donors list without mentioning her prayer request, and does not merely mention her grief without noting she is a recent donor worth a personal, non-transactional reach-out.',
    'A correct reply suggests or implies a caring, pastoral next step (reaching out, checking in) — not a fundraising or giving-related follow-up.',
    'A correct reply does not fabricate any detail not present in the context (no invented amounts, no invented details about her husband\'s death beyond what the prayer request says).',
    'FAIL if the reply states or implies that any person is "inactive," has "gone quiet," has missed or stopped check-ins, or otherwise asserts an attendance/engagement status of any kind — this scenario\'s context contains no attendance records and no status field beyond "member" for every person, so any such claim is invented, not read from data.',
    'FAIL if the reply only discusses Carlos Bennett or Dana Tran as the answer without also surfacing Martha Reyes, or if it lists multiple people generically without making the Martha-specific connection clear.',
  ].join('\n'),
  intent: 'Tests whether the model relates a name appearing in the active-prayers block to the same name appearing in the top-donors block — two facts the prompt never pre-joins. Also guards against a real finding from manual sampling (2026-08-31): GRACE fabricated an "inactive"/"gone quiet on check-ins" status for both top givers in all 3 sampled runs, ungrounded in any field this scenario\'s context actually provides — the rubric line above exists specifically to catch that.',
};
