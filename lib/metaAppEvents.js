import Constants from 'expo-constants';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import { configureMetaAppEvents } from './metaAppEventsCore';

let initializationPromise = null;

export function metaAppEventsAreConfigured() {
  return Constants.expoConfig?.extra?.metaAppEventsEnabled === true;
}

export function initializeMetaAppEvents() {
  if (!initializationPromise) {
    const enabled = metaAppEventsAreConfigured();
    // Avoid evaluating the native Meta package in web or deliberately
    // unconfigured builds. Metro still bundles it for configured iOS builds.
    const settings = enabled && Platform.OS === 'ios'
      ? require('react-native-fbsdk-next').Settings
      : null;
    initializationPromise = configureMetaAppEvents({
      platform: Platform.OS,
      enabled,
      requestPermission: requestTrackingPermissionsAsync,
      settings,
    }).catch((error) => {
      console.warn('Meta app-event initialization failed:', error?.message || error);
      return { initialized: false, reason: 'initialization-failed' };
    });
  }

  return initializationPromise;
}
