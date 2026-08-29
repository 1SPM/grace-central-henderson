/**
 * The action catalog — GRACE's single vocabulary of things that can be done.
 *
 * WHY THIS EXISTS
 *
 * GRACE had two action registries that did not know about each other, with
 * opposite governance:
 *
 *   - the CHAT door: 14 action types defined in a *prompt string* inside
 *     GraceChatContext.tsx, parsed by src/lib/grace-actions.ts, executed
 *     through React callbacks in src/lib/grace-chat/handlers.ts. No
 *     server-side permission check, no approval, no audit row.
 *   - the AGENT door: one action type in agentActionExecutors.ts, with
 *     preconditions, a required human approval, and (since migration 070)
 *     an audit row committed in the same transaction as the mutation.
 *
 * So a staff member could have GRACE delete a person or send an SMS with one
 * click and no audit trail, while assigning a Work Order owner needed a
 * pastor's decision. Same product, opposite rules — because the two lists
 * were maintained in different places by different people at different times.
 *
 * This file is the union of both, defined once. Every surface — the chat
 * assistant, the agents, and any future command palette — reads its
 * vocabulary from here rather than declaring its own.
 *
 * THE FIELDS DESCRIBE WHAT IS TRUE, NOT WHAT WE WANT
 *
 * `audited` and `requiresApproval` record today's behaviour. Most chat
 * actions are honestly marked `audited: false`, because they are. Writing
 * `true` here to express an intention would turn the one place that is
 * supposed to be authoritative into the least trustworthy file in the repo.
 * actionCatalogBinding.test.ts pins the resulting gap so it cannot widen
 * silently, and closing it means editing both the code and that list.
 */

/** Verb grouping — also how the chat prompt and a palette present actions. */
export type ActionGroup = 'create' | 'update' | 'delete' | 'send';

/** Which door exposes this action. An action may be reachable from several. */
export type ActionSurface = 'chat' | 'agent';

/**
 * How much a mistake costs.
 *
 * - `low`        — routine record-keeping; wrong entries are editable.
 * - `destructive` — removes data. Reversal means re-entry from memory.
 * - `external`   — leaves the building. Cannot be recalled at any price;
 *                  a wrong SMS to a grieving family is not an "oops".
 */
export type ActionConsequence = 'low' | 'destructive' | 'external';

export interface ActionDefinition {
  /** Wire identifier. Must match the chat parser and any server executor. */
  type: string;
  /** Human label — for a palette, a decision queue, an audit reader. */
  label: string;
  group: ActionGroup;
  surfaces: readonly ActionSurface[];
  consequence: ActionConsequence;
  /** RBAC key (migration 032 vocabulary), or null where none is enforced. */
  permission: string | null;
  /** Does a human have to decide before this runs? Today, not aspirationally. */
  requiresApproval: boolean;
  /** Does executing this write an audit_logs row? Today, not aspirationally. */
  audited: boolean;
  /** Can the change be undone from within the product? */
  reversible: boolean;
  /**
   * The example emitted into the chat system prompt. Required for any action
   * on the `chat` surface — the model cannot produce a shape it was never
   * shown. Omitted for agent-only actions, which are never advertised to it.
   */
  promptExample?: string;
}

/** Heading text per group in the chat prompt, carrying the model's guardrails. */
const GROUP_HEADINGS: Record<ActionGroup, string> = {
  create: 'Create:',
  update: 'Update:',
  delete: 'Delete (destructive — only when user clearly asks to remove/delete):',
  send: 'Send (only when user explicitly says email/text/send/message — NOT for "follow up", which is add_task):',
};

const GROUP_ORDER: readonly ActionGroup[] = ['create', 'update', 'delete', 'send'];

