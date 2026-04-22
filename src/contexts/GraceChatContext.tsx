import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { Person, Task, Giving, CalendarEvent, SmallGroup, PrayerRequest, Attendance, Interaction, MemberStatus } from '../types';
import { generateAIText, generateAIStreamed } from '../lib/services/ai';

export interface PendingAction {
  type: 'add_task' | 'add_prayer' | 'add_note' | 'add_person';
  title?: string;
  content?: string;
  personName?: string;
  personId?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: MemberStatus;
}

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
}

const GRACE_GREETING: GraceMessage = {
  id: 'greet',
  role: 'assistant',
  content: 'Hi — ask me anything about your church data, or ask me to add a person, task, prayer, or note.',
};

const GraceChatContext = createContext<GraceChatContextValue | null>(null);

function resolvePerson(name: string | undefined, people: Person[]): Person | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();
  return people.find(p => `${p.firstName} ${p.lastName}`.toLowerCase() === lower)
    || people.find(p => p.firstName.toLowerCase() === lower)
    || people.find(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(lower));
}

function parseActions(text: string): { cleanText: string; actions: PendingAction[] } {
  const matches = [...text.matchAll(/<action>([\s\S]*?)<\/action>/g)];
  if (matches.length === 0) return { cleanText: text, actions: [] };
  const actions: PendingAction[] = [];
  let cleanText = text;
  for (const m of matches) {
    try { actions.push(JSON.parse(m[1])); } catch { /* skip */ }
    cleanText = cleanText.replace(m[0], '');
  }
  cleanText = cleanText.trim() || (actions.length === 1
    ? 'Ready to add this? Review and edit, then click Execute.'
    : `Ready to add ${actions.length} items. Review each, then click Execute.`);
  return { cleanText, actions };
}

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
You are Grace AI, an assistant built into a church CRM. Answer questions using ONLY the data below. Be concise. Use bullet lists for multiple items.

WRITE-ACTIONS — BE DECISIVE:
When the user asks you to add a person, task, prayer, or note, ALWAYS respond with one <action> block per item. Do not ask for optional fields like email or phone — they're optional and the user can fill them in the confirm card. Your job is to propose; the user edits and confirms.

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

For multiple items in one request ("add X and Y"), emit multiple <action> blocks. For prayer/note, the personName must match someone in the list below — if no match, ask once which person. For add_person and add_task, new names are always fine.

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

interface GraceChatProviderProps extends GraceData, GraceHandlers {
  children: ReactNode;
}

export function GraceChatProvider({ children, onAddTask, onAddPrayer, onAddInteraction, onAddPerson, ...data }: GraceChatProviderProps) {
  const [messages, setMessages] = useState<GraceMessage[]>([GRACE_GREETING]);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Memoize context so we're not rebuilding this on every keystroke
  const dataContext = useMemo(() => buildDataContext(data), [
    data.people, data.tasks, data.giving, data.events,
    data.groups, data.prayers, data.attendance, data.churchName,
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

    const prompt = `${dataContext}\n\nUser question: ${query}`;

    try {
      let streamed = false;
      await generateAIStreamed({
        prompt,
        maxTokens: 500,
        onChunk: (chunk) => {
          streamed = true;
          setMessages(m => m.map(msg =>
            msg.id === assistantMsgId ? { ...msg, content: msg.content + chunk } : msg
          ));
        },
      });

      if (!streamed) {
        // Fallback to non-streaming
        const result = await generateAIText({ prompt, maxTokens: 500 });
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
        const hydrated: ActionInstance[] = actions.map((a, i) => {
          const matched = resolvePerson(a.personName, data.people);
          return {
            id: `act-${Date.now()}-${i}`,
            action: {
              ...a,
              personId: matched?.id,
              personName: matched ? `${matched.firstName} ${matched.lastName}` : a.personName,
            },
          };
        });
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
  }, [dataContext, data.people]);

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
      }
      markActionStatus(messageId, actionId, { executed: true });
    } catch {
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'Couldn\'t save that — please try again.' }]);
    }
  }, [messages, markActionStatus, onAddPerson, onAddTask, onAddPrayer, onAddInteraction]);

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
  }), [messages, loading, panelOpen, openPanel, closePanel, sendMessage, clearMessages, updateAction, executeAction, dismissAction, data.people]);

  return <GraceChatContext.Provider value={value}>{children}</GraceChatContext.Provider>;
}

export function useGraceChat() {
  const ctx = useContext(GraceChatContext);
  if (!ctx) throw new Error('useGraceChat must be used inside GraceChatProvider');
  return ctx;
}
