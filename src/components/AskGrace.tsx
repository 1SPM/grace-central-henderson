import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Loader2, X, Check, CheckSquare, Heart, StickyNote, UserPlus, Plus, CheckCircle2, UserCheck, HeartHandshake, Calendar, Mic, MicOff, Trash2, Pencil, Mail, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import type { Person, MemberStatus, EventCategory } from '../types';
import { useAISettings } from '../hooks/useAISettings';
import { useGraceSpeech } from '../hooks/useGraceSpeech';
import { useGraceChat, PendingAction } from '../contexts/GraceChatContext';
import { GraceOrb } from './grace/GraceOrb';
import type { GraceQuickTag } from '../lib/grace-chat/adminQuickTags';

interface AskGraceChatProps {
  variant?: 'panel' | 'inline' | 'full';
  onClose?: () => void;
}

function executedSummary(a: PendingAction): string {
  if (a.type === 'add_person') return `Added ${`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || 'person'}`;
  if (a.type === 'add_task') return `Added task: ${a.title ?? 'Untitled'}`;
  if (a.type === 'add_prayer') return 'Added prayer request';
  if (a.type === 'add_note') return 'Added note';
  if (a.type === 'add_event') return `Added event: ${a.title ?? 'Untitled'}`;
  if (a.type === 'mark_task_done') return `Task done: ${a.taskTitle ?? ''}`;
  if (a.type === 'update_task') return `Task updated: ${a.taskTitle ?? ''}`;
  if (a.type === 'update_person_status') return `Updated ${a.personName ?? 'person'} → ${a.status ?? ''}`;
  if (a.type === 'mark_prayer_answered') return `Prayer marked answered`;
  if (a.type === 'delete_task') return `Task deleted: ${a.taskTitle ?? ''}`;
  if (a.type === 'delete_person') return `Removed ${a.personName ?? 'person'}`;
  if (a.type === 'delete_prayer') return `Prayer removed`;
  if (a.type === 'send_email') return `Emailed ${a.personName ?? 'recipient'}: ${a.subject ?? ''}`;
  if (a.type === 'send_sms') return `Texted ${a.personName ?? 'recipient'}`;
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
        className="underline text-blue-700 dark:text-blue-400 hover:text-blue-800 break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

interface MinimalRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => MinimalRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return (Ctor as new () => MinimalRecognition) || null;
}

/** Skip TTS for configuration / error strings — not useful read aloud. */
function shouldAutoSpeakReply(content: string): boolean {
  const text = content.trim();
  if (!text) return false;
  return !/ai service not configured|ai not configured|network error|something went wrong/i.test(text);
}

const VOICE_GREETING_SESSION_KEY = 'grace-admin-voice-greeted';

function useVoiceInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<MinimalRecognition | null>(null);
  const supported = !!getSpeechRecognitionCtor();

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const results = Array.from(e.results) as ArrayLike<{ transcript: string }>[];
      const transcript = results
        .map(r => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) onTranscript(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (event) => {
      setListening(false);
      if (event.error === 'not-allowed') {
        console.warn('[Ask Grace] Microphone blocked — allow mic in browser settings or check Permissions-Policy.');
      }
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [onTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}

export function AskGraceChat({ variant = 'panel', onClose }: AskGraceChatProps) {
  const { settings: aiSettings } = useAISettings();
  const chat = useGraceChat();
  const { speak, stop, speakingId, supported: speechSupported } = useGraceSpeech();
  const [input, setInput] = useState('');
  const [listenPromptId, setListenPromptId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLoadingRef = useRef(chat.loading);
  const voice = useVoiceInput((text) => setInput(prev => prev ? `${prev} ${text}` : text));

  useEffect(() => {
    if (variant === 'panel') inputRef.current?.focus();
  }, [variant]);

  // Auto-greet on first panel open this session — mirrors member portal companion.
  useEffect(() => {
    if (variant !== 'panel' || !aiSettings.voiceReadback || !speechSupported) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem(VOICE_GREETING_SESSION_KEY)) return;

    const greeting = chat.messages.find(m => m.role === 'assistant' && m.content.trim());
    if (!greeting || !shouldAutoSpeakReply(greeting.content)) return;

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(VOICE_GREETING_SESSION_KEY, '1');
    }

    const timer = window.setTimeout(() => {
      speak(greeting.content, greeting.id);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [variant, aiSettings.voiceReadback, speechSupported, speak, chat.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  useEffect(() => () => { stop(); }, [stop]);

  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = chat.loading;
    if (wasLoading && !chat.loading && aiSettings.voiceReadback && speechSupported) {
      const lastAssistant = [...chat.messages].reverse().find(
        m => m.role === 'assistant' && m.content.trim(),
      );
      if (lastAssistant && shouldAutoSpeakReply(lastAssistant.content)) {
        if (lastAssistant.source === 'brief') {
          setListenPromptId(lastAssistant.id);
        }
        speak(lastAssistant.content, lastAssistant.id);
      }
    }
  }, [chat.loading, chat.messages, aiSettings.voiceReadback, speechSupported, speak]);

  if (!aiSettings.aiAssistant) return null;

  const handleSend = async (query: string) => {
    if (!query.trim() || chat.loading) return;
    stop();
    setListenPromptId(null);
    setInput('');
    await chat.sendMessage(query);
  };

  const handleClose = () => {
    stop();
    onClose?.();
  };

  const wrapperClass = variant === 'inline'
    ? 'flex flex-col h-[520px] bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 border border-stone-300/70 dark:border-white/5 rounded-xl overflow-hidden'
    : variant === 'full'
      ? 'flex flex-col h-full bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 border border-stone-300/70 dark:border-white/5 rounded-xl overflow-hidden'
      : 'flex flex-col h-full';

  const showSuggestions = chat.messages.length === 1 && variant !== 'panel';

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-stone-300/60 dark:border-white/5">
        <div className="flex items-center gap-2">
          <GraceOrb size="xs" />
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
              onClick={handleClose}
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
              {m.role === 'assistant' && m.content && speechSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (speakingId === m.id) {
                      stop();
                    } else {
                      setListenPromptId(null);
                      speak(m.content, m.id);
                    }
                  }}
                  className={`self-end ml-1 p-1.5 rounded-lg transition-colors shrink-0 ${
                    speakingId === m.id
                      ? 'bg-amber-500 text-white'
                      : 'text-gray-500 hover:bg-stone-200/60 dark:hover:bg-dark-700'
                  }`}
                  aria-label={speakingId === m.id ? 'Stop reading aloud' : 'Read aloud'}
                >
                  {speakingId === m.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              )}
            </div>
            {listenPromptId === m.id && m.role === 'assistant' && m.content && speechSupported && (
              <button
                type="button"
                onClick={() => {
                  setListenPromptId(null);
                  speak(m.content, m.id);
                }}
                className="flex items-center gap-2 ml-1 px-3 py-2 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                <Volume2 size={14} />
                Listen to briefing
              </button>
            )}
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
            placeholder={voice.listening ? 'Listening…' : 'Ask a question…'}
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-dark-100 placeholder:text-gray-400"
            disabled={chat.loading}
          />
          {voice.supported && (
            <button
              type="button"
              onClick={voice.listening ? voice.stop : voice.start}
              className={`p-1.5 rounded-lg transition-colors ${voice.listening
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'text-gray-500 hover:bg-stone-200/60 dark:hover:bg-dark-700'}`}
              aria-label={voice.listening ? 'Stop recording' : 'Start voice input'}
            >
              {voice.listening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          )}
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
  const isDestructive = action.type === 'delete_task' || action.type === 'delete_person' || action.type === 'delete_prayer';
  const icon = action.type === 'add_task' ? <CheckSquare size={14} />
    : action.type === 'add_prayer' ? <Heart size={14} />
    : action.type === 'add_person' ? <UserPlus size={14} />
    : action.type === 'add_note' ? <StickyNote size={14} />
    : action.type === 'add_event' ? <Calendar size={14} />
    : action.type === 'mark_task_done' ? <CheckCircle2 size={14} />
    : action.type === 'update_task' ? <Pencil size={14} />
    : action.type === 'update_person_status' ? <UserCheck size={14} />
    : action.type === 'mark_prayer_answered' ? <HeartHandshake size={14} />
    : action.type === 'send_email' ? <Mail size={14} />
    : action.type === 'send_sms' ? <MessageSquare size={14} />
    : isDestructive ? <Trash2 size={14} />
    : <StickyNote size={14} />;
  const label = action.type === 'add_task' ? 'New task'
    : action.type === 'add_prayer' ? 'New prayer request'
    : action.type === 'add_person' ? 'New person'
    : action.type === 'add_note' ? 'New note'
    : action.type === 'add_event' ? 'New event'
    : action.type === 'mark_task_done' ? 'Mark task done'
    : action.type === 'update_task' ? 'Update task'
    : action.type === 'update_person_status' ? 'Update status'
    : action.type === 'mark_prayer_answered' ? 'Mark prayer answered'
    : action.type === 'delete_task' ? 'Delete task'
    : action.type === 'delete_person' ? 'Remove person'
    : action.type === 'delete_prayer' ? 'Remove prayer'
    : action.type === 'send_email' ? 'Send email'
    : action.type === 'send_sms' ? 'Send text'
    : 'Action';

  return (
    <div className={`ml-2 p-3 rounded-xl border ${isDestructive
      ? 'bg-rose-50/60 dark:bg-rose-500/5 border-rose-200/70 dark:border-rose-500/20'
      : 'bg-amber-50/60 dark:bg-amber-500/5 border-amber-200/70 dark:border-amber-500/20'}`}>
      <div className={`flex items-center gap-2 mb-2 text-xs font-medium ${isDestructive
        ? 'text-rose-800 dark:text-rose-400'
        : 'text-amber-800 dark:text-amber-400'}`}>
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

        {action.type === 'update_task' && (
          <>
            <div className="text-xs text-gray-600 dark:text-dark-400">Editing: {action.taskTitle || '(no task matched)'}</div>
            <input
              value={action.title || ''}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="New title (leave blank to keep current)"
              className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
            />
            <div className="flex gap-2">
              <select
                value={action.priority || ''}
                onChange={(e) => onChange({ priority: (e.target.value || undefined) as 'low' | 'medium' | 'high' | undefined })}
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              >
                <option value="">— Keep priority —</option>
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
            {!action.taskId && (
              <div className="text-xs text-rose-600 dark:text-rose-400">No matching open task — try the exact title.</div>
            )}
          </>
        )}

        {action.type === 'send_email' && (
          <>
            {(() => {
              const recipient = people.find(p => p.id === action.personId);
              return recipient ? (
                <div className="text-xs text-gray-600 dark:text-dark-400">
                  To: {recipient.firstName} {recipient.lastName}
                  {recipient.email
                    ? <> · <span className="text-slate-700 dark:text-dark-200">{recipient.email}</span></>
                    : <span className="text-rose-600 dark:text-rose-400"> · no email on file</span>}
                </div>
              ) : null;
            })()}
            <input
              value={action.subject || ''}
              onChange={(e) => onChange({ subject: e.target.value })}
              placeholder="Subject"
              className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
            />
            <textarea
              value={action.body || ''}
              onChange={(e) => onChange({ body: e.target.value })}
              placeholder="Email body"
              rows={5}
              className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
            />
          </>
        )}

        {action.type === 'send_sms' && (
          <>
            {(() => {
              const recipient = people.find(p => p.id === action.personId);
              return recipient ? (
                <div className="text-xs text-gray-600 dark:text-dark-400">
                  To: {recipient.firstName} {recipient.lastName}
                  {recipient.phone
                    ? <> · <span className="text-slate-700 dark:text-dark-200">{recipient.phone}</span></>
                    : <span className="text-rose-600 dark:text-rose-400"> · no phone on file</span>}
                </div>
              ) : null;
            })()}
            <textarea
              value={action.message || ''}
              onChange={(e) => onChange({ message: e.target.value })}
              placeholder="Text message"
              rows={3}
              className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
            />
            <div className="text-[10px] text-gray-500 dark:text-dark-500 text-right">
              {(action.message?.length ?? 0)} chars
            </div>
          </>
        )}

        {(action.type === 'delete_task' || action.type === 'delete_person' || action.type === 'delete_prayer') && (
          <div className="text-sm space-y-1">
            <div className="text-rose-700 dark:text-rose-400 font-medium">
              {action.type === 'delete_task' && (action.taskTitle || '(no task matched)')}
              {action.type === 'delete_person' && (action.personName || '(no person matched)')}
              {action.type === 'delete_prayer' && (action.prayerContent ? `"${action.prayerContent.slice(0, 80)}${action.prayerContent.length > 80 ? '…' : ''}"` : '(no prayer matched)')}
            </div>
            <div className="text-xs text-rose-600/80 dark:text-rose-400/80">This can't be undone from Grace.</div>
            {action.type === 'delete_task' && !action.taskId && (
              <div className="text-xs text-rose-600 dark:text-rose-400">No matching task — pick from the list below.</div>
            )}
            {action.type === 'delete_prayer' && !action.prayerId && (
              <div className="text-xs text-rose-600 dark:text-rose-400">No matching active prayer.</div>
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

        {action.type === 'add_event' && (
          <>
            <input
              value={action.title || ''}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Event title"
              className="w-full px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={action.startDate || ''}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              />
              <input
                type="time"
                value={action.startTime || ''}
                onChange={(e) => onChange({ startTime: e.target.value })}
                disabled={action.allDay}
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md disabled:opacity-50"
              />
              <input
                type="time"
                value={action.endTime || ''}
                onChange={(e) => onChange({ endTime: e.target.value })}
                disabled={action.allDay}
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md disabled:opacity-50"
              />
            </div>
            <div className="flex gap-2 items-center">
              <input
                value={action.location || ''}
                onChange={(e) => onChange({ location: e.target.value })}
                placeholder="Location (optional)"
                className="flex-1 px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              />
              <select
                value={action.category || 'event'}
                onChange={(e) => onChange({ category: e.target.value as EventCategory })}
                className="px-2.5 py-1.5 text-sm bg-white/80 dark:bg-dark-800 border border-stone-300 dark:border-dark-700 rounded-md"
              >
                <option value="event">Event</option>
                <option value="service">Service</option>
                <option value="meeting">Meeting</option>
                <option value="small-group">Small group</option>
                <option value="rehearsal">Rehearsal</option>
                <option value="counseling">Counseling</option>
                <option value="outreach">Outreach</option>
                <option value="wedding">Wedding</option>
                <option value="funeral">Funeral</option>
                <option value="baptism">Baptism</option>
                <option value="dedication">Dedication</option>
                <option value="ceremony">Ceremony</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-dark-400">
              <input
                type="checkbox"
                checked={action.allDay || false}
                onChange={(e) => onChange({ allDay: e.target.checked })}
                className="rounded"
              />
              All-day event
            </label>
          </>
        )}

        {action.type !== 'add_person' && action.type !== 'add_event' && action.type !== 'mark_task_done' && action.type !== 'mark_prayer_answered' && action.type !== 'update_task' && action.type !== 'delete_task' && action.type !== 'delete_prayer' && (
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
          className={`ml-auto px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors ${isDestructive
            ? 'bg-rose-600 hover:bg-rose-700'
            : 'bg-slate-900 hover:bg-slate-950'}`}
        >
          {isDestructive ? 'Confirm delete' : 'Execute'}
        </button>
      </div>
    </div>
  );
}

interface GraceAdminSidePanelProps {
  salutation: string;
  tags: GraceQuickTag[];
  onTagClick: (prompt: string) => void;
  loading?: boolean;
}

export function GraceAdminSidePanel({
  salutation,
  tags,
  onTagClick,
  loading = false,
}: GraceAdminSidePanelProps) {
  return (
    <div className="hidden sm:flex flex-col w-[220px] shrink-0 bg-gradient-to-b from-blue-900 to-blue-950 border-r border-blue-800/60 text-white">
      <div className="flex flex-col items-center pt-6 pb-4 px-4 border-b border-white/10 overflow-visible">
        <div className="overflow-visible p-2">
          <GraceOrb size="md" rings />
        </div>
        <p className="mt-4 text-sm font-semibold text-center leading-snug text-white">
          {salutation}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-blue-200/80 font-medium">
          GRACE · Admin Assistant
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="text-[10px] uppercase tracking-[0.12em] text-blue-300/70 font-medium mb-2 px-1">
          Popular requests
        </p>
        <div className="flex flex-col gap-1.5">
          {tags.map(tag => (
            <button
              key={tag.label}
              type="button"
              disabled={loading}
              onClick={() => onTagClick(tag.prompt)}
              className="text-left text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-blue-50 transition-colors disabled:opacity-50"
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      <div className="py-4 flex justify-center border-t border-white/10">
        <span className="text-[10px] uppercase tracking-[0.2em] text-blue-200/60 font-medium">
          GRACE
        </span>
      </div>
    </div>
  );
}

/** @deprecated Use GraceAdminSidePanel */
export function AvatarSkyPanel() {
  const chat = useGraceChat();
  return (
    <GraceAdminSidePanel
      salutation={chat.salutation}
      tags={chat.quickTags}
      onTagClick={(prompt) => void chat.sendMessage(prompt)}
      loading={chat.loading}
    />
  );
}

interface AskGraceProps {
  hideDock?: boolean;
}

function useIsOnGracePage(): boolean {
  const [onGrace, setOnGrace] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash;
    return hash.startsWith('#/leadership') || hash.startsWith('#/grace');
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => {
      const hash = window.location.hash;
      setOnGrace(hash.startsWith('#/leadership') || hash.startsWith('#/grace'));
    };
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  return onGrace;
}

export function AskGrace({ hideDock = false }: AskGraceProps = {}) {
  const { settings: aiSettings } = useAISettings();
  const chat = useGraceChat();
  const [dockValue, setDockValue] = useState('');
  const onGracePage = useIsOnGracePage();
  const shouldHideDock = hideDock || onGracePage;

  if (!aiSettings.aiAssistant) return null;

  return (
    <>
      {!chat.panelOpen && !shouldHideDock && (
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
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
              aria-label="Open Grace"
            >
              <GraceOrb size="xs" />
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
            <GraceAdminSidePanel
              salutation={chat.salutation}
              tags={chat.quickTags}
              onTagClick={(prompt) => void chat.sendMessage(prompt)}
              loading={chat.loading}
            />
            <div className="flex-1 min-w-0">
              <AskGraceChat variant="panel" onClose={chat.closePanel} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
