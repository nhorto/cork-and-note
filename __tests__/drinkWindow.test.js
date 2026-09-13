import { aiService } from '../lib/ai';
import { drinkWindowAI, estimateDrinkWindow } from '../lib/drinkWindow';

jest.mock('../lib/ai', () => ({
  aiService: {
    sendMessage: jest.fn(),
    parseDrinkWindow: jest.fn(),
  },
}));
jest.mock('../lib/cellar', () => ({
  peakYear: (from, by) => Math.round(from + (by - from) * (2 / 3)),
}));

describe('estimateDrinkWindow', () => {
  test('uses a conservative structured-red range anchored to vintage', () => {
    expect(estimateDrinkWindow({ vintage: '202-should-not-parse', varietal: 'Cabernet Sauvignon' }, 2026))
      .toEqual(expect.objectContaining({ drink_from: 2026, drink_by: 2037 }));

    expect(estimateDrinkWindow({ vintage: '2020', varietal: 'Cabernet Sauvignon' }, 2026))
      .toEqual(expect.objectContaining({ drink_from: 2024, drink_by: 2031, peak: 2029 }));
  });

  test('keeps fresh white styles short', () => {
    expect(estimateDrinkWindow({ vintage: 2024, varietal: 'Sauvignon Blanc' }, 2026))
      .toEqual(expect.objectContaining({ drink_from: 2024, drink_by: 2028 }));
  });
});

describe('drinkWindowAI.suggest', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns a usable local proposal when the endpoint fails', async () => {
    aiService.sendMessage.mockRejectedValue(new Error('Gateway Timeout'));

    const result = await drinkWindowAI.suggest({ vintage: 2020, varietal: 'Cabernet Sauvignon' });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      fallback: true,
      warning: 'Gateway Timeout',
      window: expect.objectContaining({ drink_from: 2024, drink_by: 2031 }),
    }));
  });

  test('returns a usable local proposal when the response cannot be parsed', async () => {
    aiService.sendMessage.mockResolvedValue({ response: 'I forgot the JSON.' });
    aiService.parseDrinkWindow.mockReturnValue(null);

    const result = await drinkWindowAI.suggest({ vintage: 2023, wine_type: 'red' });

    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.window.drink_by).toBeGreaterThanOrEqual(result.window.drink_from);
  });
});
