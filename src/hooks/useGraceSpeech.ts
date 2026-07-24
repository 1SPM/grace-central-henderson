import { useState, useCallback, useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('grace-speech');

const TTS_URL = '/api/grace/tts';
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
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0) throw new Error('TTS empty response');
      return buffer;
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
      const isPlayError = err instanceof DOMException
        && (err.name === 'NotAllowedError' || err.name === 'NotSupportedError');
      if (isPlayError) {
        log.warn('ElevenLabs audio playback blocked', err.name);
        return;
      }
      if (!fallbackLoggedRef.current) {
        fallbackLoggedRef.current = true;
        log.info('ElevenLabs unavailable, using browser speech');
      }
      speakBrowser(text, messageId);
    }
  }, [browserSupported, cleanupAudio, speakBrowser]);

  const speak = useCallback((text: string, messageId?: string) => {
    if (!text.trim()) return;
    if (provider === 'elevenlabs') {
      void speakElevenLabs(text, messageId);
    } else if (browserSupported) {
      speakBrowser(text, messageId);
    }
  }, [provider, browserSupported, speakElevenLabs, speakBrowser]);

  const supported = provider !== 'none';

  return { speak, stop, isSpeaking, speakingId, supported, provider };
}
