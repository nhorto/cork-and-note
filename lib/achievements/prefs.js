// lib/achievements/prefs.js — the one thing about badges the user can turn off.
//
// Celebrations are on by default: earning a badge without being told is the
// same as not earning it. What the toggle controls is the popup, not the
// badges, which keep landing in the collection either way. Stored in
// AsyncStorage like the notification prefs (lib/notifications.js): a device
// preference, not account data, so it needs no table and no migration.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CELEBRATE_KEY = 'achievements:celebrate';

export const DEFAULT_CELEBRATE = true;

export async function getCelebrationPref() {
  try {
    const raw = await AsyncStorage.getItem(CELEBRATE_KEY);
    if (raw == null) return DEFAULT_CELEBRATE;
    return raw === 'true';
  } catch (e) {
    console.warn('achievements.getCelebrationPref failed, using default:', e?.message);
    return DEFAULT_CELEBRATE;
  }
}

export async function setCelebrationPref(enabled) {
  const value = Boolean(enabled);
  try {
    await AsyncStorage.setItem(CELEBRATE_KEY, value ? 'true' : 'false');
  } catch (e) {
    console.warn('achievements.setCelebrationPref failed:', e?.message);
  }
  return value;
}
