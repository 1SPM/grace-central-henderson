import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_VOICE_ID,
  isTtsConfigured,
  ttsHealthPayload,
} from './grace-tts.js';

describe('grace-tts', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.GRACE_TTS_UPSTREAM_URL;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('reports not configured when no key or upstream', () => {
    expect(isTtsConfigured()).toBe(false);
    expect(ttsHealthPayload()).toEqual({
      ok: false,
      provider: 'elevenlabs',
      voice: DEFAULT_VOICE_ID,
    });
  });

  it('reports configured when ELEVENLABS_API_KEY is set', () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    expect(isTtsConfigured()).toBe(true);
    expect(ttsHealthPayload().ok).toBe(true);
    expect(ttsHealthPayload().provider).toBe('elevenlabs');
  });

  it('reports configured when GRACE_TTS_UPSTREAM_URL is set', () => {
    process.env.GRACE_TTS_UPSTREAM_URL = 'https://example.com/api/grace/tts';
    expect(isTtsConfigured()).toBe(true);
  });

  it('uses ELEVENLABS_VOICE_ID override in health payload', () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    process.env.ELEVENLABS_VOICE_ID = 'custom-voice-id';
    expect(ttsHealthPayload().voice).toBe('custom-voice-id');
  });
});

describe('grace-tts API routes', () => {
  const dispatcherSource = readFileSync(
    join(process.cwd(), 'api/[...path].ts'),
    'utf8',
  );

  it('registers canonical and legacy portal TTS paths', () => {
    for (const route of [
      "'grace/tts'",
      "'grace/tts/health'",
      "'grace-tts'",
      "'grace-tts/health'",
    ]) {
      expect(dispatcherSource).toContain(route);
    }
  });
});
