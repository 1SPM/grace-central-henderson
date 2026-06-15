import { useState, useCallback, useEffect, useRef } from 'react';

/** Strip markdown and URLs so TTS reads naturally. */
export function stripForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/[#*_`~]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find(v => v.lang.startsWith('en') && /samantha|karen|zira|female|victoria|moira/i.test(v.name))
    ?? voices.find(v => v.lang.startsWith('en-US'))
    ?? voices.find(v => v.lang.startsWith('en'))
  );
}

export function useGraceSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback((text: string, messageId?: string) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingId(null);

    const utterance = new SpeechSynthesisUtterance(stripForSpeech(text));
    utterance.lang = 'en-US';
    const voice = pickEnglishVoice(voicesRef.current);
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingId(null);
    };

    // Chrome can drop speak() if called in the same tick as cancel()
    window.setTimeout(() => {
      setIsSpeaking(true);
      setSpeakingId(messageId ?? null);
      window.speechSynthesis.speak(utterance);
    }, 60);
  }, [supported]);

  return { speak, stop, isSpeaking, speakingId, supported };
}
