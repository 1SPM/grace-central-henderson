import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { Person, Task, Giving, CalendarEvent, SmallGroup, PrayerRequest, Attendance, Interaction, MemberStatus } from '../types';
import { generateAIText, generateAIStreamed } from '../lib/services/ai';
import { parseActions, hydrateAction, isTaskBatchFollowUp, buildTaskCompletionActions, type PendingAction } from '../lib/grace-actions';

export type { PendingAction } from '../lib/grace-actions';

export interface ActionInstance {
  id: string;
  action: PendingAction;
  executed?: boolean;
  dismissed?: boolean;
}

export interface GraceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionInstance[];
}

export interface GraceData {
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  attendance: Attendance[];
  churchName?: string;
}

export interface GraceHandlers {
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void | Promise<void>;
  onAddPrayer?: (prayer: { personId: string; content: string; isPrivate: boolean }) => void | Promise<void>;
  onAddInteraction?: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => void | Promise<void>;
  onAddPerson?: (person: Omit<Person, 'id'>) => void | Promise<void>;
  onToggleTask?: (taskId: string) => void | Promise<unknown>;
  onUpdatePersonStatus?: (personId: string, status: MemberStatus) => void | Promise<unknown>;
  onMarkPrayerAnswered?: (prayerId: string, testimony?: string) => void | Promise<unknown>;
}

interface GraceChatContextValue {
  messages: GraceMessage[];
  loading: boolean;
  panelOpen: boolean;
  openPanel: (seed?: string) => void;
  closePanel: () => void;
  sendMessage: (query: string) => Promise<void>;
  clearMessages: () => void;
  updateAction: (messageId: string, actionId: string, patch: Partial<PendingAction>) => void;
  executeAction: (messageId: string, actionId: string) => Promise<void>;
  dismissAction: (messageId: string, actionId: string) => void;
  people: Person[];
  suggestions: string[];
}

const GRACE_GREETING: GraceMessage = {
  id: 'greet',
  role: 'assistant',
  content: 'Hi — ask me anything about your church data, or ask me to add, update, or complete CRM work. I’ll make editable action cards before anything is saved.',
};

const GraceChatContext = createContext<GraceChatContextValue | null>(null);

