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
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const revenueCatIosKey = process.env.REVENUECAT_IOS_API_KEY;
  const revenueCatAndroidKey = process.env.REVENUECAT_ANDROID_API_KEY;

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
  };

  return config;
};
