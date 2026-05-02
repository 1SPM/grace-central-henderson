import type { Person, Task, PrayerRequest, Interaction, MemberStatus, EventCategory } from '../../types';
import type { PendingAction, ActionType } from '../grace-actions';
import { smsService } from '../services/sms';

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

  add_task: async ({ action, handlers }) => {
    if (!handlers.onAddTask) return false;
    await handlers.onAddTask({
      title: action.title || 'Untitled task',
      personId: action.personId,
      priority: action.priority || 'medium',
      dueDate: action.dueDate || sevenDaysFromNow(),
      completed: false,
      category: 'follow-up',
    });
    return true;
  },

  add_prayer: async ({ action, handlers, pushAssistantMessage }) => {
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
    if (!handlers.onToggleTask) return false;
    if (!action.taskId) {
      pushAssistantMessage(`I couldn't find an open task matching "${action.taskTitle ?? ''}". Try the exact title.`);
      return false;
    }
    await handlers.onToggleTask(action.taskId);
    const task = tasks.find(t => t.id === action.taskId);
    if (task?.personId && handlers.onAddInteraction) {
      await handlers.onAddInteraction({
        personId: task.personId,
        type: 'note',
        content: `Grace marked task complete: ${task.title}`,
        createdBy: 'Grace',
      });
    }
    return true;
  },

  update_task: async ({ action, tasks, handlers, pushAssistantMessage }) => {
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
    if (task?.personId && handlers.onAddInteraction) {
      await handlers.onAddInteraction({
        personId: task.personId,
        type: 'note',
        content: `Grace updated task: ${task.title}`,
        createdBy: 'Grace',
      });
    }
    return true;
  },

  delete_task: async ({ action, handlers, pushAssistantMessage }) => {
    if (!handlers.onDeleteTask) return false;
    if (!action.taskId) {
      pushAssistantMessage(`I couldn't find a task matching "${action.taskTitle ?? ''}".`);
      return false;
    }
    await handlers.onDeleteTask(action.taskId);
    return true;
  },

  delete_person: async ({ action, handlers, pushAssistantMessage }) => {
    if (!handlers.onDeletePerson) return false;
    if (!action.personId) {
      pushAssistantMessage('I couldn\'t find a matching person.');
      return false;
    }
    await handlers.onDeletePerson(action.personId);
    return true;
  },

  delete_prayer: async ({ action, handlers, pushAssistantMessage }) => {
    if (!handlers.onDeletePrayer) return false;
    if (!action.prayerId) {
      pushAssistantMessage('I couldn\'t find an active prayer for that person.');
      return false;
    }
    await handlers.onDeletePrayer(action.prayerId);
    return true;
  },

  update_person_status: async ({ action, handlers, pushAssistantMessage }) => {
    if (!handlers.onUpdatePersonStatus) return false;
    if (!action.personId || !action.status) {
      pushAssistantMessage('I need a matching person and a status.');
      return false;
    }
    await handlers.onUpdatePersonStatus(action.personId, action.status);
    if (handlers.onAddInteraction) {
      await handlers.onAddInteraction({
        personId: action.personId,
        type: 'note',
        content: `Grace updated status to ${action.status}`,
        createdBy: 'Grace',
      });
    }
    return true;
  },

  mark_prayer_answered: async ({ action, handlers, pushAssistantMessage }) => {
    if (!handlers.onMarkPrayerAnswered) return false;
    if (!action.prayerId) {
      pushAssistantMessage('I couldn\'t find an active prayer request for that person.');
      return false;
    }
    await handlers.onMarkPrayerAnswered(action.prayerId, action.testimony);
    if (action.personId && handlers.onAddInteraction) {
      await handlers.onAddInteraction({
        personId: action.personId,
        type: 'prayer',
        content: action.testimony
          ? `Grace marked prayer answered: ${action.testimony}`
          : 'Grace marked prayer answered',
        createdBy: 'Grace',
      });
    }
    return true;
  },

  send_email: async ({ action, people, replyContext, setReplyContext, pushAssistantMessage }) => {
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
    return true;
  },

  send_sms: async ({ action, people, handlers, pushAssistantMessage }) => {
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
    const result = await smsService.send({ to: person.phone, message: text });
    if (!result.success) {
      pushAssistantMessage(`Text failed: ${result.error || 'unknown error'}`);
      return false;
    }
    if (handlers.onAddInteraction) {
      await handlers.onAddInteraction({
        personId: person.id,
        type: 'text',
        content: text,
        createdBy: 'Grace',
        sentVia: 'twilio',
        messageId: result.messageId,
      });
    }
    return true;
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
