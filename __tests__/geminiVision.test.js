import {
  AI_SHARING_VERSION, VISION_MODEL, buildGeminiVisionRequest, isVisionTask,
  parseGeminiVisionResponse, requestGeminiVision, visionConsentRequired,
} from '../supabase/functions/_shared/geminiVision.ts';
import { AI_SHARING_VERSION as CLIENT_CONSENT_VERSION } from '../lib/aiConsent';
import { gateAiRequest, normalizeTask } from '../supabase/functions/_shared/entitlements.ts';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const wine = { wine_name: 'Reserve', producer: 'Example', vintage: '2023', wine_type: 'Red', varietal: null, region: null };
const raw = (value, finishReason = 'STOP') => ({
  candidates: [{ finishReason, content: { parts: [{ text: 'private reasoning', thought: true }, { text: JSON.stringify(value) }] } }],
  usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 200, thoughtsTokenCount: 40 },
});

it('routes only explicit scan tasks and requires renewed provider consent', () => {
  expect(CLIENT_CONSENT_VERSION).toBe(AI_SHARING_VERSION);
  for (const task of ['label_scan', 'tasting_menu_scan', 'wine_list_scan']) {
    expect(isVisionTask(task)).toBe(true);
    for (const version of [undefined, 1, '2']) expect(visionConsentRequired(task, version)).toBe(true);
    expect(visionConsentRequired(task, AI_SHARING_VERSION)).toBe(false);
  }
  for (const task of ['chat', 'wine_list_pick', 'taste_report', 'trip_plan', '__proto__', undefined]) {
    expect(isVisionTask(task)).toBe(false);
    expect(visionConsentRequired(task)).toBe(false);
  }
});

it('shares the existing free and daily scan limits for tasting cards', () => {
  expect(normalizeTask('tasting_menu_scan')).toBe('label_scan');
  const request = { nowMs: Date.now(), task: 'tasting_menu_scan', hasImages: true,
    entitlement: null, counts: { burst: 0, day: 0, window: 2 } };
  expect(gateAiRequest(request)).toMatchObject({ allowed: true, task: 'label_scan' });
  expect(gateAiRequest({ ...request, counts: { burst: 0, day: 0, window: 3 } })).toMatchObject({ allowed: false, status: 402 });
  expect(gateAiRequest({ ...request, entitlement: { is_pro: true }, counts: { burst: 0, day: 30, window: 0 } })).toMatchObject({ allowed: false, status: 429 });
});

it('preserves ordered images and model roles with high detail and a larger card budget', () => {
  const request = buildGeminiVisionRequest('tasting_menu_scan', [
    { role: 'assistant', content: 'Ready' },
    { role: 'user', content: 'Read both', images: [{ base64: 'one', mediaType: 'image/png' }, { base64: 'two' }] },
  ], 'Server safety rules', 'Card instructions');
  expect(request.contents[0].role).toBe('model');
  expect(request.contents[1].parts).toEqual([{ text: 'Read both' },
    { inlineData: { mimeType: 'image/png', data: 'one' } }, { inlineData: { mimeType: 'image/jpeg', data: 'two' } }]);
  expect(request.generationConfig).toMatchObject({ maxOutputTokens: 8192,
    responseMimeType: 'application/json', mediaResolution: 'MEDIA_RESOLUTION_HIGH', thinkingConfig: { thinkingLevel: 'low' } });
  expect(request.systemInstruction.parts[0].text).toBe('Server safety rules');
  expect(request.tools).toBeUndefined();
});

it.each([
  ['label_scan', wine, 'cellar_label'],
  ['tasting_menu_scan', { wines: [wine, wine] }, 'tasting_menu'],
  ['wine_list_scan', { entries: [{ entry_id: 'e1', page_index: 0, producer: null, wine_name: 'Reserve', vintage: null,
    price_minor: 1250, currency: 'USD', serving: 'glass', uncertain_fields: [] }], notes: null }, 'wine_list'],
])('adapts %s to the existing app parser contract and includes billed reasoning', (task, value, fence) => {
  const result = parseGeminiVisionResponse(task, raw(value));
  expect(result).toEqual({ response: '```' + fence + '\n' + JSON.stringify(value) + '\n```', inputTokens: 1200, outputTokens: 240 });
});

it('does not leak partial, blocked, malformed, or schema-invalid extraction results', () => {
  const broken = raw({ wines: [wine] });
  broken.candidates[0].content.parts = [{ text: '{"wines":[' }];
  for (const value of [raw({ wines: [wine] }, 'MAX_TOKENS'), raw({ wines: [wine] }, 'SAFETY'), broken,
    raw({ wines: [{ wine_name: 'Only a name' }] }), raw({ wines: [{ ...wine, vintage: 2023 }] }),
    raw({ wines: [wine], unexpected: true }), raw({ wines: Array(25).fill(wine) }),
    { promptFeedback: { blockReason: 'SAFETY' } }]) {
    expect(parseGeminiVisionResponse('tasting_menu_scan', value)).toMatchObject({ response: '', status: 502, error: expect.any(String) });
  }
  expect(parseGeminiVisionResponse('tasting_menu_scan', raw({ wines: [] })).error).toBeUndefined();
});

it('uses the server key only in a header and makes one bounded call without retries', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => raw({ wines: [wine] }) });
  await expect(requestGeminiVision('tasting_menu_scan', [{ role: 'user', images: [{ base64: 'photo' }] }], 'floor', 'prompt', 'secret-test', fetcher)).resolves.toMatchObject({ outputTokens: 240 });
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toContain('/' + VISION_MODEL + ':generateContent');
  expect(url).not.toContain('secret-test');
  expect(options.headers['x-goog-api-key']).toBe('secret-test');
  expect(options.body).not.toContain('secret-test');
  expect(options.signal).toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('sanitizes rate limits and transport failures without exposing provider bodies', async () => {
  for (const [fetcher, status] of [
    [jest.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'private upstream detail' }), 429],
    [jest.fn().mockResolvedValue({ ok: false, status: 403 }), 502],
    [jest.fn().mockRejectedValue(new Error('secret-test')), 502],
  ]) {
    const result = await requestGeminiVision('label_scan', [], '', '', 'secret-test', fetcher);
    expect(result).toMatchObject({ status, response: '' });
    expect(JSON.stringify(result)).not.toMatch(/private upstream|secret-test/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});

it('keeps the list schema within provider limits while enforcing the row cap locally', () => {
  const request = buildGeminiVisionRequest('wine_list_scan', [], '', '');
  expect(request.generationConfig.responseJsonSchema.properties.entries.maxItems).toBeUndefined();
  const entry = { entry_id: 'e1', page_index: 0, producer: null, wine_name: 'Reserve', vintage: null,
    price_minor: 1250, currency: 'USD', serving: 'glass', uncertain_fields: [] };
  expect(parseGeminiVisionResponse('wine_list_scan', raw({ entries: Array(41).fill(entry), notes: null }))).toMatchObject({ response: '', status: 502 });
});
