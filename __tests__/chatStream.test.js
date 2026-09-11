import { createNdjsonParser, streamEdgeFunction } from '../lib/chatStream';

test('the NDJSON parser preserves events split across arbitrary network chunks', () => {
  const events = [];
  const push = createNdjsonParser((event) => events.push(event));
  push('{"type":"delta","text":"Bon');
  push('jour"}\n{"type":"del');
  push('ta","text":"!"}\n');
  push('{"type":"done","response":"Bonjour!"}', true);
  expect(events).toEqual([
    { type: 'delta', text: 'Bonjour' },
    { type: 'delta', text: '!' },
    { type: 'done', response: 'Bonjour!' },
  ]);
});

class FakeXhr {
  headers = {};
  responseText = '';
  status = 0;
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  send(body) { this.body = JSON.parse(body); }
  abort() {}
}

test('the React Native transport emits growing text before the request completes', async () => {
  const xhr = new FakeXhr();
  const updates = [];
  const resultPromise = streamEdgeFunction({
    url: 'https://example.supabase.co',
    anonKey: 'anon',
    accessToken: 'jwt',
    body: { messages: [{ role: 'user', content: 'Pairing?' }] },
    onDelta: (text) => updates.push(text),
    xhrFactory: () => xhr,
  });

  expect(xhr.body.stream).toBe(true);
  xhr.status = 200;
  xhr.responseText = '{"type":"delta","text":"Try "}\n';
  xhr.onprogress();
  expect(updates).toEqual(['Try ']);
  xhr.responseText += '{"type":"delta","text":"Muscadet."}\n';
  xhr.onprogress();
  expect(updates).toEqual(['Try ', 'Try Muscadet.']);
  xhr.responseText += '{"type":"done","response":"Try Muscadet.","sources":[]}\n';
  xhr.onload();

  await expect(resultPromise).resolves.toMatchObject({ response: 'Try Muscadet.' });
  expect(xhr.headers.Authorization).toBe('Bearer jwt');
});

test('a pre-stream HTTP refusal keeps the server error code for paywall routing', async () => {
  const xhr = new FakeXhr();
  const resultPromise = streamEdgeFunction({
    url: 'https://example.supabase.co', anonKey: 'anon', accessToken: 'jwt', body: {},
    xhrFactory: () => xhr,
  });
  xhr.status = 402;
  xhr.responseText = JSON.stringify({ error: 'Free limit reached', code: 'free_limit_reached' });
  xhr.onload();
  await expect(resultPromise).rejects.toMatchObject({
    message: 'Free limit reached', code: 'free_limit_reached',
  });
});

test('a legacy Edge Function JSON response completes as one streamed update', async () => {
  const xhr = new FakeXhr();
  const updates = [];
  const resultPromise = streamEdgeFunction({
    url: 'https://example.supabase.co',
    anonKey: 'anon',
    accessToken: 'jwt',
    body: { messages: [{ role: 'user', content: 'Pairing?' }] },
    onDelta: (text) => updates.push(text),
    xhrFactory: () => xhr,
  });

  xhr.status = 200;
  xhr.responseText = JSON.stringify({
    response: 'Try Muscadet.',
    sources: [],
    meter: { task: 'chat', used: 1 },
  });
  xhr.onload();

  await expect(resultPromise).resolves.toMatchObject({ response: 'Try Muscadet.' });
  expect(updates).toEqual(['Try Muscadet.']);
});

test('a legacy handled JSON error is not reported as an unexpected ending', async () => {
  const xhr = new FakeXhr();
  const resultPromise = streamEdgeFunction({
    url: 'https://example.supabase.co', anonKey: 'anon', accessToken: 'jwt', body: {},
    xhrFactory: () => xhr,
  });

  xhr.status = 200;
  xhr.responseText = JSON.stringify({ error: 'Service temporarily unavailable', code: 'service_error' });
  xhr.onload();

  await expect(resultPromise).rejects.toMatchObject({
    message: 'Service temporarily unavailable', code: 'service_error',
  });
});
