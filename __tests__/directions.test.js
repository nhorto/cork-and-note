// A Directions button must never open the maps app at "null,null".
import { Linking } from 'react-native';
import { directionsUrls, hasDirections, openDirections } from '../lib/directions';

const estate = { latitude: 38.17, longitude: -78.28, name: 'Barboursville Vineyards' };

test('builds the platform links for a place with coordinates', () => {
  expect(directionsUrls(estate, 'ios')).toEqual({
    primary: 'http://maps.apple.com/?ll=38.17,-78.28&q=Barboursville%20Vineyards',
    fallback: 'https://www.google.com/maps/search/?api=1&query=38.17,-78.28',
  });
  expect(directionsUrls(estate, 'android')).toEqual({
    primary: 'https://www.google.com/maps/dir/?api=1&destination=38.17,-78.28',
    fallback: 'https://maps.google.com/?q=38.17,-78.28',
  });
  expect(directionsUrls({ ...estate, name: null }, 'ios').primary).toContain('q=Destination');
});

test.each([
  ['no coordinates at all', {}],
  ['null coordinates from a hand-added winery', { latitude: null, longitude: null, name: 'Somewhere' }],
  ['only one coordinate', { latitude: 38.1, longitude: null }],
  ['coordinates that are not numbers', { latitude: 'abc', longitude: 'def' }],
  ['no place', undefined],
])('offers nothing for a place with %s', (_, place) => {
  expect(directionsUrls(place, 'ios')).toBeNull();
  expect(hasDirections(place)).toBe(false);
});

test('coordinates stored as strings still work', () => {
  expect(directionsUrls({ latitude: '38.17', longitude: '-78.28' }, 'android').primary).toContain('destination=38.17,-78.28');
});

test('openDirections tries the maps app, falls back to the web map, and refuses without coordinates', async () => {
  const open = jest.spyOn(Linking, 'openURL');
  open.mockResolvedValueOnce(true);
  expect(await openDirections(estate)).toBe(true);
  expect(open).toHaveBeenCalledTimes(1);

  open.mockRejectedValueOnce(new Error('no handler')).mockResolvedValueOnce(true);
  expect(await openDirections(estate)).toBe(true);
  expect(open).toHaveBeenCalledTimes(3);
  expect(open.mock.calls[2][0]).toMatch(/^https:\/\//);

  open.mockClear();
  expect(await openDirections({ latitude: null, longitude: null })).toBe(false);
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

test('a place that has not loaded yet (null or undefined) has no directions instead of throwing', () => {
  expect(directionsUrls(null, 'ios')).toBeNull();
  expect(directionsUrls(undefined, 'ios')).toBeNull();
  expect(hasDirections(null)).toBe(false);
});
