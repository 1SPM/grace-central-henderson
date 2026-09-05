import { useState, useCallback, useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('grace-speech');

const TTS_URL = '/api/grace/tts';

/**
 * A spoken answer is several chunked POSTs fired back to back. One of them
 * can meet a transient the function never sees — Vercel's edge returned a
 * 503 on the first chunk of the first answer in the 2026-09-04 browser
 * rehearsal, in the minute a new deployment took the production alias, while
 * every invocation that ran logged 200. Without this, that single chunk sent
 * the WHOLE reply to the robotic browser voice with an "unavailable" notice.
 * Retry once on a 5xx or a network error; never on a 4xx (401/429 mean
 * something, and a retry would just repeat it).
 */
export const TTS_RETRY = { attempts: 2, delayMs: 500 } as const;

export function isRetriableTtsFailure(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (typeof status === 'number') return status >= 500;
  return err instanceof TypeError; // fetch's "Failed to fetch"
}

export async function withTtsRetry<T>(
  attempt: () => Promise<T>,
  opts: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const attempts = opts.attempts ?? TTS_RETRY.attempts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (!isRetriableTtsFailure(err) || i === attempts - 1) throw err;
      await sleep(opts.delayMs ?? TTS_RETRY.delayMs);
    }
  }
  throw lastErr;
}
const TTS_HEALTH_URL = '/api/grace/tts/health';

export type GraceVoiceProvider = 'elevenlabs' | 'browser' | 'none';

/** Strip markdown and URLs so TTS reads naturally. */
export function stripForSpeech(text: string): string {
  return text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/[#*_`~]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MAX_SPEECH_CHUNK = 1200;

/** Connectors used to weave list items into narrative — never counting words. */
const WEAVE_CONNECTORS = ['Also, ', 'And ', 'Then there is '];

function ensureTerminalPunctuation(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed) return '';
  return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function lowerFirst(text: string): string {
  // Keep acronyms and proper-noun-looking phrases (e.g. names) intact.
  if (!text) return text;
  const first = text[0];
  if (!/[A-Z]/.test(first)) return text;
  const words = text.split(/\s+/);
  if (words[0].length > 1 && words[0] === words[0].toUpperCase()) return text;
  if (words[1] && /^[A-Z]/.test(words[1])) return text;
  return first.toLowerCase() + text.slice(1);
}

/**
 * Compose text for the spoken voice: weave bullet/numbered lists into flowing
 * narrative sentences (the "Anti-List Rule"), soften dashes into commas, and
 * make sure every sentence ends with punctuation so pacing stays even.
 * Runs after stripForSpeech, before TTS.
 */
export function composeSpeechText(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems.map(item => item.trim()).filter(Boolean);
    listItems = [];
    if (items.length === 0) return;
    const totalLen = items.reduce((n, s) => n + s.length, 0);
    if (items.length === 1) {
      output.push(ensureTerminalPunctuation(items[0]));
    } else if (totalLen <= 120) {
      // Short items read naturally as one comma-joined sentence.
      const joined = items.length === 2
        ? `${items[0].replace(/[.!?]$/, '')} and ${lowerFirst(items[1].replace(/[.!?]$/, ''))}`
        : `${items.slice(0, -1).map(s => s.replace(/[.!?]$/, '')).join(', ')}, and ${lowerFirst(items[items.length - 1].replace(/[.!?]$/, ''))}`;
      output.push(ensureTerminalPunctuation(joined));
    } else {
      // Longer items become their own sentences, woven with soft connectors.
      items.forEach((item, i) => {
        const sentence = ensureTerminalPunctuation(item);
        if (i === 0) {
          output.push(sentence);
        } else {
          const connector = WEAVE_CONNECTORS[(i - 1) % WEAVE_CONNECTORS.length];
          output.push(connector + lowerFirst(sentence));
        }
      });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const listMatch = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      continue;
    }
    flushList();
    if (!line) continue;
    // Drop shouty label prefixes ("STATUS:", "NOTE:") that read robotically.
    const withoutLabel = line.replace(/^[A-Z][A-Z _-]{2,}:\s*/, '');
    output.push(ensureTerminalPunctuation(withoutLabel));
  }
  flushList();

  return output
    .join(' ')
    .replace(/\s[—–]\s|—|–/g, ', ')
    .replace(/\s&\s/g, ' and ')
    .replace(/\bw\/\s?/gi, 'with ')
    // Clock times: ":00" is read digit-by-digit by TTS ("two oh-oh"). On the
    // hour the minutes carry nothing — drop them before an am/pm ("2:00 p.m."
    // → "2 p.m."), otherwise say o'clock. Non-zero minutes already read fine.
    .replace(/\b(\d{1,2}):00(?=\s*[ap]\.?m\.?\b)/gi, '$1')
    .replace(/\b(\d{1,2}):00\b/g, "$1 o'clock")
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

/** Split composed speech at sentence boundaries into chunks TTS can handle. */
export function splitSpeechChunks(text: string, maxLen: number = MAX_SPEECH_CHUNK): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  const sentences = trimmed.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [trimmed];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxLen) {
      chunks.push(current.trim());
      current = '';
    }
    if (sentence.length > maxLen) {
      // A single run-on sentence longer than the limit: hard-split on words.
      let rest = sentence.trim();
      while (rest.length > maxLen) {
        const cut = rest.lastIndexOf(' ', maxLen);
        const idx = cut > 0 ? cut : maxLen;
        chunks.push(rest.slice(0, idx).trim());
        rest = rest.slice(idx).trim();
      }
      current = rest ? `${rest} ` : '';
      continue;
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find(v => v.lang.startsWith('en') && /samantha|karen|zira|female|victoria|moira|google us english/i.test(v.name))
    ?? voices.find(v => v.lang.startsWith('en-US'))
    ?? voices.find(v => v.lang.startsWith('en'))
  );
}

