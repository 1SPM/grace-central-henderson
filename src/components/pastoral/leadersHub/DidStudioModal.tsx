import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LeaderProfile } from '../../../types';
import type { LeaderCompanionConfig } from '../../../config/centralHendersonLeaders';
import { getLeaderPhoto } from '../../../config/centralHendersonLeaders';
import '../../../styles/did-studio.css';

interface DidStudioModalProps {
  leader: LeaderProfile;
  companion: LeaderCompanionConfig;
  open: boolean;
  prefill?: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export function DidStudioModal({ leader, companion, open, prefill, onClose }: DidStudioModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [agentMounted, setAgentMounted] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const photo = leader.photo ?? getLeaderPhoto(leader.id) ?? '/leaders/james-wilson.jpg';

  const hasDidCredentials = Boolean(companion.didAgentId && companion.didClientKey);

  const mountDidAgent = useCallback(() => {
    if (!hasDidCredentials || agentMounted || !hostRef.current) return;
    const host = hostRef.current;
    host.innerHTML = '';
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://agent.d-id.com/v2/index.js';
    script.setAttribute('data-mode', 'full');
    script.setAttribute('data-agent-id', companion.didAgentId!);
    script.setAttribute('data-client-key', companion.didClientKey!);
    host.appendChild(script);
    setAgentMounted(true);
  }, [agentMounted, companion.didAgentId, companion.didClientKey, hasDidCredentials]);

  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      setAgentMounted(false);
      if (hostRef.current) hostRef.current.innerHTML = '';
      return;
    }

    if (!seededRef.current && companion.greeting) {
      setMessages([{ id: 'greeting', role: 'ai', text: companion.greeting }]);
      seededRef.current = true;
    }

    mountDidAgent();

    if (prefill?.trim()) {
      setInput(prefill.trim());
    }
  }, [open, companion.greeting, mountDidAgent, prefill]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages(prev => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text },
      {
        id: `a-${Date.now()}`,
        role: 'ai',
        text: hasDidCredentials
          ? 'Thank you for sharing. I\'m here with you — let\'s walk through this together in prayer and scripture.'
          : 'Avatar session is in preview mode. Configure D-ID agent credentials to enable live conversation.',
      },
    ]);
  };

  if (!open) return null;

  return createPortal(
    <div
      className="did-studio-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="did-studio-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="did-studio-modal">
        <button type="button" className="did-studio-close" onClick={onClose} aria-label="Close conversation">
          ×
        </button>
        <div className="ai-did-studio">
          <div className="ai-did-media">
            <div className="ai-did-media-bg" aria-hidden="true" />
            <div className="ai-did-agent-host" ref={hostRef} />
            <img
              className={`ai-did-avatar${agentMounted ? ' ai-did-avatar--hidden' : ''}`}
              src={photo}
              alt={leader.displayName}
            />
            {hasDidCredentials && (
              <div className="ai-did-prompts">
                <button
                  type="button"
                  className="ai-did-prompt"
                  onClick={() => {
                    setInput('I need help with a problem I\'m facing');
                    setTimeout(sendMessage, 50);
                  }}
                >
                  I need help with a problem I&apos;m facing
                </button>
                <button
                  type="button"
                  className="ai-did-prompt"
                  onClick={() => {
                    setInput('I am confused on a Bible passage');
                    setTimeout(sendMessage, 50);
                  }}
                >
                  I am confused on a Bible passage
                </button>
              </div>
            )}
            <div className="ai-did-controls">
              <div className="ai-did-voice-dots" aria-hidden="true">
                <span style={{ height: 6 }} />
                <span style={{ height: 12, animationDelay: '0.1s' }} />
                <span style={{ height: 8, animationDelay: '0.2s' }} />
                <span style={{ height: 14, animationDelay: '0.3s' }} />
                <span style={{ height: 6, animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
          <div className="ai-did-chat-panel">
            <div className="ai-did-chat-head" id="did-studio-title">
              Chat · {leader.displayName}
              <span>
                <span className="pulse-live-dot" />
                {hasDidCredentials ? 'D-ID Studio' : 'Preview'}
              </span>
            </div>
            {!hasDidCredentials ? (
              <div className="ai-did-empty">
                <p className="mb-2">D-ID agent credentials are not configured for this leader.</p>
                {companion.divinityAvatarUrl && (
                  <a
                    href={companion.divinityAvatarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    Open Divinity avatar session →
                  </a>
                )}
              </div>
            ) : (
              <div className="ai-did-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`did-msg did-msg--${msg.role}`}>
                    {msg.role === 'ai' && (
                      <img className="did-msg-av" src={photo} alt="" />
                    )}
                    <div className="did-msg-bubble-wrap">
                      <div className="did-msg-bubble">{msg.text}</div>
                      <div className="did-msg-time">Just now</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="ai-did-input-bar">
              <input
                className="ai-did-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your message here…"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button type="button" className="ai-did-send" onClick={sendMessage} aria-label="Send">
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
