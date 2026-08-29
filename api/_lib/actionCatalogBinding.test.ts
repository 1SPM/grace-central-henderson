/**
 * Binds the action catalog to everything that consumes it.
 *
 * This project's recurring failure mode is not a bad decision — it is a good
 * decision that stopped being true. The demo-mode P0 was a guarantee the
 * tech-debt ledger asserted while the code had quietly reopened it. A test
 * asserted a vulnerability as intended behaviour. The chat action list and
 * the chat prompt drifted apart because nothing held them together.
 *
 * So the catalog is only worth having if drift from it fails CI. Same
 * approach as agentRegistryBinding.test.ts: assert both directions, and
 * refuse to let anything be listed in one place and not the other.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ACTION_CATALOG,
  actionsForSurface,
  actionTypesForSurface,
  buildChatActionPrompt,
  findAction,
  type ActionDefinition,
} from './actionCatalog.js';
import { listExecutableActionTypes } from './agentActionExecutors.js';
import type { ActionType } from '../../src/lib/grace-actions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', '..', 'supabase', 'migrations');

/**
 * Compile-time mirror of the ActionType union in src/lib/grace-actions.ts.
 *
 * Typed as Record<ActionType, true>, so TypeScript fails the build if the
 * union gains a member missing here, or if a key here is not in the union.
 * The runtime assertion below then ties this to the catalog — giving a
 * two-way binding across a boundary a plain test could not reach.
 */
const UNION_MEMBERS: Record<ActionType, true> = {
  add_task: true,
  add_prayer: true,
  add_note: true,
  add_person: true,
  add_event: true,
  mark_task_done: true,
  update_task: true,
  update_person_status: true,
  mark_prayer_answered: true,
  delete_task: true,
  delete_person: true,
  delete_prayer: true,
  send_email: true,
  send_sms: true,
};

/**
 * Consequential actions that do NOT write an audit row today.
 *
 * This is a RECORD OF A GAP, not an approved design. Every entry is an
 * action a staff member can trigger through Ask GRACE that deletes church
 * data or sends a message out of the building, leaving nothing in
 * audit_logs — while the agent door cannot assign a Work Order owner
 * without a pastor's decision and an audit row in the same transaction.
 *
 * The list is pinned so it cannot grow by accident: a NEW destructive or
 * external action that skips auditing fails this test, and closing the gap
 * means deleting entries here deliberately. Tracked as TD-061.
 */
const KNOWN_UNAUDITED_CONSEQUENTIAL = [
  'delete_prayer',
  'delete_task',
  'send_email',
].sort();

const sorted = (xs: string[]) => [...xs].sort();

describe('action catalog — internal consistency', () => {
  it('has no duplicate action types', () => {
    const types = ACTION_CATALOG.map(a => a.type);
    expect(sorted(types)).toEqual(sorted([...new Set(types)]));
  });

  it('gives every action at least one surface', () => {
    const orphans = ACTION_CATALOG.filter(a => a.surfaces.length === 0);
    expect(orphans.map(a => a.type)).toEqual([]);
  });

  it('gives every chat action a prompt example, and no agent-only action one', () => {
    // A chat action with no example cannot be produced by the model — it
    // would be a capability that exists everywhere except where it is used.
    const chatMissingExample = actionsForSurface('chat')
      .filter(a => !a.promptExample).map(a => a.type);
    expect(chatMissingExample, 'chat actions must be shown to the model').toEqual([]);

    const agentOnlyWithExample = ACTION_CATALOG
      .filter(a => !a.surfaces.includes('chat') && a.promptExample).map(a => a.type);
    expect(agentOnlyWithExample, 'do not advertise actions chat cannot run').toEqual([]);
  });

  it('uses a real RBAC permission key for every action', () => {
    // Guards against an invented-but-plausible key like 'prayers.manage',
    // which would read as authorised and enforce nothing.
    const granted = new Set<string>();
    for (const file of readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      for (const m of sql.matchAll(/'([a-z_]+\.[a-z_]+)'/g)) granted.add(m[1]);
    }
    // Sanity-check the scan itself before trusting it to judge the catalog.
    expect(granted.has('approvals.decide'), 'permission scan found nothing').toBe(true);

    const invented = ACTION_CATALOG
      .filter(a => a.permission && !granted.has(a.permission))
      .map(a => `${a.type} -> ${a.permission}`);
    expect(invented).toEqual([]);
  });
});

