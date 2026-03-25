// api/tts.js
// Vercel serverless function — proxies text to ElevenLabs TTS.
// ELEVENLABS_API_KEY lives in Vercel Environment Variables (never in browser).
//
// SETUP (one-time):
//   Vercel dashboard → Your project → Settings → Environment Variables
//   Add: ELEVENLABS_API_KEY = your key   (mark as Secret)
//   Redeploy for it to take effect.

// ── Voice selection ─────────────────────────────────────────────
// Two documentary-grade male voices chosen for a health/performance podcast.
//
// Adam  — ElevenLabs flagship deep American male. Rich baritone, authoritative
//          without being cold. Used by major podcast productions. Dr. Alex role.
//
// Josh  — Warm, conversational American male. Slightly younger energy, curious
//          tone. Perfect for the engaged-listener host role (Sven).
//
const VOICE_MAP = {
  dr:  'pNInz6obpgDQGcFmaJgB',   // Adam   — authoritative, documentary-grade
  you: 'TxGEqnHWrfWFTfGW9XjX',   // Josh   — warm, conversational
};

// Fallbacks if above voices aren't on the account tier
const FALLBACK_MAP = {
  dr:  'onwK4e9ZLuTAKqWW03F9',   // Daniel — British, measured
  you: 'N2lVS1w4EtoT3dr4eOWO',   // Callum — engaging
};

// Voice settings tuned per speaker role
const VOICE_SETTINGS = {
  dr: {
    stability:        0.58,   // measured, consistent
    similarity_boost: 0.82,
    style:            0.12,   // authoritative without being theatrical
    use_speaker_boost: true,
  },
  you: {
    stability:        0.42,   // more expressive, natural variation
    similarity_boost: 0.78,
    style:            0.28,   // conversational warmth
    use_speaker_boost: true,
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ElevenLabs API key not configured.',
      hint:  'Add ELEVENLABS_API_KEY to Vercel Environment Variables and redeploy.'
    });
  }

  let body;
  try {
    body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { text, speaker, voice_id } = body || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text field is required' });
  }

  // Resolve voice
  const spk = speaker || 'dr';
  const resolvedVoiceId = voice_id || VOICE_MAP[spk] || VOICE_MAP.dr;
  const settings = VOICE_SETTINGS[spk] || VOICE_SETTINGS.dr;

  async function callElevenLabs(voiceId) {
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key':   apiKey,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text:           text.trim(),
        model_id:       'eleven_multilingual_v2',
        voice_settings: settings,
      }),
    });
    return resp;
  }

  try {
    let elevenResp = await callElevenLabs(resolvedVoiceId);

    // If primary voice fails, try fallback
    if (!elevenResp.ok && (elevenResp.status === 400 || elevenResp.status === 404)) {
      const fallbackId = FALLBACK_MAP[spk] || FALLBACK_MAP.dr;
      elevenResp = await callElevenLabs(fallbackId);
    }

    if (!elevenResp.ok) {
      const errText = await elevenResp.text();
      return res.status(elevenResp.status).json({
        error:  'ElevenLabs API error',
        status: elevenResp.status,
        detail: errText.slice(0, 300),
      });
    }

    // Stream audio back to browser
    const audioBuffer = await elevenResp.arrayBuffer();
    res.setHeader('Content-Type',  'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch(e) {
    console.error('TTS error:', e);
    return res.status(500).json({ error: 'TTS request failed', detail: e.message });
  }
}
