// Extends app.json. The Android Google Maps key must come from the
// environment, never from source control — the previous committed key is
// being rotated (#164). GOOGLE_MAPS_API_KEY is the name already provisioned
// in the EAS "production" and "preview" environments.
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

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
