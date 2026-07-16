// lib/haptics.js
// Thin wrapper around expo-haptics so call sites stay tidy and any platform
// quirks live in one place. All calls are fire-and-forget and swallow errors —
// haptics are a nicety, never critical, and are a no-op on unsupported devices.
import * as Haptics from 'expo-haptics';

export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function tapMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function notifySuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function notifyError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
