import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, X, Check, CheckSquare, Heart, StickyNote, UserPlus } from 'lucide-react';
import type { Person, Task, Giving, CalendarEvent, SmallGroup, PrayerRequest, Attendance, Interaction, MemberStatus } from '../types';
import { generateAIText } from '../lib/services/ai';
import { useAISettings } from '../hooks/useAISettings';

interface PendingAction {
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

interface ActionInstance {
  id: string;
  action: PendingAction;
  executed?: boolean;
  dismissed?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionInstance[];
}

export interface AskGraceData {
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  attendance: Attendance[];
  churchName?: string;
}

export interface AskGraceHandlers {
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void | Promise<void>;
  onAddPrayer?: (prayer: { personId: string; content: string; isPrivate: boolean }) => void | Promise<void>;
  onAddInteraction?: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => void | Promise<void>;
  onAddPerson?: (person: Omit<Person, 'id'>) => void | Promise<void>;
}

const suggestions = [
  'Who gave the most last month?',
  'Who hasn\'t attended in 30 days?',
  'Add a task to follow up with visitors this week',
  'Add a prayer request for my pastor',
  'Who has a birthday this week?',
];

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
    try {
      actions.push(JSON.parse(m[1]));
    } catch {
      // skip malformed block
    }
    cleanText = cleanText.replace(m[0], '');
  }
  cleanText = cleanText.trim() || (actions.length === 1
    ? 'Ready to add this? Review and edit, then click Execute.'
    : `Ready to add ${actions.length} items. Review each, then click Execute.`);
  return { cleanText, actions };
}

