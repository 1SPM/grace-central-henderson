import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Check, Mic, X } from 'lucide-react';
import type { View } from '../../../types';
import { useGraceChatOptional, type GraceMessage } from '../../../contexts/GraceChatContext';
import { useVoiceInput } from '../../../hooks/useVoiceInput';
import { GraceOrb } from '../../grace/GraceOrb';
import { muted, surface } from '../ui/mobileTheme';

interface AskGraceScreenProps {
  /** Prompt to send on mount (from the Ask pill / quick actions). */
  seed?: string | null;
  onSeedConsumed?: () => void;
  /** Start voice capture on mount (from "Talk to Grace"). */
  autoListen?: boolean;
  onListenConsumed?: () => void;
  onNavigate: (view: View) => void;
}

/** Minimal markdown: **bold** and newlines — enough for Grace's replies. */
function renderContent(text: string) {
  return text.split('\n').map((line, i) => (
    <span key={i} className="block min-h-[0.5em]">
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={j} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </span>
  ));
}

const FALLBACK_PROMPTS: { label: string; view: View }[] = [
  { label: "What's on my plate today?", view: 'feed' },
  { label: 'Who needs my attention?', view: 'people' },
  { label: "How's Sunday preparation?", view: 'sunday-prep' },
  { label: 'Show me my work queue', view: 'tasks' },
];

export function AskGraceScreen({
  seed,
  onSeedConsumed,
  autoListen,
  onListenConsumed,
  onNavigate,
}: AskGraceScreenProps) {
  const chat = useGraceChatOptional();
  const [input, setInput] = useState('');
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !chat) return;
      setInput('');
      void chat.sendMessage(trimmed);
    },
    [chat],
  );
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Spoken utterances auto-send, matching the desktop AskGrace behavior.
  const voice = useVoiceInput((transcript) => sendRef.current(transcript));
  const voiceStartRef = useRef(voice.start);
  useEffect(() => {
    voiceStartRef.current = voice.start;
  }, [voice.start]);

  // Consume a seed prompt handed over by the Ask pill / quick actions.
  useEffect(() => {
    if (!seed || !chat) return;
    sendRef.current(seed);
    onSeedConsumed?.();
  }, [seed, chat, onSeedConsumed]);

  // "Talk to Grace": begin listening on arrival. Some mobile browsers
  // reject recognition started outside the original tap — the mic button
  // stays as the fallback, so a silent failure is acceptable here.
  useEffect(() => {
    if (!autoListen) return;
    if (voice.supported) {
      try {
        voiceStartRef.current();
      } catch {
        /* degrade to the mic button */
      }
    }
    onListenConsumed?.();
  }, [autoListen]);

  const messages = chat?.messages ?? [];
  const threadStarted = messages.some((m) => m.role === 'user');

  useEffect(() => {
    if (threadStarted) threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, chat?.loading, threadStarted]);

  const promptPills = useMemo(() => (chat ? chat.quickTags.slice(0, 4) : []), [chat]);

  if (!chat) {
    // No provider (defensive: previews / future mount regressions) — keep
    // the screen useful as a navigator instead of crashing.
    return (
      <div className="px-4 pt-7 pb-6 min-h-full text-center bg-[radial-gradient(circle_at_50%_18%,rgba(64,123,255,.23),transparent_25%),#070b14]">
        <GraceOrb size="sb" rings className="mx-auto" />
        <h1 className="text-xl font-semibold mt-6 text-slate-100">How can I help you today?</h1>
        <p className={`text-sm mt-2 ${muted}`}>Grace chat isn't available in this preview.</p>
        <div className="mt-6 space-y-2 text-left">
          {FALLBACK_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`${surface} w-full p-3.5 text-sm text-slate-200 flex items-center justify-between`}
            >
              <span>{item.label}</span>
              <ArrowRight size={16} className="text-violet-300" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[radial-gradient(circle_at_50%_12%,rgba(64,123,255,.2),transparent_28%),#070b14]">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-3">
        {!threadStarted ? (
          <div className="text-center pt-4">
            <GraceOrb size="lg" rings listening={voice.listening} className="mx-auto" />
            <h1 className="text-xl font-semibold mt-6 text-slate-100">
              {voice.listening ? 'Listening…' : 'How can I help you today?'}
            </h1>
            {chat.salutation && <p className={`text-sm mt-2 ${muted}`}>{chat.salutation}</p>}
            <div className="mt-7 space-y-2 text-left">
              {promptPills.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => send(tag.prompt)}
                  className={`${surface} w-full p-3.5 text-sm text-slate-200 flex items-center justify-between`}
                >
                  <span className="min-w-0 truncate">{tag.label}</span>
                  <ArrowRight size={16} className="text-violet-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <GraceOrb size="xs" listening={voice.listening} />
              <button
                type="button"
                onClick={() => chat.clearMessages()}
                className={`text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.05] ${muted}`}
              >
                New conversation
              </button>
            </div>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onExecute={(actionId) => void chat.executeAction(message.id, actionId)}
                onDismiss={(actionId) => chat.dismissAction(message.id, actionId)}
              />
            ))}
            {chat.loading && (
              <div className={`${surface} inline-flex items-center gap-1.5 px-3.5 py-3`}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}
            <div ref={threadEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        className="px-3 pb-3 pt-1 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <label className="h-11 flex-1 rounded-2xl border border-white/[0.09] bg-white/[0.055] px-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Grace anything..."
            className="min-w-0 flex-1 bg-transparent border-0 text-sm text-slate-100 placeholder:text-slate-500 focus:ring-0"
          />
        </label>
        {voice.supported && (
          <button
            type="button"
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            className={`w-11 h-11 rounded-2xl grid place-items-center shrink-0 transition-colors ${
              voice.listening
                ? 'bg-violet-500 text-white shadow-[0_0_18px_rgba(129,92,246,.55)]'
                : 'bg-violet-500/20 text-violet-300'
            }`}
            aria-label={voice.listening ? 'Stop listening' : 'Speak to Grace'}
          >
            <Mic size={18} />
          </button>
        )}
        <button
          type="submit"
          disabled={!input.trim() || chat.loading}
          className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-violet-600 text-white disabled:opacity-40"
          aria-label="Send"
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  onExecute,
  onDismiss,
}: {
  message: GraceMessage;
  onExecute: (actionId: string) => void;
  onDismiss: (actionId: string) => void;
}) {
  const isUser = message.role === 'user';
  const pendingActions = (message.actions ?? []).filter((a) => !a.dismissed);
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className="max-w-[85%] space-y-2">
        <div
          className={
            isUser
              ? 'rounded-2xl rounded-br-md bg-violet-600 text-white px-3.5 py-2.5 text-sm'
              : `${surface} rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-slate-100`
          }
        >
          {renderContent(message.content)}
        </div>
        {pendingActions.map((instance) => (
          <div key={instance.id} className={`${surface} p-3 space-y-2`}>
            <p className="text-xs font-medium text-slate-200">
              {instance.action.title || instance.action.taskTitle || instance.action.content || 'Proposed action'}
            </p>
            {instance.executed ? (
              <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                <Check size={13} /> Done
              </p>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onExecute(instance.id)}
                  className="flex-1 h-8 rounded-lg bg-violet-600 text-white text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Check size={13} /> Do it
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(instance.id)}
                  className="h-8 px-3 rounded-lg bg-white/[0.06] text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <X size={13} /> Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
