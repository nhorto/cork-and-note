const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin: opt out of Android predictive back while targeting API 36.
 *
 * Behavior change in Android 16 (API 36): for apps *targeting* 36, the
 * predictive back system animations are enabled by default, and the system
 * stops calling `onBackPressed()` / dispatching `KEYCODE_BACK`
 * (https://developer.android.com/about/versions/16/behavior-changes-16).
 * React Native 0.79's back handling (ReactActivity -> BackHandler / navigation
 * pop) relies on exactly those legacy callbacks, so with predictive back
 * active the back gesture would exit the app instead of popping the
 * expo-router stack.
 *
 * Expo SDK 54 exposes `android.predictiveBackGestureEnabled` in app config for
 * this (default false); SDK 53 has no such option, so this plugin writes the
 * equivalent manifest attribute directly:
 *
 *   <application android:enableOnBackInvokedCallback="false" ...>
 *
 * Remove this plugin when upgrading to SDK 54+ and adopting
 * `android.predictiveBackGestureEnabled` instead.
 */
module.exports = function withPredictiveBackOptOut(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:enableOnBackInvokedCallback'] = 'false';
    }
    return config;
  });
};
