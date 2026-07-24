/**
 * ElevenLabs TTS proxy — shared by Vercel handlers and local Express dev server.
 * Keeps ELEVENLABS_API_KEY server-side; never expose to the browser.
 */

export const MAX_TTS_TEXT_LEN = 1200;
export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — warm, calm female
export const DEFAULT_MODEL_ID = 'eleven_flash_v2_5';

// Delivery defaults: lower stability lets intonation vary naturally; higher
// style adds warmth. Both tunable via env without a redeploy.
export const DEFAULT_STABILITY = 0.45;
export const DEFAULT_STYLE = 0.35;

function envTuning(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

export function voiceSettings() {
  return {
    stability: envTuning('ELEVENLABS_STABILITY', DEFAULT_STABILITY),
    similarity_boost: 0.75,
    style: envTuning('ELEVENLABS_STYLE', DEFAULT_STYLE),
    use_speaker_boost: true,
  };
}

export function isTtsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY || process.env.GRACE_TTS_UPSTREAM_URL);
}

function upstreamTtsUrl(): string | null {
  const raw = process.env.GRACE_TTS_UPSTREAM_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

export function ttsHealthPayload() {
  return {
    ok: isTtsConfigured(),
    provider: 'elevenlabs' as const,
    voice: process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
  };
}

export async function probeTtsHealth(): Promise<ReturnType<typeof ttsHealthPayload>> {
  if (process.env.ELEVENLABS_API_KEY) {
    return ttsHealthPayload();
  }
  const upstream = upstreamTtsUrl();
  if (!upstream) {
    return { ...ttsHealthPayload(), ok: false };
  }
  try {
    const res = await fetch(`${upstream}/health`, { method: 'GET' });
    if (!res.ok) return { ...ttsHealthPayload(), ok: false };
    const j = await res.json() as { ok?: boolean; voice?: string };
    return {
      ok: Boolean(j.ok),
      provider: 'elevenlabs',
      voice: j.voice || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
    };
  } catch {
    return { ...ttsHealthPayload(), ok: false };
  }
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    const upstream = upstreamTtsUrl();
    if (upstream) {
      const res = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        throw new Error(`TTS upstream error (${res.status})`);
      }
      return Buffer.from(await res.arrayBuffer());
    }
    throw new Error('TTS not configured');
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: voiceSettings(),
      }),
    },
  );

  if (!elRes.ok) {
    const detail = await elRes.text().catch(() => '');
    console.error('ElevenLabs error', elRes.status, detail.slice(0, 200));
    throw new Error(`TTS provider error (${elRes.status})`);
  }

  return Buffer.from(await elRes.arrayBuffer());
}
