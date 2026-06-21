/**
 * GET /api/grace-tts/health — probe for GRACE Companion voice auto-detect.
 */
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

module.exports = function handler(req, res) {
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v));
    res.end();
    return;
  }

  const configured = !!process.env.ELEVENLABS_API_KEY;
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v));
  res.statusCode = configured ? 200 : 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      ok: configured,
      provider: 'elevenlabs',
      voice: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
    })
  );
};
