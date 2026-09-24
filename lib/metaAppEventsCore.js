/**
 * Configure Meta app events after iOS has returned its ATT decision.
 *
 * This core stays free of native imports so the consent boundary can be tested
 * in Node. A denied or unavailable permission keeps advertiser identifiers
 * disabled, then initializes the SDK so eligible privacy-preserving aggregate
 * attribution can still operate.
 */
export async function configureMetaAppEvents({
  platform,
  enabled,
  requestPermission,
  settings,
}) {
  if (!enabled || platform !== 'ios') {
    return { initialized: false, reason: enabled ? 'unsupported-platform' : 'not-configured' };
  }

  let permissionStatus = 'unavailable';
  try {
    const permission = await requestPermission();
    permissionStatus = permission?.status || 'unavailable';
  } catch {
    // A permission API failure must not block app startup. Initialize below
    // with identifier collection disabled.
  }

  const trackingAllowed = permissionStatus === 'granted';
  settings.setAdvertiserIDCollectionEnabled(trackingAllowed);
  settings.setAutoLogAppEventsEnabled(true);
  await settings.setAdvertiserTrackingEnabled(trackingAllowed);
  settings.initializeSDK();

  return { initialized: true, permissionStatus, trackingAllowed };
}
