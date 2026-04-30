import { useRef, useEffect, useState } from 'react';
import { Sparkles, Send, Loader2, X, Check, CheckSquare, Heart, StickyNote, UserPlus, Plus, CheckCircle2, UserCheck, HeartHandshake } from 'lucide-react';
import type { Person, MemberStatus } from '../types';
import { useAISettings } from '../hooks/useAISettings';
import { useGraceChat, PendingAction } from '../contexts/GraceChatContext';

interface AskGraceChatProps {
  variant?: 'panel' | 'inline' | 'full';
  onClose?: () => void;
}

function executedSummary(a: PendingAction): string {
  if (a.type === 'add_person') return `Added ${`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || 'person'}`;
  if (a.type === 'add_task') return `Added task: ${a.title ?? 'Untitled'}`;
  if (a.type === 'add_prayer') return 'Added prayer request';
  if (a.type === 'add_note') return 'Added note';
  if (a.type === 'mark_task_done') return `Task done: ${a.taskTitle ?? ''}`;
  if (a.type === 'update_person_status') return `Updated ${a.personName ?? 'person'} → ${a.status ?? ''}`;
  if (a.type === 'mark_prayer_answered') return `Prayer marked answered`;
  return 'Done';
}

function renderWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-amber-700 dark:text-amber-400 hover:text-amber-800 break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function AskGraceChat({ variant = 'panel', onClose }: AskGraceChatProps) {
  const { settings: aiSettings } = useAISettings();
  const chat = useGraceChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant === 'panel') inputRef.current?.focus();
  }, [variant]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  if (!aiSettings.aiAssistant) return null;

  const handleSend = async (query: string) => {
    if (!query.trim() || chat.loading) return;
    setInput('');
    await chat.sendMessage(query);
  };

  const wrapperClass = variant === 'inline'
    ? 'flex flex-col h-[520px] bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 border border-stone-300/70 dark:border-white/5 rounded-xl overflow-hidden'
    : variant === 'full'
      ? 'flex flex-col h-full bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 border border-stone-300/70 dark:border-white/5 rounded-xl overflow-hidden'
      : 'flex flex-col h-full';

  const showSuggestions = chat.messages.length === 1;

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
        <div className="flex items-center gap-1">
          {chat.messages.length > 1 && (
            <button
              onClick={chat.clearMessages}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-dark-400 hover:bg-stone-200/60 dark:hover:bg-dark-800 rounded-md"
              aria-label="New chat"
            >
              <Plus size={12} /> New
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-stone-200/70 dark:hover:bg-dark-800 text-gray-500"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chat.messages.map(m => (
          <div key={m.id} className="space-y-2">
            <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white/70 dark:bg-dark-800 text-slate-900 dark:text-dark-100 border border-stone-200/70 dark:border-white/5'
                }`}
              >
                {m.content
                  ? renderWithLinks(m.content)
                  : m.role === 'assistant' && chat.loading
                    ? <Loader2 size={16} className="animate-spin text-gray-500" />
                    : ''}
              </div>
            </div>
            {m.actions?.filter(a => !a.dismissed).map(a => (
              a.executed ? (
                <div key={a.id} className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 pl-1">
                  <Check size={14} /> {executedSummary(a.action)}
                </div>
              ) : (
                <ActionCard
                  key={a.id}
                  action={a.action}
                  people={chat.people}
                  onChange={(patch) => chat.updateAction(m.id, a.id, patch)}
                  onExecute={() => chat.executeAction(m.id, a.id)}
                  onDismiss={() => chat.dismissAction(m.id, a.id)}
                />
              )
            ))}
            {m.actions && m.actions.filter(a => !a.dismissed && !a.executed).length > 1 && (
              <div className="pl-2">
                <button
                  onClick={async () => {
                    const pending = m.actions?.filter(a => !a.dismissed && !a.executed) ?? [];
                    for (const a of pending) {
                      await chat.executeAction(m.id, a.id);
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
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && chat.suggestions.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {chat.suggestions.map(s => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="text-xs px-2.5 py-1.5 rounded-full bg-white/60 dark:bg-dark-800 border border-stone-200/70 dark:border-white/5 text-gray-700 dark:text-dark-300 hover:bg-white dark:hover:bg-dark-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
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
            disabled={chat.loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || chat.loading}
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
    : action.type === 'add_note' ? <StickyNote size={14} />
    : action.type === 'mark_task_done' ? <CheckCircle2 size={14} />
    : action.type === 'update_person_status' ? <UserCheck size={14} />
    : action.type === 'mark_prayer_answered' ? <HeartHandshake size={14} />
    : <StickyNote size={14} />;
  const label = action.type === 'add_task' ? 'New task'
    : action.type === 'add_prayer' ? 'New prayer request'
    : action.type === 'add_person' ? 'New person'
    : action.type === 'add_note' ? 'New note'
    : action.type === 'mark_task_done' ? 'Mark task done'
    : action.type === 'update_person_status' ? 'Update status'
    : action.type === 'mark_prayer_answered' ? 'Mark prayer answered'
    : 'Action';

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

        {action.type === 'mark_task_done' && (
          <div className="text-sm space-y-1">
            <div className="text-slate-900 dark:text-dark-100 font-medium">{action.taskTitle || '(no task matched)'}</div>
            {action.personName && (
              <div className="text-xs text-gray-600 dark:text-dark-400">For {action.personName}</div>
            )}
            {!action.taskId && (
              <div className="text-xs text-rose-600 dark:text-rose-400">No matching open task — try the exact title.</div>
            )}
          </div>
        )}

        {action.type === 'update_person_status' && (
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
        )}

        {action.type === 'mark_prayer_answered' && (
          <>
            {action.prayerContent && (
              <div className="text-xs text-gray-600 dark:text-dark-400 italic px-2.5 py-1.5 bg-white/40 dark:bg-dark-900/30 rounded-md border border-stone-200/50 dark:border-dark-700/50">
                "{action.prayerContent.length > 120 ? action.prayerContent.slice(0, 120) + '…' : action.prayerContent}"
              </div>
            )}
            <textarea
              value={action.testimony || ''}
              onChange={(e) => onChange({ testimony: e.target.value })}
              placeholder="Testimony (optional)"
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
            />
            {!action.prayerId && (
              <div className="text-xs text-rose-600 dark:text-rose-400">No active prayer found for that person.</div>
            )}
          </>
        )}

        {action.type !== 'add_person' && action.type !== 'mark_task_done' && action.type !== 'mark_prayer_answered' && (
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

function AvatarSkyPanel() {
  return (
    <div className="hidden sm:flex flex-col w-[220px] shrink-0 relative overflow-hidden border-r border-stone-300/60 dark:border-white/5">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #b8cee0 0%, #d6dde0 28%, #ecd9b8 60%, #ecc28e 88%, #d99a64 100%)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '14%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '180px',
          height: '180px',
          background:
            'radial-gradient(circle, rgba(255,235,180,0.95) 0%, rgba(255,220,150,0.55) 30%, rgba(255,220,150,0) 70%)',
          filter: 'blur(2px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '38%',
          left: '-30%',
          width: '160px',
          height: '50px',
          background:
            'radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)',
          filter: 'blur(8px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '52%',
          right: '-25%',
          width: '140px',
          height: '42px',
          background:
            'radial-gradient(ellipse, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)',
          filter: 'blur(8px)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[35%] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(160,110,70,0) 0%, rgba(120,80,50,0.18) 65%, rgba(80,55,40,0.32) 100%)',
        }}
      />
      <div className="relative flex-1 flex items-end justify-center pb-5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-50/80 font-medium drop-shadow-sm">
          Grace
        </span>
      </div>
    </div>
  );
}

export function AskGrace() {
  const { settings: aiSettings } = useAISettings();
  const chat = useGraceChat();
  const [dockValue, setDockValue] = useState('');

  if (!aiSettings.aiAssistant) return null;

  return (
    <>
      {!chat.panelOpen && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-32px)] sm:w-[min(520px,calc(100vw-120px))]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (dockValue.trim()) {
                chat.openPanel(dockValue);
                setDockValue('');
              } else {
                chat.openPanel();
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900/95 hover:bg-slate-900 backdrop-blur border border-slate-700/50 rounded-full shadow-xl transition-colors"
          >
            <button
              type="button"
              onClick={() => chat.openPanel()}
              className="w-6 h-6 rounded-full bg-amber-400/20 hover:bg-amber-400/30 flex items-center justify-center shrink-0 transition-colors"
              aria-label="Open Grace"
            >
              <Sparkles size={13} className="text-amber-300" />
            </button>
            <input
              type="text"
              value={dockValue}
              onChange={(e) => setDockValue(e.target.value)}
              placeholder="Ask Grace to add a task…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-slate-400"
            />
            <kbd className="hidden sm:inline text-[10px] text-slate-400 font-mono px-1.5 py-0.5 bg-white/5 rounded">⌘/</kbd>
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

      {chat.panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40" onClick={chat.closePanel} />
          <aside
            className="fixed z-50 bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 shadow-2xl
              inset-0 sm:inset-auto
              sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2
              sm:w-[min(780px,calc(100vw-48px))] sm:h-[min(640px,calc(100vh-96px))]
              sm:rounded-2xl sm:border sm:border-stone-300/70 sm:dark:border-white/5
              overflow-hidden flex"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <AvatarSkyPanel />
            <div className="flex-1 min-w-0">
              <AskGraceChat variant="panel" onClose={chat.closePanel} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
