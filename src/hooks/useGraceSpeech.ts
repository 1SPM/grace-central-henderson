import { useState, useCallback, useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('grace-speech');

const TTS_URL = '/api/grace/tts';
const TTS_HEALTH_URL = '/api/grace/tts/health';

export type GraceVoiceProvider = 'elevenlabs' | 'browser' | 'none';

/** Strip markdown and URLs so TTS reads naturally. */
export function stripForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/[#*_`~]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
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
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {
        // ignore
      }
      objectUrlRef.current = null;
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

    const spoken = stripForSpeech(text);
    if (!spoken) return;

    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'en-US';
    utterance.rate = 1.02;
    utterance.pitch = 1.05;

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
    const spoken = stripForSpeech(text);
    if (!spoken) return;

    cleanupAudio();
    if (browserSupported) {
      window.speechSynthesis.cancel();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spoken }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);

      const buffer = await res.arrayBuffer();
      const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg';
      const blob = new Blob([buffer], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      const audio = new Audio(objectUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setSpeakingId(messageId ?? null);
      };
      const done = () => {
        cleanupAudio();
        setIsSpeaking(false);
        setSpeakingId(null);
      };
      audio.onended = done;
      audio.onerror = done;

      await audio.play();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      cleanupAudio();
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
