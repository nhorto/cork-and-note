const { createHmac } = require('node:crypto');

// Same-origin website endpoint. Credentials and the private roster stay server-side.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status, body) => res.status(status).json(body);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405, { error: 'Please use the signup form.' });
  }
  const host = req.headers.host;
  const allowed = new Set(['https://cork-and-note.vercel.app', 'https://cork-and-note-sigma.vercel.app']);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV !== 'production' && /^localhost:\d+$/.test(host || '')) allowed.add(`http://${host}`);
  if (!allowed.has(req.headers.origin)) return reply(403, { error: 'Please submit from the Cork & Note website.' });
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(415, { error: 'Invalid request format.' });
  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!raw || Buffer.byteLength(raw) > 4096) return reply(413, { error: 'Request too large.' });
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch { return reply(400, { error: 'Please check the form and try again.' }); }
  if (body.website) return reply(200, { ok: true });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !['Android', 'iPhone'].includes(body.platform)
    || !['testing', 'launch'].includes(body.interest)
    || body.adult !== true || body.consent !== true
    || (body.platform === 'Android' && body.interest === 'testing' && body.commitment !== true)) {
    return reply(400, { error: 'Please enter your email, choose your phone and confirm the required boxes.' });
  }
  const attribution = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = body.attribution?.[key];
    if (typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(value)) attribution[key] = value;
  }
  const url = process.env.EARLY_ACCESS_SUPABASE_URL;
  const key = process.env.EARLY_ACCESS_SERVICE_KEY;
  const salt = process.env.EARLY_ACCESS_HASH_SECRET;
  if (!url || !key || !salt) return reply(503, { error: 'Signup is temporarily unavailable. Please try again shortly or use the support email below.' });
  const hash = value => createHmac('sha256', salt).update(value).digest('hex');
  const ip = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  try {
    const response = await fetch(`${url}/rest/v1/rpc/request_early_access`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_email: email, p_platform: body.platform, p_interest: body.interest,
        p_commitment: body.platform === 'Android' && body.interest === 'testing',
        p_attribution: attribution, p_ip_hash: hash(ip), p_email_hash: hash(email) }),
    });
    if (!response.ok) throw new Error('storage');
    const result = await response.json();
    if (result === 'rate_limited') {
      res.setHeader('Retry-After', '3600');
      return reply(429, { error: 'Too many requests. Please try again later or contact support.' });
    }
    if (result !== 'accepted') throw new Error('storage');
    return reply(200, { ok: true });
  } catch {
    // Never log submitted contact information, credentials or upstream response bodies.
    return reply(503, { error: 'We could not save your request. Please try again shortly or contact support.' });
  }
};
