// Extends app.json. The Android Google Maps key must come from the
// environment (EAS env var or local .env), never from source control —
// the previous committed key is being rotated (#164).
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  if (googleMapsApiKey) {
    config.android = {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: googleMapsApiKey },
      },
    };
  }

  return config;
};
