// Extends app.json. Neither of these keys may be committed, so both come from
// the environment (EAS "production"/"preview" env, or a local .env in dev) and
// are injected here at build time.
//
// - GOOGLE_MAPS_API_KEY is a restricted Android key; the previously committed one
//   is being rotated (#164).
// - REVENUECAT_IOS_API_KEY is RevenueCat's PUBLIC iOS SDK key (starts `appl_`).
//   It is publishable — it can only read offerings and make purchases for the
//   signed-in user — but it still belongs in env, not in git, so it can be
//   rotated without a code change. Absent, the app simply runs without the Pro
//   tier instead of failing to build.
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const revenueCatIosKey = process.env.REVENUECAT_IOS_API_KEY;

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
  };

  return config;
};
