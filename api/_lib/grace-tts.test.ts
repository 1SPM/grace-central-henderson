import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_STABILITY,
  DEFAULT_STYLE,
  DEFAULT_VOICE_ID,
  MAX_TTS_TEXT_LEN,
  isTtsConfigured,
  ttsHealthPayload,
  voiceSettings,
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

  it('allows long-form speech chunks up to 1200 chars', () => {
    expect(MAX_TTS_TEXT_LEN).toBe(1200);
  });
});

describe('grace-tts voice settings', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    delete process.env.ELEVENLABS_STABILITY;
    delete process.env.ELEVENLABS_STYLE;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('defaults to the natural-delivery tuning', () => {
    const settings = voiceSettings();
    expect(settings.stability).toBe(DEFAULT_STABILITY);
    expect(settings.style).toBe(DEFAULT_STYLE);
    expect(settings.use_speaker_boost).toBe(true);
  });

  it('honors env overrides', () => {
    process.env.ELEVENLABS_STABILITY = '0.6';
    process.env.ELEVENLABS_STYLE = '0.2';
    const settings = voiceSettings();
    expect(settings.stability).toBe(0.6);
    expect(settings.style).toBe(0.2);
  });

  it('clamps env overrides to 0–1 and ignores garbage', () => {
    process.env.ELEVENLABS_STABILITY = '5';
    process.env.ELEVENLABS_STYLE = 'not-a-number';
    const settings = voiceSettings();
    expect(settings.stability).toBe(1);
    expect(settings.style).toBe(DEFAULT_STYLE);
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
