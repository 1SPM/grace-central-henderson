/**
 * Fixture #003 — people/households (domain 2), KNOW/REMEMBER/RECOMMEND/ACT
 * only, per the framework doc's recommended sequence (CONNECT/INTERPRET/
 * ANTICIPATE explicitly out of scope for this fixture).
 *
 * Two real architectural findings surfaced while grounding this fixture,
 * both represented as isArchitecturalFinding cases below rather than
 * silently worked around:
 *
 * 1. KNOW-level "dataContext" (church profile / status counts / inactivity
 *    / birthdays) is CLIENT-composed (src/contexts/GraceChatContext.tsx's
 *    buildDataContext) and not exported — unlike Fixture #001/#002's
 *    server-composed prompt blocks, this harness cannot render the full
 *    React provider tree to verify buildDataContext's exact string output
 *    without new, disproportionate test infrastructure. What IS
 *    deterministically provable without touching production code is that
 *    the data actually reaches the provider (src/App.tsx's wiring) — this
 *    fixture proves that narrower claim honestly, and does not claim more.
 * 2. ACT-level: of the four people-domain catalog actions, only
 *    delete_person is reachable via the server execute/propose pipeline
 *    (already exercised by Fixture #002). add_person, add_note, and
 *    update_person_status run entirely through a CLIENT-side "chat door"
 *    (src/lib/grace-chat/handlers.ts's runActionHandler) that calls an
 *    injected UI callback directly — no fetch, no server-side permission
 *    check against the catalog's stated people.manage key, no approval,
 *    no audit_logs row at the point of dispatch. This matches
 *    actionCatalog.ts's own TD-061 framing (that gap is exactly why the
 *    execute/propose pipeline was built) — it's pre-existing, documented
 *    tech debt, not a new secret hole, but it is real and worth stating
 *    plainly rather than assuming server-side protection exists.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../../tests/fixtures/shared-platform.js';
import { findAction } from '../../../src/lib/actionCatalog.js';
import { mockClaudeStream, postToChat, supabaseFor } from './_shared-chat-harness.js';
import { pass, fail } from '../scoring.js';
import type { EvalCase } from '../types.js';

const FIXTURE = 'fixture-003-people-households';
const TENANT = { churchId: FIXTURE_CHURCH_ID, label: 'Central Henderson' };
const BILL_ID = '00000000-0000-4000-8000-0000000000f1';

function base(over: Partial<EvalCase>): EvalCase {
  return {
    fixture: FIXTURE,
    domain: 'people_households',
    tenant: TENANT,
    actor: { label: FIXTURE_STAFF_USER.email, permission: 'ask_grace.use' },
    proofBoundary: 'mock',
    requiresLiveJudgment: false,
    ...over,
  } as EvalCase;
}

export const FIXTURE_003_CASES: EvalCase[] = [
  base({
    id: 'ph-know-datacontext-wiring',
    level: 'KNOW',
    classification: 'testable',
    proofBoundary: 'static_catalog',
    sourceScope: 'Confirms the data pipeline that KNOW-level people/household facts depend on — does NOT independently verify buildDataContext\'s exact output string, since that function (src/contexts/GraceChatContext.tsx) is not exported.',
    expectedBehavior: 'src/App.tsx wires people/tasks/prayers/attendance into GraceChatProvider (via the shared graceChatProps object spread into both the desktop and GRACE Mobile mounts), so KNOW-level facts about them have a real data path into the chat prompt.',
    run: async () => {
      const appSource = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
      // Both provider mounts spread one shared props object; the wiring
      // proof is that object's literal plus the spread reaching the provider.
      const propsBlockMatch = appSource.match(/const graceChatProps = \{[\s\S]*?\n {2}\};/);
      const providerBlock = propsBlockMatch?.[0] ?? '';
      const requiredProps = ['people,', 'tasks,', 'prayers,', 'attendance:'];
      const missing = requiredProps.filter(p => !providerBlock.includes(p));
      if (!appSource.includes('<GraceChatProvider {...graceChatProps}>')) {
        missing.push('<GraceChatProvider {...graceChatProps}>');
      }
      const evidence = requiredProps.map(p => `${providerBlock.includes(p) ? 'OK' : 'MISSING'}: ${p}`);
      evidence.push('NOTE: this proves the wiring exists, not the exact composed prompt string — buildDataContext is not exported and unverifiable at this harness\'s current proof boundary without rendering the full provider tree.');
      return missing.length === 0
        ? pass(evidence)
        : fail(evidence, `GraceChatProvider wiring missing expected prop(s): ${missing.join('; ')}`);
    },
  }),

  base({
    id: 'ph-remember-person-tagged-memory',
    level: 'REMEMBER',
    classification: 'testable',
    requiredSources: ['grace_memories (person_ids match via resolvePersonIds name-matching)'],
    expectedBehavior: 'A person-tagged memory surfaces when the question names that person, and is absent for an unrelated query — same mechanism api/grace/_chat.test.ts\'s "automatic retrieval" acceptance test proves, re-expressed here as a second REMEMBER-level data point outside church-identity data.',
    run: async () => {
      const memory = {
        id: 'mem-bill', content: 'Bill prefers Saturday morning meetings', source: 'user_stated',
        person_ids: [BILL_ID], status: 'active', expires_at: null, created_at: '2026-08-29T00:00:00.000Z',
      };
      const people = [{ id: BILL_ID, first_name: 'Bill', last_name: 'Johnson' }];

      const streamAbout = mockClaudeStream(['ok']);
      await postToChat(supabaseFor({ existingMemories: [memory], people }), { message: 'tell me about Bill Johnson', dataContext: '' }, streamAbout.fetchImpl, FIXTURE_CHURCH_ID);
      const surfaced = (streamAbout.capture.prompt ?? '').includes('Bill prefers Saturday morning meetings');

      const streamUnrelated = mockClaudeStream(['ok']);
      await postToChat(supabaseFor({ existingMemories: [], people }), { message: 'what events are coming up this week', dataContext: '' }, streamUnrelated.fetchImpl, FIXTURE_CHURCH_ID);
      const absentWhenUnrelated = !(streamUnrelated.capture.prompt ?? '').includes('Bill prefers Saturday morning meetings');

      const evidence = [`surfaces on person-naming query: ${surfaced}`, `absent on unrelated query: ${absentWhenUnrelated}`];
      return surfaced && absentWhenUnrelated
        ? pass(evidence)
        : fail(evidence, 'person-tagged memory retrieval did not behave as expected');
    },
  }),

  base({
    id: 'ph-recommend-catalog-shape',
    level: 'RECOMMEND',
    classification: 'testable',
    proofBoundary: 'static_catalog',
    actionExpectations: 'add_person/add_note/update_person_status/delete_person all carry people.manage; only delete_person requires approval.',
    expectedBehavior: 'The catalog/routing infrastructure a people-domain recommendation would target actually exists and is shaped correctly (the mechanical half of RECOMMEND — not whether a model reasons its way there).',
    run: async () => {
      const evidence: string[] = [];
      let ok = true;
      for (const type of ['add_person', 'add_note', 'update_person_status', 'delete_person']) {
        const def = findAction(type);
        const good = def?.permission === 'people.manage';
        evidence.push(`${type}: permission=${def?.permission} ${good ? 'OK' : 'WRONG'}`);
        if (!good) ok = false;
      }
      const approvalShape = findAction('delete_person')?.requiresApproval === true
        && findAction('add_person')?.requiresApproval === false
        && findAction('add_note')?.requiresApproval === false
        && findAction('update_person_status')?.requiresApproval === false;
      evidence.push(`approval shape correct (only delete_person gated): ${approvalShape}`);
      return ok && approvalShape ? pass(evidence) : fail(evidence, 'people-domain catalog shape check failed');
    },
  }),

  base({
    id: 'ph-act-chat-door-bypasses-server-pipeline',
    level: 'ACT',
    classification: 'testable',
    proofBoundary: 'static_catalog',
    isArchitecturalFinding: true,
    permissionRequirements: 'None enforced at this layer — no catalog permission check, no approval, no audit_logs row.',
    prohibitedBehavior: 'N/A — this case documents a known, pre-existing gap (actionCatalog.ts\'s own TD-061 framing), not a live exploit.',
    expectedBehavior: 'DOCUMENTED FINDING: add_person, add_note, and update_person_status run via src/lib/grace-chat/handlers.ts\'s client-side runActionHandler, calling an injected UI callback directly with no server request — unlike delete_person (gated, already proven server-routed by Fixture #002). Grading this PASS means "the documented gap is still accurately documented," never "domain 2 ACT is more proven."',
    run: async () => {
      const { runActionHandler } = await import('../../../src/lib/grace-chat/handlers.js');
      const fetchSpy = vi.fn();
      const originalFetch = global.fetch;
      global.fetch = fetchSpy as unknown as typeof fetch;

      const onAddPerson = vi.fn().mockResolvedValue(undefined);
      const ctx = {
        action: { type: 'add_person' as const, firstName: 'Casey', lastName: 'Newcomer', status: 'visitor' as const },
        people: [], tasks: [], prayers: [],
        handlers: { onAddPerson },
        replyContext: null,
        setReplyContext: vi.fn(),
        pushAssistantMessage: vi.fn(),
      };

      let ran: boolean;
      let evidence: string[];
      try {
        ran = await runActionHandler(ctx);
        evidence = [
          `handler ran: ${ran}`,
          `onAddPerson called directly: ${onAddPerson.mock.calls.length === 1}`,
          `no fetch/network call made: ${fetchSpy.mock.calls.length === 0}`,
        ];
      } finally {
        global.fetch = originalFetch;
      }

      const confirmed = ran! && onAddPerson.mock.calls.length === 1 && fetchSpy.mock.calls.length === 0;
      return confirmed
        ? pass(evidence!)
        : fail(evidence!, 'add_person no longer matches the documented client-only dispatch — re-verify whether this was fixed or changed shape');
    },
  }),
];
