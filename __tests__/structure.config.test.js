// Launch-critical facts about the build that nothing else checks:
// the store scope (iPhone only), the permission strings App Review reads, the
// architecture flag the map depends on, that no secret is committed, that
// every edge function the client invokes exists, and that every bundled
// asset the code requires is actually in the repo.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const sourceFiles = () => ['app', 'components', 'hooks', 'lib', 'utils', 'styles'].flatMap((d) => walk(path.join(ROOT, d)));

describe('app.json', () => {
  test('ships iPhone-only, with the bundle id the store products are bound to', () => {
    expect(appJson.ios.supportsTablet).toBe(false);
    expect(appJson.ios.bundleIdentifier).toBe('com.nicholashorton.corkandnote');
    expect(appJson.android.package).toBe('com.nicholashorton.corkandnote');
    expect(appJson.scheme).toBe('corkandnote');
  });

  test('keeps the New Architecture off: react-native-maps 1.20 crashes on marker removal under it', () => {
    expect(appJson.newArchEnabled).toBe(false);
  });

  test('declares a usage string for every permission the app requests', () => {
    const plist = appJson.ios.infoPlist;
    for (const key of ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSLocationWhenInUseUsageDescription']) {
      expect(typeof plist[key]).toBe('string');
      expect(plist[key].length).toBeGreaterThan(20);
      expect(plist[key]).toMatch(/Cork & Note/);
    }
    expect(plist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(appJson.android.permissions).toEqual(expect.arrayContaining(['CAMERA', 'ACCESS_FINE_LOCATION']));
  });

  test('declares every native module plugin the code imports', () => {
    const plugins = appJson.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
    for (const mod of ['expo-router', 'expo-camera', 'expo-image-picker', 'expo-location', 'expo-notifications']) {
      expect(plugins).toContain(mod);
    }
  });
});

describe('app.config.js', () => {
  const configure = require('../app.config.js');

  test('injects store keys from the environment and never from source', () => {
    const saved = { ...process.env };
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.REVENUECAT_IOS_API_KEY;
    delete process.env.REVENUECAT_ANDROID_API_KEY;
    try {
      const bare = configure({ config: JSON.parse(JSON.stringify(appJson)) });
      expect(bare.extra.revenueCatIosKey).toBeNull();
      expect(bare.extra.revenueCatAndroidKey).toBeNull();
      expect(bare.android.config?.googleMaps).toBeUndefined();

      process.env.GOOGLE_MAPS_API_KEY = 'maps-key';
      process.env.REVENUECAT_IOS_API_KEY = 'appl_x';
      process.env.REVENUECAT_ANDROID_API_KEY = 'goog_x';
      const full = configure({ config: JSON.parse(JSON.stringify(appJson)) });
      expect(full.android.config.googleMaps.apiKey).toBe('maps-key');
      expect(full.extra.revenueCatIosKey).toBe('appl_x');
      expect(full.extra.revenueCatAndroidKey).toBe('goog_x');
      expect(full.extra.eas.projectId).toBe(appJson.extra.eas.projectId);
    } finally {
      process.env = saved;
    }
  });

  test('no API key literal is committed anywhere in the app source', () => {
    // RevenueCat public keys start appl_/goog_, Google keys AIza, Supabase
    // service keys are JWTs with the service_role claim. None belong in git.
    const offenders = [];
    for (const file of [...sourceFiles(), path.join(ROOT, 'app.json'), path.join(ROOT, 'eas.json')]) {
      const src = fs.readFileSync(file, 'utf8');
      for (const re of [/\b(appl|goog)_[A-Za-z]{20,}/, /\bAIza[0-9A-Za-z_-]{30,}/, /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/]) {
        const m = src.match(re);
        if (m) offenders.push(`${path.relative(ROOT, file)}: ${m[0].slice(0, 12)}...`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('edge functions and assets referenced by the client', () => {
  test('every edge function the client invokes is in supabase/functions', () => {
    const invoked = new Set();
    for (const file of sourceFiles()) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/functions\.invoke\(\s*['"]([a-z0-9-]+)['"]/g)) invoked.add(m[1]);
    }
    expect(invoked.size).toBeGreaterThanOrEqual(4);
    for (const name of invoked) {
      expect(fs.existsSync(path.join(ROOT, 'supabase', 'functions', name, 'index.ts'))).toBe(true);
    }
  });

  test('every required asset exists on disk', () => {
    const missing = [];
    for (const file of sourceFiles()) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/require\(\s*['"]([^'"]*assets\/[^'"]+)['"]\s*\)/g)) {
        const resolved = path.resolve(path.dirname(file), m[1]);
        if (!fs.existsSync(resolved)) missing.push(`${path.relative(ROOT, file)} -> ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
    for (const rel of [appJson.icon, appJson.android.adaptiveIcon.foregroundImage, appJson.web.favicon]) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    }
  });
});
