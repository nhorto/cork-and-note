// Boundary tests for the public signup endpoint; no network or real contacts.
const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/early-access');
const valid = { email: 'Tester@Example.com', platform: 'Android', interest: 'testing', adult: true, consent: true, commitment: true };
async function request(body = valid, headers = {}, method = 'POST') {
  const result = { headers: {} };
  const res = { setHeader(k, v) { result.headers[k] = v; }, status(code) { result.code = code; return this; }, json(value) { result.body = value; return this; } };
  await handler({ method, headers: { host: 'cork-and-note-sigma.vercel.app', origin: 'https://cork-and-note-sigma.vercel.app', 'content-type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.1', ...headers }, body }, res);
  return result;
}
test('public endpoint rejects unconsented, cross-origin and malformed requests before storage', async () => {
  const old = global.fetch; let calls = 0; global.fetch = async () => { calls++; throw Error('must not call'); };
  try {
    for (const body of [{ ...valid, commitment: false }, { ...valid, consent: false }, { ...valid, adult: false }, { ...valid, email: 'not-email' }, { ...valid, platform: 'Unknown' }, null, []]) assert.equal((await request(body)).code, 400);
    assert.equal((await request(valid, { origin: 'https://attacker.example' })).code, 403);
    assert.equal((await request(valid, { origin: undefined })).code, 403);
    assert.equal((await request(valid, { 'content-type': 'text/plain' })).code, 415);
    assert.equal((await request(valid, {}, 'GET')).code, 405);
    assert.equal((await request('x'.repeat(5000))).code, 413);
    assert.equal((await request({ ...valid, website: 'spam' })).code, 200);
    assert.equal(calls, 0);
  } finally { global.fetch = old; }
});
test('signup only succeeds after durable acceptance, minimizes attribution and hashes rate identifiers', async () => {
  process.env.EARLY_ACCESS_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EARLY_ACCESS_SERVICE_KEY = 'unit-test-key';
  process.env.EARLY_ACCESS_HASH_SECRET = 'unit-test-salt';
  const old = global.fetch; let payload;
  try {
    global.fetch = async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => 'accepted' }; };
    assert.equal((await request({ ...valid, attribution: { utm_source: 'facebook', utm_content: 'private@example.com', fbclid: 'unused' } })).code, 200);
    assert.equal(payload.p_email, 'tester@example.com');
    assert.deepEqual(payload.p_attribution, { utm_source: 'facebook' });
    assert.match(payload.p_ip_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(payload.p_ip_hash, payload.p_email_hash);
    assert.equal((await request({ ...valid, interest: 'launch', commitment: false })).code, 200);
    assert.equal(payload.p_commitment, false);
    assert.equal((await request({ ...valid, platform: 'iPhone', commitment: false })).code, 200);
    global.fetch = async () => ({ ok: true, json: async () => 'rate_limited' });
    assert.equal((await request()).code, 429);
    global.fetch = async () => ({ ok: false });
    assert.equal((await request()).code, 503);
    global.fetch = async () => { throw Error('private upstream data'); };
    const failed = await request();
    assert.equal(failed.code, 503);
    assert.ok(!JSON.stringify(failed).includes('private upstream data'));
    delete process.env.EARLY_ACCESS_SERVICE_KEY;
    assert.equal((await request()).code, 503);
  } finally { global.fetch = old; }
});
test('a new request sends one acknowledgement and one owner alert; duplicates and email failures stay silent 200s', async () => {
  process.env.EARLY_ACCESS_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EARLY_ACCESS_SERVICE_KEY = 'unit-test-key';
  process.env.EARLY_ACCESS_HASH_SECRET = 'unit-test-salt';
  process.env.EARLY_ACCESS_RESEND_KEY = 'unit-test-resend';
  process.env.EARLY_ACCESS_FROM = 'Cork & Note <hello@example.com>';
  process.env.EARLY_ACCESS_OWNER_EMAIL = 'owner@example.com';
  delete process.env.EARLY_ACCESS_ANDROID_JOIN_URL;
  const old = global.fetch; let sends = [];
  const fake = (rpcResult, emailOk = true) => async (url, options) => {
    if (String(url).includes('resend.com')) { sends.push({ headers: options.headers, body: JSON.parse(options.body) }); if (!emailOk) throw Error('resend down'); return { ok: true, json: async () => ({ id: 'x' }) }; }
    return { ok: true, json: async () => rpcResult };
  };
  try {
    global.fetch = fake('accepted');
    assert.equal((await request({ ...valid, attribution: { utm_content: '01_journal_feed' } })).code, 200);
    assert.equal(sends.length, 2);
    const ack = sends.find(s => s.body.to[0] === 'tester@example.com');
    const alert = sends.find(s => s.body.to[0] === 'owner@example.com');
    assert.match(ack.body.subject, /Android early-access request/);
    assert.match(ack.body.text, /installation steps as soon as your place is ready/);
    assert.equal(ack.body.reply_to, 'cork_and_note@yahoo.com');
    assert.ok(!alert.body.subject.includes('tester@example.com'), 'no address in the alert subject');
    assert.match(alert.body.text, /tester@example.com/);
    assert.match(alert.body.text, /01_journal_feed/);
    assert.notEqual(ack.headers['Idempotency-Key'], alert.headers['Idempotency-Key']);
    sends = []; global.fetch = fake('duplicate');
    assert.equal((await request()).code, 200);
    assert.equal(sends.length, 0, 'duplicates send nothing');
    sends = []; global.fetch = fake('accepted', false);
    assert.equal((await request()).code, 200, 'email outage never fails a saved signup');
    sends = []; global.fetch = fake('accepted');
    assert.equal((await request({ ...valid, interest: 'launch', commitment: false })).code, 200);
    assert.match(sends.find(s => s.body.to[0] === 'tester@example.com').body.subject, /launch list/);
    process.env.EARLY_ACCESS_ANDROID_JOIN_URL = 'https://play.google.com/apps/testing/com.example';
    sends = [];
    assert.equal((await request()).code, 200);
    const ready = sends.find(s => s.body.to[0] === 'tester@example.com');
    assert.match(ready.body.subject, /early access is ready/);
    assert.match(ready.body.text, /Become a tester/);
    sends = []; delete process.env.EARLY_ACCESS_RESEND_KEY;
    assert.equal((await request()).code, 200);
    assert.equal(sends.length, 0, 'unconfigured email is a no-op');
  } finally { global.fetch = old; delete process.env.EARLY_ACCESS_ANDROID_JOIN_URL; }
});
