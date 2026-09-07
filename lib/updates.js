// lib/updates.js — surface OTA updates promptly (§2.3, "adopt expo-updates so
// OTA fixes actually surface").
//
// expo-updates is configured (app.json `updates.url`, runtimeVersion policy
// appVersion) and downloads in the background by default — but it only *applies*
// the new bundle on the NEXT cold start, so a fix a tester is waiting on can sit
// unused behind however long they keep the app in memory.
//
// This checks explicitly on launch and whenever the app returns to the
// foreground, and reloads as soon as a bundle is ready. Reloading is safe here
// because it only ever happens at a foreground transition, never mid-edit.
import * as Updates from 'expo-updates';
import { AppState } from 'react-native';

// A check hitting the network on every foreground would be wasteful; once every
// 15 minutes is plenty for shipping a fix to testers.
const MIN_INTERVAL_MS = 15 * 60 * 1000;
let lastCheck = 0;
let checking = false;

export async function checkForUpdate({ force = false } = {}) {
  // Updates are disabled in development and in Expo Go; calling through would
  // throw rather than no-op.
  if (__DEV__ || !Updates.isEnabled) return false;

  const now = Date.now();
  if (!force && now - lastCheck < MIN_INTERVAL_MS) return false;
  if (checking) return false;

  checking = true;
  lastCheck = now;
  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (!isAvailable) return false;

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return true;
  } catch (error) {
    // Offline, or the update server is unreachable — nothing to do. Never let
    // an update check interfere with using the app.
    console.log('Update check skipped:', error?.message ?? error);
    return false;
  } finally {
    checking = false;
  }
}

// Check now, then again each time the app comes back to the foreground.
// Returns an unsubscribe function.
export function startUpdateWatcher() {
  checkForUpdate({ force: true });

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') checkForUpdate();
  });
  return () => subscription.remove();
}
