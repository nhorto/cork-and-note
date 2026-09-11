// lib/directions.js: the maps links a "Directions" button opens.
//
// Kept out of the screen so the one rule that matters can be tested without
// rendering it: a place with no coordinates has no directions. A hand-added
// winery can be saved without a pin, and interpolating its null latitude used
// to open Apple Maps at "ll=null,null".
import { Linking, Platform } from 'react-native';

/**
 * Primary and fallback URLs for turn-by-turn directions to a place, or null
 * when the place has no usable coordinates.
 */
export function directionsUrls({ latitude, longitude, name } = {}, os = Platform.OS) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (latitude == null || longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const label = encodeURIComponent(name || 'Destination');
  if (os === 'ios') {
    return {
      primary: `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`,
      fallback: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  }
  return {
    primary: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    fallback: `https://maps.google.com/?q=${lat},${lng}`,
  };
}

/** True when a Directions button should be offered for this place at all. */
export function hasDirections(place) {
  return directionsUrls(place) !== null;
}

/** Open directions in the platform's maps app, falling back to a web map. */
export async function openDirections(place) {
  const urls = directionsUrls(place);
  if (!urls) return false;
  try {
    await Linking.openURL(urls.primary);
  } catch {
    await Linking.openURL(urls.fallback);
  }
  return true;
}
