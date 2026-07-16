// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Workaround for @supabase/supabase-js on Expo SDK 53: package-exports resolution
// pulls in Node-only entry points (ws/stream) and breaks the app. Do not remove.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;