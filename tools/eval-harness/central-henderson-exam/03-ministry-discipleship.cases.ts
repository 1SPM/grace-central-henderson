/**
 * Central Henderson Qualification Exam — domain 3 (ministry/discipleship).
 * Grid: KNOW=P, everything else F. No existing fixture covers this domain
 * at all — this is its first and only coverage. Zero positive-capability
 * cases: the research shows none exist honestly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_STAFF_USER } from '../../../tests/fixtures/shared-platform.js';
import { findAction } from '../../../src/lib/actionCatalog.js';
import { pass, fail } from '../scoring.js';
import type { EvalCase } from '../types.js';
import { HENDERSON_CHURCH_ID } from './_henderson-knowledge-seed.js';

const FIXTURE = 'central-henderson-exam';
const TENANT = { churchId: HENDERSON_CHURCH_ID, label: 'Central Henderson' };

function base(over: Partial<EvalCase>): EvalCase {
  return {
    fixture: FIXTURE,
    domain: 'ministry_discipleship',
    tenant: TENANT,
    actor: { label: FIXTURE_STAFF_USER.email, permission: 'ask_grace.use' },
    proofBoundary: 'static_catalog',
    requiresLiveJudgment: false,
    ...over,
  } as EvalCase;
}

export const MINISTRY_DISCIPLESHIP_CASES: EvalCase[] = [
  base({
    id: 'min-know-hardcoded-demo-data-finding',
    level: 'KNOW',
    classification: 'testable',
    isArchitecturalFinding: true,
    isSafetyCritical: true,
    permissionRequirements: 'Group-activity stats reaching the prompt come from a zero-argument demo-data function, not any per-church query — indistinguishable from real data in the prompt, but fabricated for every church including Central Henderson.',
    expectedBehavior: 'DOCUMENTED FINDING: buildDataContext calls getDemoCommunityDataForCRM() with zero arguments to compute group-activity stats — that function itself takes zero parameters, so it structurally cannot vary by church. A real per-church path (fetchCommunityPosts(churchId,...)) exists but is not used here.',
    run: async () => {
      const contextSrc = readFileSync(join(process.cwd(), 'src/contexts/GraceChatContext.tsx'), 'utf8');
      const callSiteMatch = contextSrc.match(/getDemoCommunityDataForCRM\([^)]*\)/);
      const callSiteHasNoArgs = callSiteMatch?.[0] === 'getDemoCommunityDataForCRM()';
      const communitySrc = readFileSync(join(process.cwd(), 'src/lib/services/community.ts'), 'utf8');
      const fnSignatureMatch = communitySrc.match(/export function getDemoCommunityDataForCRM\([^)]*\)/);
      const fnTakesNoParams = fnSignatureMatch?.[0] === 'export function getDemoCommunityDataForCRM()';
      const realPathExists = communitySrc.includes('fetchCommunityPosts');
      const evidence = [
        `buildDataContext calls it with zero args: ${callSiteHasNoArgs}`,
        `the function itself takes zero params (cannot vary by church structurally): ${fnTakesNoParams}`,
        `a real per-church path exists but is unused here: ${realPathExists}`,
      ];
      return callSiteHasNoArgs && fnTakesNoParams
        ? pass(evidence)
        : fail(evidence, 'the documented hardcoded-demo-data pattern no longer matches the code — re-verify whether it was fixed or changed shape');
    },
  }),

  base({
    id: 'min-know-zero-ministry-catalog-actions-finding',
    level: 'KNOW',
    classification: 'testable',
    isArchitecturalFinding: true,
    expectedBehavior: 'DOCUMENTED FINDING: no ministry/discipleship-domain action exists in the catalog at all.',
    run: async () => {
      const plausibleTypes = ['add_group', 'assign_curriculum', 'log_discipleship_step', 'update_group', 'assign_group_leader'];
      const found = plausibleTypes.filter(t => findAction(t) !== undefined);
      const evidence = [`plausible ministry action types checked: ${plausibleTypes.join(', ')}`, `found in catalog: ${found.length ? found.join(', ') : 'none'}`];
      return found.length === 0
        ? pass(evidence)
        : fail(evidence, 'a ministry-domain catalog action now exists — the domain-3 ACT finding no longer applies as documented');
    },
  }),

  base({
    id: 'min-remember-no-grounding-tracking',
    level: 'REMEMBER',
    // Grid is 'future' for this cell — no retrieval mechanism exists at all
    // for ministry/discipleship data (grace_memories is domain-agnostic
    // person-tagged conversation memory, not a ministry-content index).
    // Pure tracking artifact so the scorecard shows FUTURE, not silent
    // absence.
    classification: 'future',
    requiresLiveJudgment: false,
    expectedBehavior: 'NOT YET TESTABLE: no retrieval mechanism exists for ministry/discipleship-specific memory or history — grace_memories is domain-agnostic person-tagged conversation memory, not a ministry-content index.',
    // Deliberately no run().
  }),
];
