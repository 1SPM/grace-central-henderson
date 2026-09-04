import type { Person, Task, PrayerRequest, Interaction, MemberStatus, EventCategory } from '../../types';
import type { PendingAction, ActionType } from '../grace-actions';

export interface ReplyContext {
  inbox_message_row_id: string;
  source_inbox_id: string;
  source_message_id: string;
  person_id: string | null;
  sender_label: string;
}

export interface ChatHandlers {
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void | Promise<void>;
  onAddPrayer?: (prayer: { personId: string; content: string; isPrivate: boolean }) => void | Promise<void>;
  onAddInteraction?: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => void | Promise<void>;
  onAddPerson?: (person: Omit<Person, 'id'>) => void | Promise<void>;
  onAddEvent?: (event: {
    title: string;
    description?: string;
    startDate: string;
    endDate?: string;
    allDay: boolean;
    location?: string;
    category: EventCategory;
  }) => void | Promise<unknown>;
  onToggleTask?: (taskId: string) => void | Promise<unknown>;
  onUpdateTask?: (taskId: string, updates: { title?: string; due_date?: string; priority?: 'low' | 'medium' | 'high' }) => void | Promise<unknown>;
  onDeleteTask?: (taskId: string) => void | Promise<unknown>;
  onDeletePerson?: (personId: string) => void | Promise<unknown>;
  onDeletePrayer?: (prayerId: string) => void | Promise<unknown>;
  onUpdatePersonStatus?: (personId: string, status: MemberStatus) => void | Promise<unknown>;
  onMarkPrayerAnswered?: (prayerId: string, testimony?: string) => void | Promise<unknown>;
}

export interface HandlerContext {
  action: PendingAction;
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  handlers: ChatHandlers;
  replyContext: ReplyContext | null;
  setReplyContext: (ctx: ReplyContext | null) => void;
  /** Push an assistant message into the chat — used for validation errors and send failures. */
  pushAssistantMessage: (content: string) => void;
}

/** Returns true if the action ran (so the caller marks it executed). */
export type ActionHandler = (ctx: HandlerContext) => Promise<boolean>;

const sevenDaysFromNow = () => new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0];

/**
 * ADR-018 action-resolution safety closure: fail closed on ambiguity,
 * before ANY other check — including approval routing. hydrateAction
 * (grace-actions.ts) never resolves personId/taskId/prayerId to an
 * arbitrary first match when personAmbiguous/taskAmbiguous/prayerAmbiguous
 * is set; this is the explicit, user-visible half of that guarantee. Every
 * handler that uses a resolved person/task/prayer calls this FIRST, so a
 * destructive action can never proceed — let alone reach proposeForApproval
 * — while its target identity is unresolved. Prayer content is
 * deliberately never echoed back here (item 8: never expose protected
 * information merely to disambiguate).
 */
function blockOnAmbiguity(action: PendingAction, pushAssistantMessage: (content: string) => void): boolean {
  if (action.personAmbiguous) {
    const list = action.personCandidates?.length ? ` I found: ${action.personCandidates.join(', ')}.` : '';
    pushAssistantMessage(`More than one person matches "${action.personName ?? ''}".${list} Which one do you mean?`);
    return true;
  }
  if (action.taskAmbiguous) {
    const list = action.taskCandidates?.length ? ` I found: ${action.taskCandidates.join(', ')}.` : '';
    pushAssistantMessage(`More than one open task matches "${action.taskTitle ?? ''}".${list} Which one do you mean?`);
    return true;
  }
  if (action.prayerAmbiguous) {
    pushAssistantMessage('More than one active prayer request matches that. Can you be more specific about who it\'s for?');
    return true;
  }
  return false;
}

/** Audit trail — logs an Interaction attributed to Grace on the affected person. No-op without a personId. */
async function logGraceAction(
  handlers: ChatHandlers,
  personId: string | null | undefined,
  type: Interaction['type'],
  content: string,
): Promise<void> {
  if (!personId || !handlers.onAddInteraction) return;
  await handlers.onAddInteraction({ personId, type, content, createdBy: 'Grace' });
}


/**
 * Run an immediate (ungated) action on the server so it produces an audit row.
 *
 * The mutation deliberately does NOT happen in the browser any more. A client
 * that deletes a row itself and then reports it for auditing is not audited:
 * the report can be skipped, altered, or lost when the tab closes, and
 * nothing downstream can tell the difference.
 *
 * Returns false on any failure so the chat card does not show as executed.
 */