function buildDataContext(data: GraceData): string {
  const { people, tasks, giving, events, groups, prayers, attendance, churchName } = data;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const recentGiving = giving.filter(g => new Date(g.date) >= thirtyDaysAgo);
  const totalsByPerson = new Map<string, number>();
  for (const g of recentGiving) {
    if (g.personId) totalsByPerson.set(g.personId, (totalsByPerson.get(g.personId) ?? 0) + g.amount);
  }
  const topDonors = [...totalsByPerson.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pid, amt]) => {
      const p = people.find(x => x.id === pid);
      return p ? `${p.firstName} ${p.lastName}: $${amt.toLocaleString()}` : null;
    })
    .filter(Boolean);

  const attendedRecently = new Set(
    attendance.filter(a => new Date(a.date) >= thirtyDaysAgo).map(a => a.personId)
  );
  const inactivePeople = people
    .filter(p => p.status === 'member' || p.status === 'regular')
    .filter(p => !attendedRecently.has(p.id))
    .slice(0, 15)
    .map(p => `${p.firstName} ${p.lastName}`);

  const upcomingEvents = events
    .filter(e => new Date(e.startDate) >= now && new Date(e.startDate) <= sevenDaysFromNow)
    .slice(0, 10)
    .map(e => `${e.title} — ${new Date(e.startDate).toLocaleDateString()}`);

  const upcomingBirthdays = people
    .filter(p => {
      if (!p.birthDate) return false;
      const bd = new Date(p.birthDate);
      const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      return thisYear >= now && thisYear <= sevenDaysFromNow;
    })
    .map(p => `${p.firstName} ${p.lastName} (${new Date(p.birthDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`);

  const openTasks = tasks.filter(t => !t.completed).slice(0, 15);
  const activePrayers = prayers.filter(p => !p.isAnswered).slice(0, 10);

  return `
You are Grace AI, an assistant built into a church CRM. You help church staff and leaders get things done. Answer questions about the church data below. Be concise and use bullet lists for multiple items.

TONE:
You're warm, plainspoken, and quietly reverent — you work inside a church and you honor that context. Don't be robotic. Don't say things like "I am an AI assistant and do not have feelings" as a deflection.

When someone asks you a faith or theological question (e.g. "how do you feel about Jesus", "what do you think of prayer", "is God real"):
- Be honest that you're an AI and don't hold personal beliefs, but do it warmly and briefly — not as a shield.
- Honor the church's faith: Jesus is the center of this community's mission, and that's not up for debate from your side.
- Offer something useful next. ("Want me to pull up the upcoming sermons?" / "I can show you active prayer requests.")
- Never lecture or evangelize. Never argue theology. Never pretend to have faith.

Good example: "I'm an AI, so I can't feel the way a person does — but I know Jesus is the heart of everything this church does. Want me to show you the upcoming sermons or active prayer requests?"
Bad example: "I am an AI assistant and do not have feelings."

TONE VARIETY — match the moment, don't sound like a script:
Don't end every response with "Want me to show you X?" That tic gets old fast. Offer a follow-up only when it actually helps. Short answers can just end.

Match register to context:
- Celebratory (giving milestone, prayer answered, baptism): "That's $12,400 in March — best month this year. Want to send a thank-you note to the top three?"
- Soft (grief, illness, crisis): "I'm sorry — that's hard. Sue's been on the prayer list since the 18th. I can mark a follow-up task if it'd help."
- Efficient (routine confirmation, lookups): "Done — task added for Tuesday." or "Three: Sarah, Marcus, Aiden."
- Warm (faith / pastoral): see the Good example above.
- Practical (data with numbers): lead with the number. "47 members. 12 haven't checked in this month — here are the names."
- Quiet (no-data, all-clear): "Nothing flagged today. Good day to call someone."

Never moralize. Never preach. Never repeat the user's question back at them. Don't pad with "Great question!" or "I'd be happy to help!"

WRITE-ACTIONS — BE DECISIVE:
When the user asks you to add a person, task, prayer, note, or to complete/update existing CRM work, ALWAYS respond with one <action> block per item. Do not ask for optional fields like email or phone — they're optional and the user can fill them in the confirm card. Your job is to propose safe, editable actions; the user reviews and confirms before anything is saved.

If the user says "do tasks", "do them", "ok do them", "handle these", "complete these", or similar after you have listed open tasks, do NOT just list the tasks again. Convert the visible/open tasks into editable action cards using mark_task_done actions. If there are more than 10, create actions for the 10 most urgent/recently shown and say you prepared the first 10 for review. Never claim tasks are completed until the user clicks Execute or Execute all.

There are no separate "sections" for leaders, volunteers, etc. — everyone is a person with a status (visitor/regular/member/leader/inactive). "Add X to the leader section" means add_person with status: leader. "Add X as a volunteer" means add_person with status: member (volunteers are just people).

If the user gives you a name, propose the action immediately even with only first name. Guess reasonable defaults. Never say "I need more info" for email/phone/lastName — those are optional.

Person format:
<action>{"type":"add_person","firstName":"...","lastName":"...","status":"visitor"}</action>
Status must be one of: visitor, regular, member, leader, inactive. Infer from context ("add X as a leader" → leader, "new visitor X" → visitor). Default to "visitor" if unspecified.

Task format:
<action>{"type":"add_task","title":"...","personName":"optional existing name","priority":"medium","dueDate":"YYYY-MM-DD"}</action>

Prayer request format:
<action>{"type":"add_prayer","content":"the request","personName":"existing person name"}</action>

Note format:
<action>{"type":"add_note","content":"the note","personName":"existing person name"}</action>

EDIT ACTIONS — you can also UPDATE existing records, not just create:

Mark task done format:
<action>{"type":"mark_task_done","taskTitle":"the task title or substring","personName":"optional"}</action>
Use when the user says "mark X done", "X is finished", "completed Y". Match against the open tasks listed below.

Update person status format:
<action>{"type":"update_person_status","personName":"existing name","status":"member"}</action>
Use when the user says "promote X to member", "make X a leader", "X is no longer attending". Status must be: visitor, regular, member, leader, or inactive.

Mark prayer answered format:
<action>{"type":"mark_prayer_answered","personName":"existing name","testimony":"optional testimony text","prayerContent":"optional content snippet to disambiguate"}</action>
Use when the user says "mark X's prayer answered", "praise — Y was healed", "her surgery went well". Testimony is the celebration text.

For multiple items in one request ("add X and Y" or "mark these three done"), emit multiple <action> blocks. For prayer/note/edit actions, the personName must match someone in the list below — if no match, ask once which person. For add_person and add_task, new names are always fine.

Church: ${churchName || 'Grace Community Church'}
Today: ${now.toLocaleDateString()}

People (${people.length} total):
- Visitors: ${people.filter(p => p.status === 'visitor').length}
- Regulars: ${people.filter(p => p.status === 'regular').length}
- Members: ${people.filter(p => p.status === 'member').length}

Giving — last 30 days:
- Total: $${recentGiving.reduce((s, g) => s + g.amount, 0).toLocaleString()}
- Gifts: ${recentGiving.length}
- Top donors: ${topDonors.length ? topDonors.join('; ') : 'none'}

Attendance — last 30 days: ${attendance.filter(a => new Date(a.date) >= thirtyDaysAgo).length} check-ins
Members/regulars with no recent attendance (${inactivePeople.length}): ${inactivePeople.slice(0, 8).join(', ')}${inactivePeople.length > 8 ? `, +${inactivePeople.length - 8} more` : ''}

Upcoming events (next 7 days, ${upcomingEvents.length}): ${upcomingEvents.join(' | ') || 'none scheduled'}

Upcoming birthdays (next 7 days, ${upcomingBirthdays.length}): ${upcomingBirthdays.join(', ') || 'none'}

Open tasks (${tasks.filter(t => !t.completed).length} total): ${openTasks.map(t => t.title).join('; ') || 'none'}

Groups (${groups.length} total): ${groups.map(g => `${g.name} (${g.members?.length ?? 0} members${g.isActive === false ? ', inactive' : ''})`).slice(0, 12).join(', ') || 'none'}

Active prayer requests (${prayers.filter(p => !p.isAnswered).length} total): ${activePrayers.map(p => p.content.slice(0, 60)).join(' | ') || 'none'}
`.trim();
}

