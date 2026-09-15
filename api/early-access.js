/* global Buffer */
const { createHmac } = require('node:crypto');

const SUPPORT = 'cork_and_note@yahoo.com';

// Plain-text acknowledgement for the applicant. Android testing copy switches to
// install steps once EARLY_ACCESS_ANDROID_JOIN_URL is configured, so the same
// deployment serves both "saved, wait for us" and "join now" without a code change.
function acknowledgement({ platform, interest }) {
  const joinUrl = process.env.EARLY_ACCESS_ANDROID_JOIN_URL;
  const groupUrl = process.env.EARLY_ACCESS_ANDROID_GROUP_URL;
  const footer = [
    '',
    'Your journal is free. Pro is optional, and the store shows the price and renewal terms before any purchase.',
    '',
    'Questions or want to withdraw your request? Just reply to this email.',
    '',
    'Cheers,',
    'Nick',
    'Cork & Note',
  ];
  if (interest === 'launch') {
    return {
      subject: `You're on the Cork & Note launch list`,
      text: [
        `Thanks for your interest in Cork & Note!`,
        '',
        `We'll email you as soon as Cork & Note is available for your ${platform}. There is nothing to do until then.`,
        ...footer,
      ].join('\n'),
    };
  }
  if (platform === 'Android' && joinUrl) {
    return {
      subject: 'Your Cork & Note Android early access is ready',
      text: [
        'Thanks for helping shape Cork & Note! Your Android early access is ready.',
        '',
        ...(groupUrl ? [`1. Join our tester group so Google Play recognizes you (one tap, same Google Account you used for this request): ${groupUrl}`, `2. Then open this link on your Android phone and tap "Become a tester": ${joinUrl}`, '3. Follow the Google Play link to install Cork & Note.', '4. Open the app and create your Cork & Note account. It is separate from Google Play.']
          : [`1. Open this link on your Android phone, signed in to Google with the email you used for this request, and tap "Become a tester": ${joinUrl}`, '2. Follow the Google Play link to install Cork & Note.', '3. Open the app and create your Cork & Note account. It is separate from Google Play.']),
        '',
        'Please stay opted in for at least 14 consecutive days and use the app on a few different days. Start with a wine you already know: add a note or rating, try the cellar and the map, and tell us what felt useful or confusing through Profile > Feedback in the app. No need to buy or drink wine to take part.',
        '',
        'If Google Play says the app is unavailable, check that the selected Google Account matches the one you used here, then reply to this email and we will sort it out.',
        ...footer,
      ].join('\n'),
    };
  }
  if (platform === 'Android') {
    return {
      subject: 'We have your Cork & Note Android early-access request',
      text: [
        'Thanks for requesting Android early access to Cork & Note!',
        '',
        `We've saved your request. Here's what happens next:`,
        '',
        `1. We'll email your Google Play invitation and installation steps as soon as your place is ready. There is nothing to install or pay for yet.`,
        '2. When you join, please stay opted in to the closed test for at least 14 consecutive days and use the app on a few different days.',
        '3. Tell us what helped and what felt confusing through Profile > Feedback in the app, or by replying to this email.',
        ...footer,
      ].join('\n'),
    };
  }
  return {
    subject: 'We have your Cork & Note iPhone early-access request',
    text: [
      'Thanks for requesting iPhone early access to Cork & Note!',
      '',
      `We've saved your request. We'll email a TestFlight invitation and installation steps when your place is ready. Cork & Note is also headed to the App Store; if the public release lands first, we'll send you the App Store link instead.`,
      ...footer,
    ].join('\n'),
  };
}

// Applicant acknowledgement + owner alert, sent only for a newly stored request.
// Failures are swallowed: the request is already saved, and the site must never
// tell someone their signup failed because email did not go out.
async function notify({ email, platform, interest, commitment, attribution, dedupe }) {
  const apiKey = process.env.EARLY_ACCESS_RESEND_KEY;
  const from = process.env.EARLY_ACCESS_FROM;
  if (!apiKey || !from) return;
  const send = (payload, key) => fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ from, reply_to: SUPPORT, ...payload }),
  }).catch(() => null);
  const jobs = [send({ to: [email], ...acknowledgement({ platform, interest }) }, `ea-ack-${dedupe}`)];
  const owner = process.env.EARLY_ACCESS_OWNER_EMAIL;
  if (owner) {
    const label = attribution.utm_content || attribution.utm_campaign || 'direct';
    jobs.push(send({
      to: [owner],
      subject: `New early-access request: ${platform} / ${interest}`,
      text: [
        `A new ${platform} ${interest === 'testing' ? 'testing' : 'launch-news'} request was saved on corkandnote.com.`,
        '',
        `Email: ${email}`,
        `Platform: ${platform}`,
        `Interest: ${interest}`,
        `14-day commitment: ${commitment ? 'yes' : 'n/a'}`,
        `Campaign label: ${label}`,
        `Saved: ${new Date().toISOString()}`,
        '',
        'They received an automatic acknowledgement. Full roster: node scripts/export-early-access.mjs',
      ].join('\n'),
    }, `ea-owner-${dedupe}`));
  }
  await Promise.allSettled(jobs);
}

// Same-origin website endpoint. Credentials and the private roster stay server-side.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status, body) => res.status(status).json(body);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405, { error: 'Please use the signup form.' });
  }
  const host = req.headers.host;
  const allowed = new Set(['https://corkandnote.com', 'https://www.corkandnote.com', 'https://cork-and-note.vercel.app', 'https://cork-and-note-sigma.vercel.app']);
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
    if (result === 'duplicate') return reply(200, { ok: true });
    if (result !== 'accepted') throw new Error('storage');
    await notify({ email, platform: body.platform, interest: body.interest,
      commitment: body.platform === 'Android' && body.interest === 'testing',
      attribution, dedupe: hash(`${email}|${body.platform}|${body.interest}`).slice(0, 32) });
    return reply(200, { ok: true });
  } catch {
    // Never log submitted contact information, credentials or upstream response bodies.
    return reply(503, { error: 'We could not save your request. Please try again shortly or contact support.' });
  }
};