async function executeServerSide(args: {
  actionType: string;
  targetEntityId: string;
  pushAssistantMessage: (content: string) => void;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: args.actionType, target_entity_id: args.targetEntityId }),
    });
    const data = await res.json().catch(() => ({} as { reason?: string; error?: string; audit_incomplete?: boolean }));
    if (!res.ok) {
      args.pushAssistantMessage(
        res.status === 403
          ? "You don't have permission to do that."
          : `That didn't go through: ${data.reason ?? data.error ?? `HTTP ${res.status}`}`
      );
      return false;
    }
    if (data.audit_incomplete) {
      // The change happened but the trail did not. The person who asked for
      // it is the one who needs to know, immediately.
      args.pushAssistantMessage(
        'Done — but its audit entry could not be written. It has been flagged; tell an administrator.'
      );
    }
    return true;
  } catch (err) {
    args.pushAssistantMessage(
      `I couldn't reach the server: ${err instanceof Error ? err.message : 'unknown error'}`
    );
    return false;
  }
}

/**
 * Send a gated action to the approvals queue instead of doing it.
 *
 * The chat door has no authority of its own here: the server re-checks the
 * caller's permission from the catalog, records the request in audit_logs,
 * and the action runs only when someone holding approvals.decide says so.
 *
 * Returns false on failure so the chat card does NOT show as executed — the
 * single worst outcome would be telling a pastor the text went out when it
 * did not, or that a deletion happened when it is still pending.
 */
async function proposeForApproval(args: {
  actionType: string;
  targetEntityId: string;
  payload: Record<string, unknown>;
  pushAssistantMessage: (content: string) => void;
  pendingMessage: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/actions/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: args.actionType,
        target_entity_id: args.targetEntityId,
        payload: args.payload,
      }),
    });
    const data = await res.json().catch(() => ({} as { error?: string; status?: string }));
    if (!res.ok) {
      args.pushAssistantMessage(
        res.status === 403
          ? "You don't have permission to request that."
          : `I couldn't send that for approval: ${data.error ?? `HTTP ${res.status}`}`
      );
      return false;
    }
    args.pushAssistantMessage(
      data.status === 'already_pending'
        ? 'That one is already waiting in the Decision Queue.'
        : args.pendingMessage
    );
    // True means "the request was handled", not "the change happened" — the
    // message above is explicit about which, so the card cannot read as done.
    return true;
  } catch (err) {
    args.pushAssistantMessage(
      `I couldn't reach the approvals service: ${err instanceof Error ? err.message : 'unknown error'}`
    );
    return false;
  }
}

