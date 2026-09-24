// Extends app.json. Neither of these keys may be committed, so both come from
// the environment (EAS "production"/"preview" env, or a local .env in dev) and
// are injected here at build time.
//
// - GOOGLE_MAPS_API_KEY is a restricted Android key; the previously committed one
//   is being rotated (#164).
// - REVENUECAT_IOS_API_KEY / REVENUECAT_ANDROID_API_KEY are RevenueCat's PUBLIC
//   SDK keys (start `appl_` / `goog_`). They are publishable — they can only
//   read offerings and make purchases for the signed-in user — but they still
//   belong in env, not in git, so they can be rotated without a code change.
//   Absent, the app simply runs without the Pro tier instead of failing to
//   build. lib/purchases.js picks the key for the platform it is running on.
// - META_APP_ID / META_CLIENT_TOKEN configure Meta app-event attribution. The
//   client token is a publishable SDK value (not the Meta App Secret), but both
//   stay in EAS environment configuration so an unconfigured local build does
//   not initialize Meta accidentally. A half-configured build fails early.
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const revenueCatIosKey = process.env.REVENUECAT_IOS_API_KEY;
  const revenueCatAndroidKey = process.env.REVENUECAT_ANDROID_API_KEY;
  const metaAppId = process.env.META_APP_ID?.trim();
  const metaClientToken = process.env.META_CLIENT_TOKEN?.trim();

  if (!!metaAppId !== !!metaClientToken) {
    throw new Error('META_APP_ID and META_CLIENT_TOKEN must either both be set or both be absent.');
  }

  if (googleMapsApiKey) {
    config.android = {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: googleMapsApiKey },
      },
    };
  }

  config.extra = {
    ...config.extra,
    revenueCatIosKey: revenueCatIosKey || null,
    revenueCatAndroidKey: revenueCatAndroidKey || null,
    metaAppEventsEnabled: Boolean(metaAppId && metaClientToken),
  };

  if (metaAppId && metaClientToken) {
    config.plugins = [
      ...(config.plugins || []),
      [
        'react-native-fbsdk-next',
        {
          appID: metaAppId,
          clientToken: metaClientToken,
          displayName: 'Cork & Note',
          scheme: `fb${metaAppId}`,
          // Consent is decided at runtime before initialization. Starting
          // these two switches off prevents identifier collection before the
          // iOS tracking-permission result is known.
          advertiserIDCollectionEnabled: false,
          autoLogAppEventsEnabled: true,
          isAutoInitEnabled: false,
          iosUserTrackingPermission:
            'Allow Cork & Note to measure which ads lead to app downloads and improve its advertising.',
        },
      ],
    ];
  }

  return config;
};
