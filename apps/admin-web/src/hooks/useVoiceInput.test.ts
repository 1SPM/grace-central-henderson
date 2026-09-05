import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceInput } from './useVoiceInput';

class MockRecognition {
  lang = '';
  interimResults = false;
  continuous = false;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.onend?.();
  });
}

describe('useVoiceInput', () => {
  let lastInstance: MockRecognition | null = null;

  beforeEach(() => {
    lastInstance = null;
    vi.stubGlobal('SpeechRecognition', class {
      constructor() {
        lastInstance = new MockRecognition();
        return lastInstance;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported when no SpeechRecognition constructor exists', () => {
    vi.unstubAllGlobals();
    const { result } = renderHook(() => useVoiceInput(() => {}));
    expect(result.current.supported).toBe(false);
  });

  it('reports supported when the browser exposes SpeechRecognition', () => {
    const { result } = renderHook(() => useVoiceInput(() => {}));
    expect(result.current.supported).toBe(true);
  });

  it('sets listening true on start and calls the recognizer', () => {
    const { result } = renderHook(() => useVoiceInput(() => {}));
    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    expect(lastInstance!.start).toHaveBeenCalledTimes(1);
  });

  it('never captures or forwards audio — onresult only ever receives a transcript string', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onTranscript));
    act(() => result.current.start());
    act(() => lastInstance!.onresult?.({ results: [[{ transcript: 'call the Riveras' }]] }));
    expect(onTranscript).toHaveBeenCalledWith('call the Riveras');
    expect(onTranscript).toHaveBeenCalledTimes(1);
  });

  it('joins multiple result segments with a space', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onTranscript));
    act(() => result.current.start());
    act(() => lastInstance!.onresult?.({ results: [[{ transcript: 'hello' }], [{ transcript: 'world' }]] }));
    expect(onTranscript).toHaveBeenCalledWith('hello world');
  });

  it('does not call onTranscript for an empty/whitespace-only result', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onTranscript));
    act(() => result.current.start());
    act(() => lastInstance!.onresult?.({ results: [[{ transcript: '   ' }]] }));
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('sets listening false when recognition ends', () => {
    const { result } = renderHook(() => useVoiceInput(() => {}));
    act(() => result.current.start());
    act(() => lastInstance!.onend?.());
    expect(result.current.listening).toBe(false);
  });

  it('sets listening false on a recognition error', () => {
    const { result } = renderHook(() => useVoiceInput(() => {}));
    act(() => result.current.start());
    act(() => lastInstance!.onerror?.());
    expect(result.current.listening).toBe(false);
  });

  it('stop() calls the recognizer stop and clears listening', () => {
    const { result } = renderHook(() => useVoiceInput(() => {}));
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(lastInstance!.stop).toHaveBeenCalledTimes(1);
    expect(result.current.listening).toBe(false);
  });
});