function buildDataContext(data: AskGraceData): string {
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

WRITE-ACTIONS:
If the user asks you to add/create something, respond with one <action> block per item followed by a brief confirmation sentence. For multiple items in one request, emit multiple <action> blocks (one per item).

Person format (for adding new people to the congregation):
<action>{"type":"add_person","firstName":"...","lastName":"...","status":"visitor","email":"","phone":""}</action>
status must be one of: visitor, regular, member, leader, inactive. Default to "visitor" unless the user specifies otherwise.

Task format:
<action>{"type":"add_task","title":"...","personName":"optional existing name","priority":"medium","dueDate":"YYYY-MM-DD"}</action>

Prayer request format (requires a personName from existing people):
<action>{"type":"add_prayer","content":"the request","personName":"existing person name"}</action>

Note format (requires a personName from existing people):
<action>{"type":"add_note","content":"the note","personName":"existing person name"}</action>

For prayer/note, never invent a person not in the list — ask for clarification instead. For add_task or add_person, new names are fine.

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

interface AskGraceChatProps extends AskGraceData, AskGraceHandlers {
  variant?: 'panel' | 'inline' | 'full';
  onClose?: () => void;
  seedInput?: string;
  onSeedConsumed?: () => void;
}

export function AskGraceChat({ variant = 'panel', onClose, seedInput, onSeedConsumed, onAddTask, onAddPrayer, onAddInteraction, onAddPerson, ...data }: AskGraceChatProps) {
  const { settings: aiSettings } = useAISettings();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'greet', role: 'assistant', content: 'Hi — ask me anything about your church data. Giving, attendance, groups, events, tasks, birthdays.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant === 'panel') inputRef.current?.focus();
  }, [variant]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (seedInput && seedInput.trim()) {
      handleSubmit(seedInput);
      onSeedConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedInput]);

  if (!aiSettings.aiAssistant) return null;

  const handleSubmit = async (query: string) => {
    if (!query.trim() || loading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: query };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    const context = buildDataContext(data);
    const prompt = `${context}\n\nUser question: ${query}`;

    try {
      const result = await generateAIText({ prompt, maxTokens: 500 });
      const text = result.success && result.text
        ? result.text
        : result.error || 'Sorry, I couldn\'t answer that. Try rephrasing.';
      const { cleanText, actions } = parseActions(text);
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
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: cleanText, actions: hydrated.length ? hydrated : undefined }]);
    } catch {
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const updateAction = (messageId: string, actionId: string, patch: Partial<PendingAction>) => {
    setMessages(m => m.map(msg =>
      msg.id === messageId && msg.actions
        ? { ...msg, actions: msg.actions.map(a => a.id === actionId ? { ...a, action: { ...a.action, ...patch } } : a) }
        : msg
    ));
  };

  const markActionStatus = (messageId: string, actionId: string, patch: Partial<ActionInstance>) => {
    setMessages(m => m.map(msg =>
      msg.id === messageId && msg.actions
        ? { ...msg, actions: msg.actions.map(a => a.id === actionId ? { ...a, ...patch } : a) }
        : msg
    ));
  };

  const executeAction = async (messageId: string, actionId: string) => {
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
        await handleSavePersonViaAction(action);
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
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'A prayer request needs a matching person — please tell me which person, or rephrase.' }]);
          return;
        }
        await onAddPrayer({
          personId: action.personId,
          content: action.content || '',
          isPrivate: false,
        });
      } else if (action.type === 'add_note' && onAddInteraction) {
        if (!action.personId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'A note needs a matching person — please tell me which person, or rephrase.' }]);
          return;
        }
        await onAddInteraction({
          personId: action.personId,
          type: 'note',
          content: action.content || '',
          createdBy: 'Ask Grace',
        });
      }
      markActionStatus(messageId, actionId, { executed: true });
    } catch {
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'Couldn\'t save that — please try again.' }]);
    }
  };

  const handleSavePersonViaAction = async (action: PendingAction) => {
    if (!onAddPerson) return;
    await onAddPerson({
      firstName: action.firstName?.trim() || '',
      lastName: action.lastName?.trim() || '',
      email: action.email?.trim() || '',
      phone: action.phone?.trim() || '',
      status: action.status || 'visitor',
      tags: [],
      smallGroups: [],
    });
  };

  const dismissAction = (messageId: string, actionId: string) => {
    markActionStatus(messageId, actionId, { dismissed: true });
  };

  const wrapperClass = variant === 'inline'
    ? 'flex flex-col h-[520px] bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 border border-stone-300/70 dark:border-white/5 rounded-xl overflow-hidden'
    : variant === 'full'
      ? 'flex flex-col h-full bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 border border-stone-300/70 dark:border-white/5 rounded-xl overflow-hidden'
      : 'flex flex-col h-full';

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-stone-300/60 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center">
            <Sparkles size={14} className="text-amber-300" />
          </div>
          <span className="serif text-lg text-slate-900 dark:text-dark-100 leading-none">Ask Grace</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200/70 dark:hover:bg-dark-800 text-gray-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className="space-y-2">
            <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white/70 dark:bg-dark-800 text-slate-900 dark:text-dark-100 border border-stone-200/70 dark:border-white/5'
                }`}
              >
                {m.content}
              </div>
            </div>
            {m.actions?.filter(a => !a.dismissed).map(a => (
              a.executed ? (
                <div key={a.id} className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 pl-1">
                  <Check size={14} /> Added {a.action.type === 'add_person' ? `${a.action.firstName ?? ''} ${a.action.lastName ?? ''}`.trim() : a.action.type.replace('add_', '')}
                </div>
              ) : (
                <ActionCard
                  key={a.id}
                  action={a.action}
                  people={data.people}
                  onChange={(patch) => updateAction(m.id, a.id, patch)}
                  onExecute={() => executeAction(m.id, a.id)}
                  onDismiss={() => dismissAction(m.id, a.id)}
                />
              )
            ))}
            {m.actions && m.actions.filter(a => !a.dismissed && !a.executed).length > 1 && (
              <div className="pl-2">
                <button
                  onClick={async () => {
                    const pending = m.actions?.filter(a => !a.dismissed && !a.executed) ?? [];
                    for (const a of pending) {
                      await executeAction(m.id, a.id);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-950 text-white rounded-md transition-colors"
                >
                  Execute all {m.actions.filter(a => !a.dismissed && !a.executed).length}
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-2xl bg-white/70 dark:bg-dark-800 border border-stone-200/70 dark:border-white/5">
              <Loader2 size={16} className="animate-spin text-gray-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions (only when conversation is fresh) */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => handleSubmit(s)}
              className="text-xs px-2.5 py-1.5 rounded-full bg-white/60 dark:bg-dark-800 border border-stone-200/70 dark:border-white/5 text-gray-700 dark:text-dark-300 hover:bg-white dark:hover:bg-dark-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
        className="p-3 border-t border-stone-300/60 dark:border-white/5"
      >
        <div className="flex items-center gap-2 bg-white/70 dark:bg-dark-800 border border-stone-200/70 dark:border-white/5 rounded-xl px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-dark-100 placeholder:text-gray-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

interface ActionCardProps {
  action: PendingAction;
  people: Person[];
  onChange: (patch: Partial<PendingAction>) => void;
  onExecute: () => void;
  onDismiss: () => void;
}

function ActionCard({ action, people, onChange, onExecute, onDismiss }: ActionCardProps) {
  const icon = action.type === 'add_task' ? <CheckSquare size={14} />
    : action.type === 'add_prayer' ? <Heart size={14} />
    : action.type === 'add_person' ? <UserPlus size={14} />
    : <StickyNote size={14} />;
  const label = action.type === 'add_task' ? 'New task'
    : action.type === 'add_prayer' ? 'New prayer request'
    : action.type === 'add_person' ? 'New person'
    : 'New note';

  return (
    <div className="ml-2 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/70 dark:border-amber-500/20">
      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-amber-800 dark:text-amber-400">
        {icon}
        <span>{label}</span>
      </div>

      <div className="space-y-2">
        {action.type === 'add_person' && (
          <>
            <div className="flex gap-2">
              <input
                value={action.firstName || ''}
                onChange={(e) => onChange({ firstName: e.target.value })}
                placeholder="First name"
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              />
              <input
                value={action.lastName || ''}
                onChange={(e) => onChange({ lastName: e.target.value })}
                placeholder="Last name"
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={action.email || ''}
                onChange={(e) => onChange({ email: e.target.value })}
                placeholder="Email (optional)"
                type="email"
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              />
              <input
                value={action.phone || ''}
                onChange={(e) => onChange({ phone: e.target.value })}
                placeholder="Phone (optional)"
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              />
            </div>
            <select
              value={action.status || 'visitor'}
              onChange={(e) => onChange({ status: e.target.value as MemberStatus })}
              className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
            >
              <option value="visitor">Visitor</option>
              <option value="regular">Regular</option>
              <option value="member">Member</option>
              <option value="leader">Leader</option>
              <option value="inactive">Inactive</option>
            </select>
          </>
        )}

        {action.type === 'add_task' && (
          <>
            <input
              value={action.title || ''}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Task title"
              className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
            />
            <div className="flex gap-2">
              <select
                value={action.priority || 'medium'}
                onChange={(e) => onChange({ priority: e.target.value as 'low' | 'medium' | 'high' })}
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={action.dueDate || ''}
                onChange={(e) => onChange({ dueDate: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              />
            </div>
          </>
        )}

        {(action.type === 'add_prayer' || action.type === 'add_note') && (
          <textarea
            value={action.content || ''}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder={action.type === 'add_prayer' ? 'Prayer request' : 'Note content'}
            rows={2}
            className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
          />
        )}

        {action.type !== 'add_person' && (
          <select
            value={action.personId || ''}
            onChange={(e) => {
              const p = people.find(x => x.id === e.target.value);
              onChange({ personId: e.target.value || undefined, personName: p ? `${p.firstName} ${p.lastName}` : undefined });
            }}
            className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
          >
            <option value="">{action.type === 'add_task' ? 'No specific person' : 'Pick a person…'}</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-xs text-gray-600 dark:text-dark-400 hover:bg-stone-200/60 dark:hover:bg-dark-800 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={onExecute}
          className="ml-auto px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-950 text-white rounded-md transition-colors"
        >
          Execute
        </button>
      </div>
    </div>
  );
}

export function AskGrace(props: AskGraceData & AskGraceHandlers) {
  const { settings: aiSettings } = useAISettings();
  const [isOpen, setIsOpen] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const [dockValue, setDockValue] = useState('');

  if (!aiSettings.aiAssistant) return null;

  const openWithSeed = (value: string) => {
    setSeedInput(value);
    setIsOpen(true);
    setDockValue('');
  };

  return (
    <>
      {!isOpen && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(520px,calc(100vw-120px))]"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (dockValue.trim()) openWithSeed(dockValue);
              else setIsOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900/95 hover:bg-slate-900 backdrop-blur border border-slate-700/50 rounded-full shadow-xl transition-colors"
          >
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="w-6 h-6 rounded-full bg-amber-400/20 hover:bg-amber-400/30 flex items-center justify-center shrink-0 transition-colors"
              aria-label="Open Grace"
            >
              <Sparkles size={13} className="text-amber-300" />
            </button>
            <input
              type="text"
              value={dockValue}
              onChange={(e) => setDockValue(e.target.value)}
              placeholder="Ask Grace…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Send"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      )}

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
          <aside className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 border-l border-stone-300/70 dark:border-white/5 shadow-2xl">
            <AskGraceChat {...props} variant="panel" seedInput={seedInput} onSeedConsumed={() => setSeedInput('')} onClose={() => setIsOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