function primeSpeechSynthesis(): void {
  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();
}

export function useGraceSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [provider, setProvider] = useState<GraceVoiceProvider>('none');
  // Transient, user-facing voice status so failures aren't silent:
  //   'busy'        → rate-limited (429), text stays on screen, retry shortly
  //   'unavailable' → neural TTS errored (502/etc); fell back to browser voice
  const [notice, setNotice] = useState<'busy' | 'unavailable' | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fallbackLoggedRef = useRef(false);
  const browserSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    fetch(TTS_HEALTH_URL, { method: 'GET' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j?.ok) setProvider('elevenlabs');
        else if (browserSupported) setProvider('browser');
        else setProvider('none');
      })
      .catch(() => {
        if (browserSupported) setProvider('browser');
        else setProvider('none');
      });
  }, [browserSupported]);

  useEffect(() => {
    if (!browserSupported) return;
    const refreshVoices = () => {
      voicesRef.current = loadVoices();
    };
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    primeSpeechSynthesis();
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
  }, [browserSupported]);

  const flagNotice = useCallback((kind: 'busy' | 'unavailable') => {
    setNotice(kind);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 6000);
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  const cleanupAudio = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // ignore — may already be stopped
      }
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        // ignore
      }
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    cleanupAudio();
    if (browserSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingId(null);
  }, [browserSupported, cleanupAudio]);

  const speakBrowser = useCallback((text: string, messageId?: string) => {
    if (!browserSupported || !text.trim()) return;
    cleanupAudio();
    window.speechSynthesis.cancel();

    const spoken = composeSpeechText(stripForSpeech(text));
    if (!spoken) return;

    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'en-US';
    utterance.rate = 0.98;
    utterance.pitch = 1.0;

    window.setTimeout(() => {
      primeSpeechSynthesis();
      if (voicesRef.current.length === 0) {
        voicesRef.current = loadVoices();
      }
      const voice = pickEnglishVoice(voicesRef.current);
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingId(messageId ?? null);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      };
      utterance.onerror = (event) => {
        log.warn('speech synthesis error', event.error);
        setIsSpeaking(false);
        setSpeakingId(null);
      };

      window.speechSynthesis.speak(utterance);

      window.setTimeout(() => {
        if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 120);
    }, 80);
  }, [browserSupported, cleanupAudio]);

  const speakElevenLabs = useCallback(async (text: string, messageId?: string) => {
    const spoken = composeSpeechText(stripForSpeech(text));
    if (!spoken) return;

    cleanupAudio();
    if (browserSupported) {
      window.speechSynthesis.cancel();
    }

    const session = ++sessionRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchChunk = async (chunk: string): Promise<ArrayBuffer> => {
      // Attach the signed-in user's Clerk token so the server's TTS auth gate
      // passes. The anonymous public demo has no session → no header → the
      // server allows it via demo mode. A token hiccup just means no audio
      // that turn (the text is still on screen), so this is best-effort.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const clerk = (window as unknown as { Clerk?: { session?: { getToken?: (o?: unknown) => Promise<string | null> } } }).Clerk;
        const token = clerk?.session?.getToken
          ? (await clerk.session.getToken({ template: 'supabase' })) ?? (await clerk.session.getToken())
          : null;
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch { /* no session (demo/anonymous) — proceed without a token */ }

      return withTtsRetry(async () => {
        const res = await fetch(TTS_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: chunk }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const e = new Error(`TTS ${res.status}`) as Error & { status?: number };
          e.status = res.status;
          throw e;
        }
        const buffer = await res.arrayBuffer();
        if (buffer.byteLength === 0) throw new Error('TTS empty response');
        return buffer;
      });
    };

    try {
      const chunks = splitSpeechChunks(spoken);
      if (chunks.length === 0) return;

      // Web Audio avoids CSP media-src blob: restrictions on object URLs.
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      let pending: Promise<ArrayBuffer> = fetchChunk(chunks[0]);

      setIsSpeaking(true);
      setSpeakingId(messageId ?? null);

      for (let i = 0; i < chunks.length; i++) {
        const buffer = await pending;
        if (sessionRef.current !== session) return;
        // Prefetch the next chunk while this one plays.
        if (i + 1 < chunks.length) {
          pending = fetchChunk(chunks[i + 1]);
        }

        const decoded = await ctx.decodeAudioData(buffer.slice(0));
        if (sessionRef.current !== session) return;
        const source = ctx.createBufferSource();
        sourceRef.current = source;
        source.buffer = decoded;
        source.connect(ctx.destination);

        await new Promise<void>((resolve, reject) => {
          source.onended = () => {
            sourceRef.current = null;
            resolve();
          };
          source.addEventListener('error', () => {
            sourceRef.current = null;
            reject(new Error('Audio playback failed'));
          }, { once: true });
          if (ctx.state === 'suspended') {
            void ctx.resume();
          }
          source.start(0);
        });
        if (sessionRef.current !== session) return;
      }

      void ctx.close();
      audioContextRef.current = null;
      setIsSpeaking(false);
      setSpeakingId(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      cleanupAudio();
      setIsSpeaking(false);
      setSpeakingId(null);
      // Rate-limited: this is transient and self-heals in a few minutes. Show
      // a "busy" notice and keep the neural voice — don't drop to the robotic
      // browser voice mid-conversation for a momentary throttle.
      if ((err as { status?: number })?.status === 429) {
        flagNotice('busy');
        return;
      }
      // A 503 that survived the retry is still transient by construction:
      // the mount-time health probe already put us on the browser voice if
      // neural TTS were truly unconfigured. Say "busy", keep the neural
      // voice for the next answer, don't read this one in the robotic voice.
      if ((err as { status?: number })?.status === 503) {
        flagNotice('busy');
        return;
      }
      const isPlayError = err instanceof DOMException
        && (err.name === 'NotAllowedError' || err.name === 'NotSupportedError');
      if (isPlayError) {
        log.warn('ElevenLabs audio playback blocked', err.name);
        return;
      }
      // Neural TTS is genuinely unavailable (502/etc): tell the user we're on
      // the browser voice instead of failing silently, then fall back.
      flagNotice('unavailable');
      if (!fallbackLoggedRef.current) {
        fallbackLoggedRef.current = true;
        log.info('ElevenLabs unavailable, using browser speech');
      }
      speakBrowser(text, messageId);
    }
  }, [browserSupported, cleanupAudio, speakBrowser, flagNotice]);

  const speak = useCallback((text: string, messageId?: string) => {
    if (!text.trim()) return;
    if (provider === 'elevenlabs') {
      void speakElevenLabs(text, messageId);
    } else if (browserSupported) {
      speakBrowser(text, messageId);
    }
  }, [provider, browserSupported, speakElevenLabs, speakBrowser]);

  const supported = provider !== 'none';

  return { speak, stop, isSpeaking, speakingId, supported, provider, notice };
}
