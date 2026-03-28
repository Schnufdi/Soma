// api/chat.js — BodyLens AI proxy
// API key lives server-side in Vercel env vars — never in the browser.
// Hardened: model whitelist, token cap, per-IP rate limit, origin check.

const ALLOWED_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-5',
];
const MAX_TOKENS_HARD_CAP = 4000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;  // 1 minute
const RATE_LIMIT_MAX       = 20;         // requests per IP per minute
const ALLOWED_ORIGINS = [
  'https://soma-two-chi.vercel.app',
  'https://bodylens.app',               // future custom domain
  'http://localhost:3000',              // local dev
  'http://localhost:5173',
];

// In-memory rate limiter (resets on cold start — good enough for serverless)
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count++;
  }

  rateLimitStore.set(ip, entry);

  // Prune old entries every 100 requests to prevent unbounded growth
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) {
      if (now - v.windowStart > RATE_LIMIT_WINDOW_MS * 2) rateLimitStore.delete(k);
    }
  }

  return entry.count <= RATE_LIMIT_MAX;
}

export default async function handler(req, res) {

  // ── Origin check ────────────────────────────────────────
  const origin = req.headers['origin'] || '';
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || origin === '';
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!isAllowedOrigin) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // ── Rate limit ──────────────────────────────────────────
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || req.socket?.remoteAddress
          || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Slow down.' });
  }

  // ── API key ─────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // ── Input validation ────────────────────────────────────
  const { model, max_tokens, messages, system, stream, ...rest } = req.body || {};

  if (!model || !ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({
      error: `Model not allowed. Use one of: ${ALLOWED_MODELS.join(', ')}`
    });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Cap tokens server-side regardless of what client sends
  const safeTokens = Math.min(
    typeof max_tokens === 'number' && max_tokens > 0 ? max_tokens : 500,
    MAX_TOKENS_HARD_CAP
  );

  // Build clean, validated request body
  const safeBody = {
    model,
    max_tokens: safeTokens,
    messages,
    ...(system !== undefined && { system }),
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(safeBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return res.status(response.status).json({ error: data?.error?.message || 'API error' });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
}
