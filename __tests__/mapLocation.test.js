import * as Location from 'expo-location';
import { getMapLocation } from '../lib/mapLocation';
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
}));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('returns the actual fix and clears the timeout', async () => {
  const fix = { coords: { latitude: 38, longitude: -78 } };
  Location.getCurrentPositionAsync.mockResolvedValueOnce(fix);
  await expect(getMapLocation()).resolves.toEqual(fix);
  expect(jest.getTimerCount()).toBe(0);
});

test('stops waiting when the simulator never returns a location', async () => {
  Location.getCurrentPositionAsync.mockReturnValueOnce(new Promise(() => {}));
  const result = expect(getMapLocation()).rejects.toThrow('Location timed out');
  await jest.advanceTimersByTimeAsync(10000);
  await result;
  expect(jest.getTimerCount()).toBe(0);
});

test('propagates unavailable location without inventing coordinates', async () => {
  Location.getCurrentPositionAsync.mockRejectedValueOnce(new Error('Unavailable'));
  await expect(getMapLocation()).rejects.toThrow('Unavailable');
  expect(jest.getTimerCount()).toBe(0);
});
