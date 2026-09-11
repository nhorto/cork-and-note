// Exercise the actual Edge handler with mocked auth/database and provider I/O.
const mockInsert = jest.fn();
const mockGetUser = jest.fn();
const mockRead = jest.fn();
const mockFrom = jest.fn(() => {
  const query = {};
  for (const name of ['select', 'gte', 'eq', 'maybeSingle']) query[name] = jest.fn(() => query);
  query.then = (resolve, reject) => Promise.resolve(mockRead()).then(resolve, reject);
  query.insert = mockInsert;
  return query;
});
jest.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => ({
  auth: { getUser: mockGetUser }, from: mockFrom,
}) }), { virtual: true });

let handler;
const originalDeno = global.Deno;
const originalFetch = global.fetch;
const env = { GEMINI_API_KEY: 'google-test', ANTHROPIC_API_KEY: 'anthropic-test' };
beforeAll(() => {
  global.Deno = { env: { get: (name) => env[name] }, serve: (fn) => { handler = fn; } };
  require('../supabase/functions/chat/index.ts');
});
afterAll(() => { global.Deno = originalDeno; global.fetch = originalFetch; });
beforeEach(() => {
  mockFrom.mockClear(); mockInsert.mockReset().mockResolvedValue({ error: null });
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
  mockRead.mockReset().mockReturnValue({ data: { is_pro: true }, count: 0, error: null });
  env.GEMINI_API_KEY = 'google-test'; env.ANTHROPIC_API_KEY = 'anthropic-test';
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"wines":[]}' }] } }],
    usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 10, thoughtsTokenCount: 20 },
  }) });
});
const scan = { task: 'tasting_menu_scan', ai_sharing_version: 2, messages: [
  { role: 'user', content: 'Read this card', images: [{ base64: 'image' }] },
] };
const dispatch = (body = scan, auth = true) => handler(new Request('https://test/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test' } : {}) }, body: JSON.stringify(body),
}));

it('dispatches Gemini without an Anthropic key and records the shared scan meter', async () => {
  delete env.ANTHROPIC_API_KEY;
  const response = await dispatch();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ response: '```tasting_menu\n{"wines":[]}\n```', sources: [],
    usage: { input_tokens: 500, output_tokens: 30, web_searches: 0 }, meter: { task: 'label_scan', used: 1 } });
  expect(global.fetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ task: 'label_scan', output_tokens: 30, web_searches: null }));
});

it('blocks older consent, missing photos, and unauthenticated calls before provider I/O', async () => {
  expect((await dispatch({ ...scan, ai_sharing_version: 1 })).status).toBe(428);
  expect((await dispatch({ ...scan, messages: [{ role: 'user', content: 'Read' }] })).status).toBe(400);
  expect((await dispatch(scan, false)).status).toBe(401);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(mockInsert).not.toHaveBeenCalled();
});

it('fails closed on unreadable entitlement data and exhausted free scans', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockRead.mockReturnValue({ error: { message: 'unavailable' } });
  expect((await dispatch()).status).toBe(503);
  mockRead.mockReturnValue({ data: { is_pro: false }, count: 3, error: null });
  expect((await dispatch()).status).toBe(402);
  expect(global.fetch).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

it('records a truncated paid attempt but never returns partial wines', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"wines":[' }] } }],
    usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 8192 },
  }) });
  const response = await dispatch();
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining('Crop'), meter: { task: 'label_scan', used: 1 } });
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ output_tokens: 8192 }));
});

it('keeps text recommendations on Anthropic even when Google is unavailable', async () => {
  delete env.GEMINI_API_KEY;
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'A recommendation' }],
    stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 20 } }) });
  const response = await dispatch({ task: 'wine_list_pick', messages: [{ role: 'user', content: 'Choose from these wines' }] });
  expect(response.status).toBe(200);
  expect(global.fetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).model).toBe('claude-sonnet-4-6');
  expect(await response.json()).toMatchObject({ response: 'A recommendation' });
});
