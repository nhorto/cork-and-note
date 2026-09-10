import * as Location from 'expo-location';

// A simulator (or a device indoors) may never return a GPS fix. Stop waiting
// without substituting the map's default center for the person's location.
export async function getMapLocation(timeoutMs = 10000) {
  let timer;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Location timed out')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