describe('catalog <-> chat parser', () => {
  it('matches the ActionType union exactly, in both directions', () => {
    expect(sorted(actionTypesForSurface('chat'))).toEqual(sorted(Object.keys(UNION_MEMBERS)));
  });

  it('resolves every union member back to a catalog entry', () => {
    for (const type of Object.keys(UNION_MEMBERS)) {
      expect(findAction(type), `${type} missing from catalog`).toBeDefined();
    }
  });
});

describe('catalog <-> server executors', () => {
  it('lists every executable action type', () => {
    const orphanExecutors = listExecutableActionTypes().filter(t => !findAction(t));
    expect(orphanExecutors, 'executor exists for an action not in the catalog').toEqual([]);
  });

  it('backs every agent-surface action with an executor', () => {
    // The agent door refuses to propose what it cannot perform; an agent
    // action with no executor would put an un-actionable item in a
    // pastor's Decision Queue where "approve" silently does nothing.
    const executors = new Set(listExecutableActionTypes());
    const unbacked = actionsForSurface('agent').filter(a => !executors.has(a.type));
    expect(unbacked.map(a => a.type)).toEqual([]);
  });
});

describe('catalog <-> chat prompt', () => {
  it('shows the model every chat action and nothing else', () => {
    const prompt = buildChatActionPrompt();
    for (const action of actionsForSurface('chat')) {
      expect(prompt, `${action.type} missing from prompt`).toContain(`"type":"${action.type}"`);
    }
    const advertised = [...prompt.matchAll(/"type":"([a-z_]+)"/g)].map(m => m[1]);
    expect(sorted([...new Set(advertised)])).toEqual(sorted(actionTypesForSurface('chat')));
  });
});

describe('governance', () => {
  it('backs every action that requires approval with an executor', () => {
    // This test used to assert the opposite: that no chat action could claim
    // requiresApproval, because chat had no approval lifecycle to keep the
    // promise. Building that lifecycle (api/actions/propose + migration 071)
    // is what inverted it — which is exactly why it was written as a pin
    // rather than left implicit.
    //
    // The invariant now is that a gated action must be RUNNABLE once
    // approved. Without an executor, the proposal would reach a pastor,
    // they would approve it, and nothing would happen.
    const executors = new Set(listExecutableActionTypes());
    const unrunnable = ACTION_CATALOG
      .filter(a => a.requiresApproval && !executors.has(a.type))
      .map(a => a.type);
    expect(unrunnable,
      'approving this would silently do nothing').toEqual([]);
  });

  it('audits everything it gates', () => {
    // A human decision that leaves no record is the worst of both worlds:
    // the friction of an approval with none of the accountability.
    const gatedButUnaudited = ACTION_CATALOG
      .filter(a => a.requiresApproval && !a.audited).map(a => a.type);
    expect(gatedButUnaudited).toEqual([]);
  });

  it('pins exactly which consequential actions are still unaudited', () => {
    const unaudited = ACTION_CATALOG
      .filter(a => a.consequence !== 'low' && !a.audited)
      .map(a => a.type);
    expect(sorted(unaudited),
      'a destructive or external action changed its audit status — if this is the '
      + 'fix, remove it from KNOWN_UNAUDITED_CONSEQUENTIAL; if it is new, it needs '
      + 'auditing before it ships').toEqual(KNOWN_UNAUDITED_CONSEQUENTIAL);
  });

  it('marks nothing irreversible as low consequence', () => {
    const understated = ACTION_CATALOG
      .filter((a: ActionDefinition) => !a.reversible && a.consequence === 'low')
      .map(a => a.type);
    expect(understated, 'an action that cannot be undone is not low-consequence').toEqual([]);
  });
});