export const ACTION_CATALOG: readonly ActionDefinition[] = [
  // ---- create ----------------------------------------------------------
  {
    type: 'add_person', label: 'Add person', group: 'create', surfaces: ['chat'],
    consequence: 'low', permission: 'people.manage',
    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"add_person","firstName":"X","lastName":"Y","status":"visitor"}',
  },
  {
    type: 'add_task', label: 'Add task', group: 'create', surfaces: ['chat'],
    consequence: 'low', permission: 'tasks.manage',
    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"add_task","title":"X","personName":"optional","priority":"medium","dueDate":"YYYY-MM-DD"}',
  },
  {
    type: 'add_prayer', label: 'Add prayer request', group: 'create', surfaces: ['chat'],
    consequence: 'low', permission: 'care.manage',    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"add_prayer","content":"X","personName":"existing"}',
  },
  {
    type: 'add_note', label: 'Add note', group: 'create', surfaces: ['chat'],
    consequence: 'low', permission: 'people.manage',
    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"add_note","content":"X","personName":"existing"}',
  },
  {
    type: 'add_event', label: 'Add event', group: 'create', surfaces: ['chat'],
    consequence: 'low', permission: 'events.manage',
    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"add_event","title":"X","startDate":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","location":"optional","category":"event"}',
  },

  // ---- update ----------------------------------------------------------
  {
    type: 'mark_task_done', label: 'Mark task done', group: 'update', surfaces: ['chat'],
    consequence: 'low', permission: 'tasks.manage',
    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"mark_task_done","taskTitle":"X","personName":"optional"}',
  },
  {
    type: 'update_task', label: 'Update task', group: 'update', surfaces: ['chat'],
    consequence: 'low', permission: 'tasks.manage',
    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"update_task","taskTitle":"existing","title":"new title","priority":"low|medium|high","dueDate":"YYYY-MM-DD"}',
  },
  {
    type: 'update_person_status', label: 'Update person status', group: 'update', surfaces: ['chat'],
    consequence: 'low', permission: 'people.manage',
    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"update_person_status","personName":"existing","status":"member"}',
  },
  {
    type: 'mark_prayer_answered', label: 'Mark prayer answered', group: 'update', surfaces: ['chat'],
    consequence: 'low', permission: 'care.manage',
    requiresApproval: false, audited: false, reversible: true,
    promptExample: '{"type":"mark_prayer_answered","personName":"existing","testimony":"optional"}',
  },
  {
    // The agent door. Proposed by Verity, decided by a human holding
    // approvals.decide, executed atomically with its audit row by
    // migration 070. Never advertised to the chat model — hence no
    // promptExample — because chat has no approval lifecycle to put it in.
    type: 'assign_work_order_owner', label: 'Assign Work Order owner',
    group: 'update', surfaces: ['agent'],
    consequence: 'low', permission: 'work_orders.manage',
    requiresApproval: true, audited: true, reversible: true,
  },

  // ---- delete ----------------------------------------------------------
  {
    type: 'delete_task', label: 'Delete task', group: 'delete', surfaces: ['chat'],
    consequence: 'destructive', permission: 'tasks.manage',
    requiresApproval: false, audited: false, reversible: false,
    promptExample: '{"type":"delete_task","taskTitle":"existing"}',
  },
  {
    type: 'delete_person', label: 'Delete person', group: 'delete', surfaces: ['chat'],
    consequence: 'destructive', permission: 'people.manage',
    requiresApproval: false, audited: false, reversible: false,
    promptExample: '{"type":"delete_person","personName":"existing"}',
  },
  {
    type: 'delete_prayer', label: 'Delete prayer request', group: 'delete', surfaces: ['chat'],
    consequence: 'destructive', permission: 'care.manage',
    requiresApproval: false, audited: false, reversible: false,
    promptExample: '{"type":"delete_prayer","personName":"existing"}',
  },

  // ---- send ------------------------------------------------------------
  {
    type: 'send_email', label: 'Send email', group: 'send', surfaces: ['chat'],
    consequence: 'external', permission: 'communications.send',
    requiresApproval: false, audited: false, reversible: false,
    promptExample: '{"type":"send_email","personName":"existing","subject":"X","body":"plain-text body, can be multi-line"}',
  },
  {
    type: 'send_sms', label: 'Send SMS', group: 'send', surfaces: ['chat'],
    consequence: 'external', permission: 'communications.send',
    requiresApproval: false, audited: false, reversible: false,
    promptExample: '{"type":"send_sms","personName":"existing","message":"short text under 1000 chars"}',
  },
];

/** Every action reachable from a given door. */
export function actionsForSurface(surface: ActionSurface): ActionDefinition[] {
  return ACTION_CATALOG.filter(a => a.surfaces.includes(surface));
}

/** Just the type strings for a door — the shape a parser or union needs. */
export function actionTypesForSurface(surface: ActionSurface): string[] {
  return actionsForSurface(surface).map(a => a.type);
}

export function findAction(type: string): ActionDefinition | undefined {
  return ACTION_CATALOG.find(a => a.type === type);
}

/**
 * The `<action>` catalogue block for the chat system prompt, generated.
 *
 * Previously this was ~20 hand-maintained lines inside a template literal.
 * A prompt string is the worst available home for a security-relevant list
 * of capabilities: nothing typechecks it, nothing tests it, and it drifts
 * from the parser and the executors silently. Generating it means the model
 * is shown exactly the actions the system actually implements — no more
 * (inviting output nothing can execute) and no fewer (quietly dropping a
 * capability the parser still accepts).
 */
export function buildChatActionPrompt(): string {
  const chatActions = actionsForSurface('chat');
  const sections = GROUP_ORDER
    .map(group => {
      const inGroup = chatActions.filter(a => a.group === group && a.promptExample);
      if (inGroup.length === 0) return null;
      const lines = inGroup.map(a => `<action>${a.promptExample}</action>`);
      return `${GROUP_HEADINGS[group]}\n${lines.join('\n')}`;
    })
    .filter((s): s is string => s !== null);

  return sections.join('\n\n');
}
