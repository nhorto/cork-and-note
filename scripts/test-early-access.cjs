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
