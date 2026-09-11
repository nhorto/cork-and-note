import { aiService } from '../lib/ai';
import { cellarScan } from '../lib/cellarScan';
import { parseGeminiVisionResponse } from '../supabase/functions/_shared/geminiVision.ts';
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/cellar', () => ({ cellarService: {} }));
jest.mock('../lib/visits', () => ({ visitsService: {} }));
jest.mock('../lib/aiConsent', () => ({}));
afterEach(() => jest.restoreAllMocks());

it('passes structured Gemini cards through the real app parser using the card task', async () => {
  const wines = ['2022', '2023'].map(vintage => ({ wine_name: 'Reserve', producer: 'Example', vintage,
    wine_type: 'Red', varietal: 'Cabernet Franc', region: null }));
  const adapted = parseGeminiVisionResponse('tasting_menu_scan', { candidates: [{ finishReason: 'STOP',
    content: { parts: [{ text: JSON.stringify({ wines }) }] } }] });
  const send = jest.spyOn(aiService, 'sendMessage').mockResolvedValue(adapted);
  expect(await cellarScan.scanTastingCard({ base64: 'photo' })).toMatchObject({ success: true, count: 2, wines });
  expect(send.mock.calls[0][2]).toEqual({ task: 'tasting_menu_scan' });
});

it('passes structured Gemini labels through the existing cellar prefill parser', async () => {
  const wine = { wine_name: 'Reserve', producer: 'Example', vintage: '2023', wine_type: 'White', varietal: null, region: null };
  const adapted = parseGeminiVisionResponse('label_scan', { candidates: [{ finishReason: 'STOP',
    content: { parts: [{ text: JSON.stringify(wine) }] } }] });
  jest.spyOn(aiService, 'sendMessage').mockResolvedValue(adapted);
  expect(await cellarScan.scanWineLabel({ base64: 'photo' })).toMatchObject({ success: true, fields: wine });
});
