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
  greeting?: string;
  prefill?: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export function DidStudioModal({ leader, companion, open, greeting, prefill, onClose }: DidStudioModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [agentMounted, setAgentMounted] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [agentTimedOut, setAgentTimedOut] = useState(false);
  const [mountNonce, setMountNonce] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const seededRef = useRef(false);
  const photo = leader.photo ?? getLeaderPhoto(leader.id) ?? '/leaders/james-wilson.jpg';

  const hasDidCredentials = Boolean(companion.didAgentId && companion.didClientKey);
  // Stable per-leader id for the D-ID Frame embed's data-target-id. The
  // embed script looks this element up by id and renders into it directly
  // — appending the <script> as a child of the host div (the previous
  // approach) isn't enough on its own; without data-target-id the widget
  // falls back to its own floating placement instead of filling this
  // container, which is what showed up as a stray, wrongly-sized preview.
  const targetId = `did-agent-target-${leader.id}`;

  const injectAgent = useCallback(() => {
    if (!hasDidCredentials || !hostRef.current) return;
    const host = hostRef.current;
    host.innerHTML = '';
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://agent.d-id.com/v2/index.js';
    script.setAttribute('data-mode', 'full');
    script.setAttribute('data-client-key', companion.didClientKey!);
    script.setAttribute('data-agent-id', companion.didAgentId!);
    script.setAttribute('data-name', 'did-agent');
    script.setAttribute('data-monitor', 'true');
    script.setAttribute('data-target-id', targetId);
    host.appendChild(script);
    // Bump the nonce so the readiness/timeout watcher (re)starts for this mount.
    setAgentReady(false);
    setAgentTimedOut(false);
    setMountNonce(n => n + 1);
  }, [companion.didAgentId, companion.didClientKey, hasDidCredentials, targetId]);

  const mountDidAgent = useCallback(() => {
    if (agentMounted) return;
    injectAgent();
    setAgentMounted(true);
  }, [agentMounted, injectAgent]);

  const retryAgent = useCallback(() => {
    injectAgent();
  }, [injectAgent]);

  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      setAgentMounted(false);
      setAgentReady(false);
      setAgentTimedOut(false);
      if (hostRef.current) hostRef.current.innerHTML = '';
      return;
    }

    const greetingText = greeting?.trim() || companion.greeting?.trim();
    if (!seededRef.current && greetingText) {
      setMessages([{ id: 'greeting', role: 'ai', text: greetingText }]);
      seededRef.current = true;
    }

    mountDidAgent();

    if (prefill?.trim()) {
      setInput(prefill.trim());
    }
  }, [open, greeting, companion.greeting, mountDidAgent, prefill]);

  // Turn an infinite "Loading…" into an escapable state. The D-ID agent is
  // "up" once it renders a <video>. If that never happens — most commonly a
  // restrictive network (VPN/firewall) blocking the WebRTC media stream, since
  // the agent config, client key, and streams API are all verified healthy —
  // surface a retry + open-in-new-tab fallback instead of spinning forever.
  useEffect(() => {
    if (!open || !hasDidCredentials || mountNonce === 0) return;
    const findVideo = () =>
      (hostRef.current?.closest('.ai-did-media')?.querySelector('video')
        ?? document.querySelector('.didagent_target video')) as HTMLVideoElement | null;
    pollRef.current = window.setInterval(() => {
      const v = findVideo();
      if (v && v.readyState >= 1) {
        setAgentReady(true);
        if (pollRef.current) window.clearInterval(pollRef.current);
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      }
    }, 800);
    timeoutRef.current = window.setTimeout(() => {
      setAgentTimedOut(true);
      if (pollRef.current) window.clearInterval(pollRef.current);
    }, 18000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [open, hasDidCredentials, mountNonce]);

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
          : 'Avatar session is in preview mode. Configure avatar credentials to enable live conversation.',
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
        <div className="ai-did-title-bar" id="did-studio-title">
          {/* div, not span — .ai-did-title-bar span is the status-chip style */}
          <div>
            Chat · {leader.displayName}
            {leader.isVerified && (
              <span className="did-verified-badge">✓ Verified Leader</span>
            )}
          </div>
          <span>
            <span className="pulse-live-dot" />
            {hasDidCredentials ? 'Live Avatar' : 'Preview'}
          </span>
        </div>
        {/*
          Once the real D-ID agent is credentialed, its embedded frame is
          the entire conversation surface (video + its own input/mic) — the
          quick-prompt buttons, voice-dots, and side chat below were a
          stand-in for that and become fake/misleading duplicate UI once a
          real agent is live, so they're preview-only (!hasDidCredentials).
          The grid collapses to one column in that case (see
          .ai-did-studio--live in did-studio.css) so the real frame gets
          full width instead of being squeezed next to an empty column.
        */}
        <div className={`ai-did-studio${hasDidCredentials ? ' ai-did-studio--live' : ''}`}>
          <div className="ai-did-media">
            <div className="ai-did-media-bg" aria-hidden="true" />
            <div className="ai-did-agent-host" id={targetId} ref={hostRef} />
            <img
              className={`ai-did-avatar${agentMounted ? ' ai-did-avatar--hidden' : ''}`}
              src={photo}
              alt={leader.displayName}
            />
            {hasDidCredentials && agentTimedOut && !agentReady && (
              <div
                style={{
                  position: 'absolute', inset: 0, zIndex: 5,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
                  background: 'rgba(15,23,42,0.92)', color: '#e2e8f0',
                }}
              >
                <p style={{ fontWeight: 600, fontSize: 14 }}>
                  The live avatar is taking longer than usual to connect.
                </p>
                <p style={{ fontSize: 12, color: '#94a3b8', maxWidth: 320, lineHeight: 1.5 }}>
                  This usually means the video stream is blocked by the network (a VPN
                  or firewall). {leader.displayName.split(' ').slice(-1)[0]}’s agent is
                  configured correctly — try again, or open it in a new tab.
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={retryAgent}
                    style={{
                      padding: '8px 14px', borderRadius: 8, background: '#4f46e5',
                      color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                  {companion.divinityAvatarUrl && (
                    <a
                      href={companion.divinityAvatarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#a5b4fc', fontSize: 13 }}
                    >
                      Open in a new tab →
                    </a>
                  )}
                </div>
              </div>
            )}
            {!hasDidCredentials && (
              <>
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
                <div className="ai-did-controls">
                  <div className="ai-did-voice-dots" aria-hidden="true">
                    <span style={{ height: 6 }} />
                    <span style={{ height: 12, animationDelay: '0.1s' }} />
                    <span style={{ height: 8, animationDelay: '0.2s' }} />
                    <span style={{ height: 14, animationDelay: '0.3s' }} />
                    <span style={{ height: 6, animationDelay: '0.4s' }} />
                  </div>
                </div>
              </>
            )}
          </div>
          {!hasDidCredentials && (
            <div className="ai-did-chat-panel">
              <div className="ai-did-empty">
                <p className="mb-2">Avatar credentials are not configured for this leader.</p>
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
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
