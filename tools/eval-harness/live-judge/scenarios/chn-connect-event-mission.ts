/**
 * Fixture #009 — the third live-judgment scenario, domain 1 (church
 * identity)'s CONNECT cell. The one remaining live-judgment-eligible gap
 * among the six "ready" domains (1, 2, 4, 6, 8, 10) — pastoral_care's
 * CONNECT is covered (scenario 1), governance's INTERPRET is covered
 * (scenario 2, Fixture #008); domain 1's CONNECT/INTERPRET are both bare
 * 'P' in the doc with no concrete scenario, and CONNECT is the safer
 * pick — an INTERPRET scenario here risks brushing the four-part
 * strategy's own "never a behavioral score" guardrail (AI_BOUNDARIES).
 *
 * Reuses the real Central Henderson mission-row content from Fixture
 * #001's HENDERSON_KNOWLEDGE_ROWS verbatim (not invented church facts) —
 * the two disjoint facts being cross-referenced are the church's
 * knowledge-block mission statement (grace_knowledge, server-composed)
 * and a specific upcoming event (dataContext, client-composed) — never
 * pre-joined anywhere in the schema or prompt assembly.
 */
import type { LiveJudgeCase } from '../types.js';
import type { GraceData } from '../../../../src/contexts/GraceChatContext.js';

const now = new Date();
const soon = new Date(now.getTime() + 3 * 86400_000).toISOString();

// Same mission row Fixture #001 seeds (api/grace/_chat.central-henderson-fixture.test.ts /
// fixture-001-central-henderson.cases.ts) — kept verbatim for consistency
// across fixtures, not re-authored church-identity content.
export const MISSION_KNOWLEDGE_ROW = {
  id: 'k-mission', category: 'mission', title: 'Mission',
  content: 'We exist to introduce people to Jesus and help them follow Him.',
  source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10).',
};

const scenarioData: GraceData = {
  people: [],
  tasks: [],
  giving: [],
  events: [
    { id: 'chn-connect-fall-festival', title: 'Fall Festival — Neighborhood Outreach', startDate: soon, allDay: true, category: 'event', description: 'Open house for the surrounding neighborhood, first-time-guest focused.' },
  ],
  groups: [],
  prayers: [],
  attendance: [],
  churchName: 'Central Henderson',
};

export const CHN_CONNECT_EVENT_MISSION: LiveJudgeCase = {
  id: 'live-chn-connect-event-mission',
  fixture: 'live-judge-003',
  domain: 'church_identity',
  level: 'CONNECT',
  scenarioData,
  knowledgeRows: [MISSION_KNOWLEDGE_ROW],
  question: 'How does our upcoming Fall Festival connect to our mission?',
  rubric: [
    'The mission statement ("We exist to introduce people to Jesus and help them follow Him") and the Fall Festival event live in two independent, never-pre-joined parts of the assistant\'s context.',
    'A correct reply references BOTH: the actual substance of the mission (introducing people to Jesus / helping them follow Him — paraphrase is fine, invented wording is not) AND the specific Fall Festival event, explaining a plausible, coherent connection between the two (e.g. it\'s a natural entry point for first-time guests, an "invite a friend" moment).',
    'FAIL if the reply only recites the mission statement without mentioning the Fall Festival, or only describes the Fall Festival logistically without connecting it to the mission/purpose language.',
    'A correct reply does not fabricate mission content not present in the context, and does not invent Fall Festival details (attendance targets, budget, past-year results) not present in the context.',
    'A correct reply does not turn the four-part strategy (attend/invite/next-step/give) into a behavioral score or checklist for any individual — it should stay about the event and the mission, not about grading a person.',
  ].join('\n'),
  intent: 'Tests whether the model relates the server-composed knowledge block (mission) to a client-composed dataContext fact (a specific event) that the schema never pre-joins — the domain-1 analogue of scenario 1\'s prayer+giving cross-reference.',
};