function buildSuggestions(data: GraceData): string[] {
  const { people, tasks, events, prayers, giving, attendance } = data;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);

  const overdue = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;
  const newVisitors = people.filter(p => p.status === 'visitor' && p.firstVisit && new Date(p.firstVisit) >= sevenDaysAgo).length;
  const activePrayers = prayers.filter(p => !p.isAnswered).length;
  const birthdaysSoon = people.filter(p => {
    if (!p.birthDate) return false;
    const bd = new Date(p.birthDate);
    const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    return thisYear >= now && thisYear <= sevenDaysFromNow;
  }).length;
  const eventsSoon = events.filter(e => new Date(e.startDate) >= now && new Date(e.startDate) <= sevenDaysFromNow).length;
  const recentGiving = giving.filter(g => new Date(g.date) >= thirtyDaysAgo).length;
  const attendedRecently = new Set(
    attendance.filter(a => new Date(a.date) >= thirtyDaysAgo).map(a => a.personId),
  );
  const inactive = people.filter(p => (p.status === 'member' || p.status === 'regular') && !attendedRecently.has(p.id)).length;

  const candidates: Array<{ score: number; text: string }> = [];
  if (overdue > 0) candidates.push({ score: 100, text: `What tasks are overdue?` });
  if (newVisitors > 0) candidates.push({ score: 90, text: `Who visited this week?` });
  if (inactive > 0) candidates.push({ score: 80, text: `Who hasn't attended in 30 days?` });
  if (activePrayers > 0) candidates.push({ score: 70, text: `Show me active prayer requests` });
  if (birthdaysSoon > 0) candidates.push({ score: 60, text: `Whose birthday is this week?` });
  if (eventsSoon > 0) candidates.push({ score: 50, text: `What events are coming up?` });
  if (recentGiving > 0) candidates.push({ score: 40, text: `Who gave the most last month?` });

  // Always-available fallbacks so we always have at least 4
  candidates.push({ score: 10, text: `Add a new visitor` });
  candidates.push({ score: 5, text: `Remind me to follow up tomorrow` });

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(c => c.text);
}

interface GraceChatProviderProps extends GraceData, GraceHandlers {
  children: ReactNode;
}

