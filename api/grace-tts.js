/**
 * Vercel serverless proxy — ElevenLabs TTS for GRACE Companion.
 * Keeps ELEVENLABS_API_KEY server-side; never expose to the browser.
 *
 * POST /api/grace-tts  { "text": "..." }  -> audio/mpeg
 * GET  /api/grace-tts/health             -> { ok, provider }
 */

const MAX_TEXT_LEN = 800;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — warm, calm female
const DEFAULT_MODEL_ID = 'eleven_flash_v2_5';

function corsHeaders(origin) {
  const allowed =
    !origin ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    /\.vercel\.app$/i.test(origin) ||
    /github\.io$/i.test(origin) ||
    /1spm\.github\.io$/i.test(origin) ||
    /^https:\/\/(www\.)?gracecrm-centralhenderson\.org$/i.test(origin) ||
    /^https:\/\/(www\.)?grace-crm\.dev$/i.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendJson(res, status, body, origin) {
  res.statusCode = status;
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || '';

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v));
    res.end();
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, { ok: true, provider: 'elevenlabs' }, origin);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' }, origin);
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { error: 'TTS not configured' }, origin);
    return;
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch (e) {
    sendJson(res, 400, { error: 'Invalid JSON body' }, origin);
    return;
  }

  const text = String(body.text || '').trim();
  if (!text) {
    sendJson(res, 400, { error: 'Missing text' }, origin);
    return;
  }
  if (text.length > MAX_TEXT_LEN) {
    sendJson(res, 400, { error: 'Text too long' }, origin);
    return;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;

  try {
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
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.78,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elRes.ok) {
      const detail = await elRes.text().catch(() => '');
      console.error('ElevenLabs error', elRes.status, detail.slice(0, 200));
      sendJson(res, 502, { error: 'TTS provider error' }, origin);
      return;
    }

    const buffer = Buffer.from(await elRes.arrayBuffer());
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  } catch (err) {
    console.error('grace-tts proxy error', err.message);
    sendJson(res, 502, { error: 'TTS request failed' }, origin);
  }
};
