/**
 * Central Henderson Qualification Exam — domain 4 (pastoral care).
 * Grid: KNOW=T REMEMBER=T CONNECT=P INTERPRET=F RECOMMEND=T ACT=T ANTICIPATE=F.
 *
 * Fixture #004 already covers TD-066/RECOMMEND/ACT/chat-door for this
 * domain — these four cases add net-new angles: proof that the real
 * prayer_requests RLS policy text exists (separate from whether Postgres
 * actually enforces it — that's a live_db-only claim), a date/staleness
 * gap finding, and a memory-attribution case.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_STAFF_USER } from '../../../tests/fixtures/shared-platform.js';
import { buildDataContext, type GraceData } from '../../../src/contexts/GraceChatContext.js';
import { pass, fail } from '../scoring.js';
import type { EvalCase } from '../types.js';
import { HENDERSON_CHURCH_ID } from './_henderson-knowledge-seed.js';

const FIXTURE = 'central-henderson-exam';
const TENANT = { churchId: HENDERSON_CHURCH_ID, label: 'Central Henderson' };

function base(over: Partial<EvalCase>): EvalCase {
  return {
    fixture: FIXTURE,
    domain: 'pastoral_care',
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

export const PASTORAL_CARE_CASES: EvalCase[] = [
  base({
    id: 'pc-know-prayer-visibility-policies-exist-as-documented',
    level: 'KNOW',
    classification: 'testable',
    proofBoundary: 'static_catalog',
    provenanceExpectations: 'prayer_requests has real, permission-gated RLS — the policy TEXT is deterministically provable; whether Postgres actually enforces it is a separate, live_db-only claim (see the next case).',
    expectedBehavior: 'Migration 043 defines the five documented prayer-visibility SELECT policies, including the care.view-gated private_pastoral_care policy.',
    run: async () => {
      const migrationSrc = readFileSync(join(process.cwd(), 'supabase/migrations/043_care_prayer_community_safety.sql'), 'utf8');
      const checks = [
        ['own-record policy', migrationSrc.includes('prayer_requests read own')],
        ['church-wall policy', migrationSrc.includes('prayer_requests read church wall')],
        ['selected-group policy', migrationSrc.includes('prayer_requests read selected group')],
        ['pastoral-care policy gated on care.view', migrationSrc.includes('prayer_requests read pastoral care') && migrationSrc.includes("'care.view'")],
        ['specific-care-team policy gated on care.manage', migrationSrc.includes('prayer_requests read specific care team') && migrationSrc.includes("'care.manage'")],
      ] as const;
      const evidence = checks.map(([label, ok]) => `${ok ? 'OK' : 'MISSING'}: ${label}`);
      return checks.every(([, ok]) => ok)
        ? pass(evidence)
        : fail(evidence, 'the documented prayer-visibility policy set no longer matches migration 043');
    },
  }),

  base({
    id: 'pc-know-prayer-visibility-enforcement-live-db-boundary',
    level: 'KNOW',
    classification: 'partial',
    proofBoundary: 'live_db',
    requiresLiveJudgment: false,
    sourceScope: 'Whether Postgres actually blocks an unauthorized read of a private_pastoral_care prayer — real enforcement, not policy text.',
    expectedBehavior: 'NOT YET TESTABLE FROM THIS HARNESS: tests/fixtures/mockSupabase.ts resolves every .eq()/filter as a no-op, so it cannot prove RLS enforcement — only that the policy text exists (previous case) or that the app-layer permission check runs (Fixture #002\'s mock-based cases). Real proof of enforcement lives in tools/rls-read-restriction-smoke.test.ts (the rls-policy-tests CI job), a separate live-DB-gated suite, not this harness.',
    // Deliberately no run() — this case exists to keep the enforcement
    // claim visibly separate from the policy-exists claim above, per
    // requirement 6's "never mark PROVEN from the mock what needs real RLS."
  }),

  base({
    id: 'pc-know-active-prayers-lack-date-context-finding',
    level: 'KNOW',
    classification: 'testable',
    isArchitecturalFinding: true,
    proofBoundary: 'mock',
    permissionRequirements: 'The "Active prayers" line has no per-item date/age signal — a recent and a stale prayer are indistinguishable to the model from content alone.',
    expectedBehavior: 'DOCUMENTED FINDING: buildDataContext includes both a recent and a very old unanswered prayer\'s content with no date/age marker — the model has no structural way to know which is stale.',
    run: async () => {
      const recent = { id: 'p1', personId: 'x', content: 'Please pray for my job interview this week', isPrivate: false, isAnswered: false, createdAt: '2026-08-30T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z' };
      const stale = { id: 'p2', personId: 'x', content: 'Please pray for my grandmother\'s recovery', isPrivate: false, isAnswered: false, createdAt: '2026-01-15T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' };
      const context = buildDataContext(minimalData({ prayers: [recent, stale] }));
      const bothPresent = context.includes('job interview') && context.includes('grandmother');
      const dateSignalPresent = /2026-01-15|Jan(uary)? 15|7 months|months ago/.test(context);
      const evidence = [`both prayer contents present: ${bothPresent}`, `a date/age signal distinguishes them: ${dateSignalPresent}`];
      return bothPresent && !dateSignalPresent
        ? pass(evidence)
        : fail(evidence, 'the documented lack-of-date-signal finding no longer matches the code — re-verify whether date context was added');
    },
  }),

  base({
    id: 'pc-remember-care-memory-attribution-preserved',
    level: 'REMEMBER',
    classification: 'testable',
    isSafetyCritical: true,
    prohibitedBehavior: 'An AI-extracted note about a care situation being rendered as if it were a live prayer/care record.',
    expectedBehavior: 'An ai_extracted memory about a care situation renders as "noted from chat" (not "you said"), and is never formatted to look like a live prayers/care table row.',
    run: async () => {
      // Unit-level: exercise buildMemoryBlock directly (grace-memory.ts),
      // the same technique Fixture #001's contextual-use case uses for
      // buildKnowledgeBlock — no full route needed for this property.
      const { buildMemoryBlock } = await import('../../../api/_lib/grace-memory.js');
      const block = buildMemoryBlock([{
        id: 'mem-care', content: 'Following up on the Reyes family after the loss', source: 'ai_extracted',
        person_ids: [], created_at: '2026-08-20T00:00:00.000Z',
      }]);
      const attributedCorrectly = block.includes('noted from chat') && !block.includes('you said');
      const notFormattedAsRecord = !/prayer_id|prayers\.|care_requests\./.test(block);
      const evidence = [`attributed as "noted from chat": ${attributedCorrectly}`, `not formatted as a raw DB record: ${notFormattedAsRecord}`];
      return attributedCorrectly && notFormattedAsRecord
        ? pass(evidence)
        : fail(evidence, 'ai_extracted memory attribution did not render as expected');
    },
  }),
];