export function GraceChatProvider({ children, onAddTask, onAddPrayer, onAddInteraction, onAddPerson, onToggleTask, onUpdatePersonStatus, onMarkPrayerAnswered, ...data }: GraceChatProviderProps) {
  const [messages, setMessages] = useState<GraceMessage[]>([GRACE_GREETING]);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Memoize context so we're not rebuilding this on every keystroke
  const dataContext = useMemo(() => buildDataContext(data), [
    data.people, data.tasks, data.giving, data.events,
    data.groups, data.prayers, data.attendance, data.churchName,
  ]);

  const suggestions = useMemo(() => buildSuggestions(data), [
    data.people, data.tasks, data.events, data.prayers, data.giving, data.attendance,
  ]);

  const openPanel = useCallback((seed?: string) => {
    setPanelOpen(true);
    if (seed && seed.trim()) {
      // Defer to next tick so panel renders before we send
      setTimeout(() => void sendMessage(seed), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const clearMessages = useCallback(() => {
    setMessages([GRACE_GREETING]);
  }, []);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;
    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now() + 1}`;
    setMessages(m => [
      ...m,
      { id: userMsgId, role: 'user', content: query },
      { id: assistantMsgId, role: 'assistant', content: '' },
    ]);
    setLoading(true);

    if (isTaskBatchFollowUp(query)) {
      const actions = buildTaskCompletionActions(data.tasks);
      const assistantUpdate: GraceMessage = actions.length > 0
        ? {
            id: assistantMsgId,
            role: 'assistant',
            content: actions.length === 10 && data.tasks.filter(t => !t.completed).length > 10
              ? 'I prepared the first 10 open tasks for review. Click Execute on each card when you’re ready.'
              : `I prepared ${actions.length} open ${actions.length === 1 ? 'task' : 'tasks'} for review. Click Execute on each card when you’re ready.`,
            actions: actions.map((action, i) => ({ id: `act-${Date.now()}-${i}`, action })),
          }
        : {
            id: assistantMsgId,
            role: 'assistant',
            content: 'There are no open tasks to complete right now.',
          };
      setMessages(m => m.map(msg => msg.id === assistantMsgId ? assistantUpdate : msg));
      setLoading(false);
      return;
    }

    const recentHistory = messages
      .filter(m => m.id !== 'greet' && m.content.trim())
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'User' : 'Grace'}: ${m.content}`)
      .join('\n');

    const prompt = recentHistory
      ? `${dataContext}\n\nRecent conversation (use to resolve pronouns like "him" / "her" / "that task"):\n${recentHistory}\n\nUser question: ${query}`
      : `${dataContext}\n\nUser question: ${query}`;

    try {
      let streamed = false;
      await generateAIStreamed({
        prompt,
        maxTokens: 1200,
        onChunk: (chunk) => {
          streamed = true;
          setMessages(m => m.map(msg =>
            msg.id === assistantMsgId ? { ...msg, content: msg.content + chunk } : msg
          ));
        },
      });

      if (!streamed) {
        // Fallback to non-streaming
        const result = await generateAIText({ prompt, maxTokens: 1200 });
        const text = result.success && result.text
          ? result.text
          : result.error || 'Sorry, I couldn\'t answer that. Try rephrasing.';
        setMessages(m => m.map(msg =>
          msg.id === assistantMsgId ? { ...msg, content: text } : msg
        ));
      }

      // After stream completes, parse actions from the finalized text
      setMessages(m => m.map(msg => {
        if (msg.id !== assistantMsgId) return msg;
        const { cleanText, actions } = parseActions(msg.content);
        if (actions.length === 0) return msg;
        const hydrated: ActionInstance[] = actions.map((a, i) => ({
          id: `act-${Date.now()}-${i}`,
          action: hydrateAction(a, { people: data.people, tasks: data.tasks, prayers: data.prayers }),
        }));
        return { ...msg, content: cleanText, actions: hydrated };
      }));
    } catch {
      setMessages(m => m.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: 'Something went wrong. Try again.' }
          : msg
      ));
    } finally {
      setLoading(false);
    }
  }, [dataContext, data.people, data.tasks, data.prayers, messages]);

  const updateAction = useCallback((messageId: string, actionId: string, patch: Partial<PendingAction>) => {
    setMessages(m => m.map(msg =>
      msg.id === messageId && msg.actions
        ? { ...msg, actions: msg.actions.map(a => a.id === actionId ? { ...a, action: { ...a.action, ...patch } } : a) }
        : msg
    ));
  }, []);

  const markActionStatus = useCallback((messageId: string, actionId: string, patch: Partial<ActionInstance>) => {
    setMessages(m => m.map(msg =>
      msg.id === messageId && msg.actions
        ? { ...msg, actions: msg.actions.map(a => a.id === actionId ? { ...a, ...patch } : a) }
        : msg
    ));
  }, []);

  const executeAction = useCallback(async (messageId: string, actionId: string) => {
    const msg = messages.find(m => m.id === messageId);
    const instance = msg?.actions?.find(a => a.id === actionId);
    const action = instance?.action;
    if (!action) return;

    try {
      if (action.type === 'add_person') {
        if (!action.firstName?.trim()) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'A new person needs a first name.' }]);
          return;
        }
        if (onAddPerson) {
          await onAddPerson({
            firstName: action.firstName.trim(),
            lastName: action.lastName?.trim() || '',
            email: action.email?.trim() || '',
            phone: action.phone?.trim() || '',
            status: action.status || 'visitor',
            tags: [],
            smallGroups: [],
          });
        }
      } else if (action.type === 'add_task' && onAddTask) {
        await onAddTask({
          title: action.title || 'Untitled task',
          personId: action.personId,
          priority: action.priority || 'medium',
          dueDate: action.dueDate || new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0],
          completed: false,
          category: 'follow-up',
        });
      } else if (action.type === 'add_prayer' && onAddPrayer) {
        if (!action.personId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'A prayer request needs a matching person.' }]);
          return;
        }
        await onAddPrayer({
          personId: action.personId,
          content: action.content || '',
          isPrivate: false,
        });
      } else if (action.type === 'add_note' && onAddInteraction) {
        if (!action.personId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'A note needs a matching person.' }]);
          return;
        }
        await onAddInteraction({
          personId: action.personId,
          type: 'note',
          content: action.content || '',
          createdBy: 'Grace',
        });
      } else if (action.type === 'mark_task_done' && onToggleTask) {
        if (!action.taskId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `I couldn't find an open task matching "${action.taskTitle ?? ''}". Try the exact title.` }]);
          return;
        }
        await onToggleTask(action.taskId);
      } else if (action.type === 'update_person_status' && onUpdatePersonStatus) {
        if (!action.personId || !action.status) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'I need a matching person and a status.' }]);
          return;
        }
        await onUpdatePersonStatus(action.personId, action.status);
      } else if (action.type === 'mark_prayer_answered' && onMarkPrayerAnswered) {
        if (!action.prayerId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'I couldn\'t find an active prayer request for that person.' }]);
          return;
        }
        await onMarkPrayerAnswered(action.prayerId, action.testimony);
      }
      markActionStatus(messageId, actionId, { executed: true });
    } catch {
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'Couldn\'t save that — please try again.' }]);
    }
  }, [messages, markActionStatus, onAddPerson, onAddTask, onAddPrayer, onAddInteraction, onToggleTask, onUpdatePersonStatus, onMarkPrayerAnswered]);

  const dismissAction = useCallback((messageId: string, actionId: string) => {
    markActionStatus(messageId, actionId, { dismissed: true });
  }, [markActionStatus]);

  // ⌘/ keyboard shortcut to toggle panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setPanelOpen(o => !o);
      }
      if (e.key === 'Escape') {
        setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const value = useMemo<GraceChatContextValue>(() => ({
    messages,
    loading,
    panelOpen,
    openPanel,
    closePanel,
    sendMessage,
    clearMessages,
    updateAction,
    executeAction,
    dismissAction,
    people: data.people,
    suggestions,
  }), [messages, loading, panelOpen, openPanel, closePanel, sendMessage, clearMessages, updateAction, executeAction, dismissAction, data.people, suggestions]);

  return <GraceChatContext.Provider value={value}>{children}</GraceChatContext.Provider>;
}

export function useGraceChat() {
  const ctx = useContext(GraceChatContext);
  if (!ctx) throw new Error('useGraceChat must be used inside GraceChatProvider');
  return ctx;
}
