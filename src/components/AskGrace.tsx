import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import type { Person, Task, Giving, CalendarEvent, SmallGroup, PrayerRequest, Attendance } from '../types';
import { generateAIText } from '../lib/services/ai';
import { useAISettings } from '../hooks/useAISettings';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AskGraceProps {
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  attendance: Attendance[];
  churchName?: string;
}

const suggestions = [
  'Who gave the most last month?',
  'Who hasn\'t attended in 30 days?',
  'What events are coming up?',
  'Which groups have open seats?',
  'Who has a birthday this week?',
];

function buildDataContext(data: AskGraceProps): string {
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
You are Grace AI, an assistant built into a church CRM. Answer the user's question using ONLY the data below. Be concise. Use bullet lists for multiple items. If the data doesn't answer the question, say so plainly.

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

export function AskGrace(props: AskGraceProps) {
  const { settings: aiSettings } = useAISettings();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'greet', role: 'assistant', content: 'Hi — ask me anything about your church data. Giving, attendance, groups, events, tasks, birthdays.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!aiSettings.aiAssistant) return null;

  const handleSubmit = async (query: string) => {
    if (!query.trim() || loading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: query };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    const context = buildDataContext(props);
    const prompt = `${context}\n\nUser question: ${query}`;

    try {
      const result = await generateAIText({ prompt, maxTokens: 500 });
      const text = result.success && result.text
        ? result.text
        : result.error || 'Sorry, I couldn\'t answer that. Try rephrasing.';
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: text }]);
    } catch {
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-950 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
          aria-label="Ask Grace AI"
        >
          <Sparkles size={18} className="text-amber-300" />
          <span className="text-sm font-medium">Ask Grace</span>
        </button>
      )}

      {/* Slide-in panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
          <aside className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 border-l border-stone-300/70 dark:border-white/5 flex flex-col shadow-2xl">
            {/* Header */}
            <header className="flex items-center justify-between h-14 px-4 border-b border-stone-300/60 dark:border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center">
                  <Sparkles size={14} className="text-amber-300" />
                </div>
                <span className="serif text-lg text-slate-900 dark:text-dark-100 leading-none">Ask Grace</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-stone-200/70 dark:hover:bg-dark-800 text-gray-500"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
          </aside>
        </>
      )}
    </>
  );
}
