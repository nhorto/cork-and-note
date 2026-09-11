import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { aiService } from '../lib/ai';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/cellar', () => ({ cellarService: {} }));
jest.mock('../lib/visits', () => ({ visitsService: {} }));
jest.mock('../lib/aiConsent', () => ({}));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({ readAsStringAsync: jest.fn(), EncodingType: { Base64: 'base64' } }));
beforeEach(() => { jest.restoreAllMocks(); ImageManipulator.manipulateAsync.mockReset().mockResolvedValue({ base64: 'jpeg-bytes' }); });

it.each([[3024, 4032, { height: 1568 }], [4032, 3024, { width: 1568 }]])('preserves card aspect ratio at %i x %i', async (w, h, resize) => {
  jest.spyOn(Image, 'getSize').mockImplementation((uri, success) => success(w, h));
  expect(await aiService.photoToBase64('card.heic', { maxEdge: 1568 })).toEqual({ base64: 'jpeg-bytes', mediaType: 'image/jpeg' });
  expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith('card.heic', [{ resize }], { compress: .8, format: 'jpeg', base64: true });
});

it('converts a small HEIC photo without upscaling it', async () => {
  jest.spyOn(Image, 'getSize').mockImplementation((uri, success) => success(640, 800));
  await aiService.photoToBase64('small.HEIC', { maxEdge: 1568 });
  expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith('small.HEIC', [], expect.any(Object));
});

it('does not mislabel unconverted HEIC data as JPEG', async () => {
  jest.spyOn(Image, 'getSize').mockImplementation((uri, success) => success(640, 800));
  ImageManipulator.manipulateAsync.mockResolvedValue({});
  await expect(aiService.photoToBase64('small.HEIC')).resolves.toBeNull();
  expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
});
