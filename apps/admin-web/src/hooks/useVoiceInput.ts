/**
 * Browser-native speech-to-text (the Web Speech API) — extracted from
 * AskGrace.tsx so any surface can offer voice dictation, not just the chat
 * box. See DECISIONS.md ADR-013.
 *
 * Deliberately NOT a GRACE integration: no audio is captured, buffered, or
 * sent anywhere by this code. The browser's own recognizer (Chrome/Safari/
 * Edge) does the listening and hands back a transcript string — this hook
 * never sees, and could not forward, the audio itself. That's what makes
 * this safe to reuse outside the one place it already shipped, and why it
 * is not subject to the "no model integration yet" limit ADR-013 places on
 * a real (server-side) transcription provider.
 */
import { useState, useRef, useCallback } from 'react';

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

export function useVoiceInput(onTranscript: (text: string) => void) {
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
    rec.onerror = () => {
      setListening(false);
      console.warn('[voice input] Speech recognition error — allow mic in browser settings or check Permissions-Policy.');
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