const handlers: Record<ActionType, ActionHandler> = {
  add_person: async ({ action, handlers, pushAssistantMessage }) => {
    if (!action.firstName?.trim()) {
      pushAssistantMessage('A new person needs a first name.');
      return false;
    }
    if (!handlers.onAddPerson) return false;
    await handlers.onAddPerson({
      firstName: action.firstName.trim(),
      lastName: action.lastName?.trim() || '',
      email: action.email?.trim() || '',
      phone: action.phone?.trim() || '',
      status: action.status || 'visitor',
      tags: [],
      smallGroups: [],
    });
    return true;
  },

  add_task: async ({ action, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!action.title?.trim()) {
      pushAssistantMessage('A task needs a title.');
      return false;
    }
    if (!handlers.onAddTask) return false;
    const title = action.title.trim();
    await handlers.onAddTask({
      title,
      personId: action.personId,
      priority: action.priority || 'medium',
      dueDate: action.dueDate || sevenDaysFromNow(),
      completed: false,
      category: 'follow-up',
    });
    await logGraceAction(handlers, action.personId, 'note', `Grace added task: ${title}`);
    return true;
  },

  add_prayer: async ({ action, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!handlers.onAddPrayer) return false;
    if (!action.personId) {
      pushAssistantMessage('A prayer request needs a matching person.');
      return false;
    }
    await handlers.onAddPrayer({
      personId: action.personId,
      content: action.content || '',
      isPrivate: false,
    });
    await logGraceAction(handlers, action.personId, 'note', 'Grace logged a prayer request');
    return true;
  },

  add_event: async ({ action, handlers, pushAssistantMessage }) => {
    if (!handlers.onAddEvent) return false;
    if (!action.title?.trim() || !action.startDate) {
      pushAssistantMessage('An event needs a title and a date.');
      return false;
    }
    const allDay = action.allDay ?? !action.startTime;
    const startISO = allDay
      ? action.startDate
      : `${action.startDate}T${action.startTime ?? '09:00'}`;
    const endISO = !allDay && action.endTime
      ? `${action.startDate}T${action.endTime}`
      : undefined;
    await handlers.onAddEvent({
      title: action.title.trim(),
      startDate: startISO,
      endDate: endISO,
      allDay,
      location: action.location?.trim() || undefined,
      category: action.category || 'event',
    });
    return true;
  },

  add_note: async ({ action, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!handlers.onAddInteraction) return false;
    if (!action.personId) {
      pushAssistantMessage('A note needs a matching person.');
      return false;
    }
    await handlers.onAddInteraction({
      personId: action.personId,
      type: 'note',
      content: action.content || '',
      createdBy: 'Grace',
    });
    return true;
  },

  mark_task_done: async ({ action, tasks, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!handlers.onToggleTask) return false;
    if (!action.taskId) {
      pushAssistantMessage(`I couldn't find an open task matching "${action.taskTitle ?? ''}". Try the exact title.`);
      return false;
    }
    await handlers.onToggleTask(action.taskId);
    const task = tasks.find(t => t.id === action.taskId);
    await logGraceAction(handlers, task?.personId, 'note', `Grace marked task complete: ${task?.title ?? ''}`);
    return true;
  },

  update_task: async ({ action, tasks, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!handlers.onUpdateTask) return false;
    if (!action.taskId) {
      pushAssistantMessage(`I couldn't find an open task matching "${action.taskTitle ?? ''}".`);
      return false;
    }
    const updates: { title?: string; due_date?: string; priority?: 'low' | 'medium' | 'high' } = {};
    if (action.title?.trim()) updates.title = action.title.trim();
    if (action.dueDate) updates.due_date = action.dueDate;
    if (action.priority) updates.priority = action.priority;
    if (Object.keys(updates).length === 0) return false;
    await handlers.onUpdateTask(action.taskId, updates);
    const task = tasks.find(t => t.id === action.taskId);
    await logGraceAction(handlers, task?.personId, 'note', `Grace updated task: ${task?.title ?? ''}`);
    return true;
  },

  // Still one click — but the delete now happens server-side so it lands in
  // audit_logs. The Interaction note below is kept: it is what a pastor
  // actually reads on the person, and the audit row answers a different
  // question (who did this, when) for a different reader.
  delete_task: async ({ action, tasks, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!action.taskId) {
      pushAssistantMessage(`I couldn't find a task matching "${action.taskTitle ?? ''}".`);
      return false;
    }
    const task = tasks.find(t => t.id === action.taskId);
    const ran = await executeServerSide({
      actionType: 'delete_task',
      targetEntityId: action.taskId,
      pushAssistantMessage,
    });
    if (!ran) return false;
    await logGraceAction(handlers, task?.personId, 'note', `Grace deleted task: ${task?.title ?? ''}`);
    return true;
  },

  // GATED (TD-061). Deleting a person is irreversible, takes their whole
  // pastoral history with it, and used to leave no record anywhere — the
  // Interaction note the other actions write would attach to the very person
  // being removed. It now goes to a human holding approvals.decide.
  delete_person: async ({ action, people, pushAssistantMessage }) => {
    // Ambiguity is checked BEFORE anything else, including approval
    // routing below — an ambiguous target must never reach the Decision
    // Queue at all, let alone be approved on the strength of "approval
    // will catch it." Approval status is irrelevant until identity is
    // uniquely resolved.
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!action.personId) {
      pushAssistantMessage('I couldn\'t find a matching person.');
      return false;
    }
    const person = people.find(p => p.id === action.personId);
    return proposeForApproval({
      actionType: 'delete_person',
      targetEntityId: action.personId,
      payload: { person_name: person ? `${person.firstName} ${person.lastName}`.trim() : undefined },
      pushAssistantMessage,
      pendingMessage: person
        ? `Deleting ${person.firstName} ${person.lastName} needs approval. I've sent it to the Decision Queue.`
        : 'That deletion needs approval. I\'ve sent it to the Decision Queue.',
    });
  },

  delete_prayer: async ({ action, prayers, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!action.prayerId) {
      pushAssistantMessage('I couldn\'t find an active prayer for that person.');
      return false;
    }
    const prayer = prayers.find(p => p.id === action.prayerId);
    const ran = await executeServerSide({
      actionType: 'delete_prayer',
      targetEntityId: action.prayerId,
      pushAssistantMessage,
    });
    if (!ran) return false;
    await logGraceAction(handlers, prayer?.personId, 'note', 'Grace deleted a prayer request');
    return true;
  },

  update_person_status: async ({ action, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!handlers.onUpdatePersonStatus) return false;
    if (!action.personId || !action.status) {
      pushAssistantMessage('I need a matching person and a status.');
      return false;
    }
    await handlers.onUpdatePersonStatus(action.personId, action.status);
    await logGraceAction(handlers, action.personId, 'note', `Grace updated status to ${action.status}`);
    return true;
  },

  mark_prayer_answered: async ({ action, handlers, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    if (!handlers.onMarkPrayerAnswered) return false;
    if (!action.prayerId) {
      pushAssistantMessage('I couldn\'t find an active prayer request for that person.');
      return false;
    }
    await handlers.onMarkPrayerAnswered(action.prayerId, action.testimony);
    await logGraceAction(
      handlers,
      action.personId,
      'prayer',
      action.testimony ? `Grace marked prayer answered: ${action.testimony}` : 'Grace marked prayer answered',
    );
    return true;
  },

  send_email: async ({ action, people, handlers, replyContext, setReplyContext, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    const bodyText = action.body?.trim() || '';
    if (!bodyText) {
      pushAssistantMessage('Email body is empty.');
      return false;
    }

    // Reply context = pastor opened an inbox row in Grace; thread back through AgentMail
    if (replyContext) {
      const res = await fetch('/api/agentmail/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inbox_id: replyContext.source_inbox_id,
          message_id: replyContext.source_message_id,
          inbox_message_row_id: replyContext.inbox_message_row_id,
          text: bodyText,
        }),
      });
      const replyData = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        pushAssistantMessage(`Reply failed: ${replyData.error || `(${res.status})`}`);
        return false;
      }
      await logGraceAction(handlers, replyContext.person_id, 'email', 'Grace replied via email');
      setReplyContext(null);
      return true;
    }

    // Fresh outbound — recipient must be a known Person
    const person = people.find(p => p.id === action.personId);
    if (!person) {
      pushAssistantMessage('I need a matching person to send to.');
      return false;
    }
    if (!person.email) {
      pushAssistantMessage(`${person.firstName} ${person.lastName} doesn't have an email on file.`);
      return false;
    }
    const subject = action.subject?.trim() || '(no subject)';
    const res = await fetch('/api/agentmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person_id: person.id, subject, text: bodyText }),
    });
    const sendData = await res.json().catch(() => ({} as { error?: string }));
    if (!res.ok) {
      pushAssistantMessage(`Email failed: ${sendData.error || `(${res.status})`}`);
      return false;
    }
    await logGraceAction(handlers, person.id, 'email', `Grace sent email: ${subject}`);
    return true;
  },

  send_sms: async ({ action, people, pushAssistantMessage }) => {
    if (blockOnAmbiguity(action, pushAssistantMessage)) return false;
    const person = people.find(p => p.id === action.personId);
    if (!person) {
      pushAssistantMessage('I need a matching person to text.');
      return false;
    }
    if (!person.phone) {
      pushAssistantMessage(`${person.firstName} ${person.lastName} doesn't have a phone on file.`);
      return false;
    }
    const text = action.message?.trim() || '';
    if (!text) {
      pushAssistantMessage('Text message is empty.');
      return false;
    }
    // GATED (TD-061). A text leaves the building and cannot be recalled, so
    // it waits for a human decision. The message body travels in the payload
    // and is sent by the executor after approval — not from here.
    return proposeForApproval({
      actionType: 'send_sms',
      targetEntityId: person.id,
      payload: { message: text, person_name: `${person.firstName} ${person.lastName}`.trim() },
      pushAssistantMessage,
      pendingMessage: `That text to ${person.firstName} needs approval. I've sent it to the Decision Queue.`,
    });
  },
};

/**
 * Looks up the action's handler and runs it. Returns true if the action ran
 * to completion (so the caller marks it executed in chat state). Returns
 * false on any validation failure or unknown type — the handler will have
 * pushed an explanatory assistant message in that case.
 */
export async function runActionHandler(ctx: HandlerContext): Promise<boolean> {
  const handler = handlers[ctx.action.type];
  if (!handler) {
    console.warn('[grace-handlers] no handler for action type', ctx.action.type);
    return false;
  }
  return handler(ctx);
}
