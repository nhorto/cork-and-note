const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin: raise every CocoaPods target to iOS 15.0.
 *
 * Xcode 27 refuses to build any target whose IPHONEOS_DEPLOYMENT_TARGET is
 * below 15.0 ("the range of supported deployment target versions is 15.0 to
 * 27.0.x"). Several pods we depend on still declare ancient minimums in their
 * podspecs (react-native-maps privacy bundle 11.0, RevenueCat 13.0,
 * ReachabilitySwift 12.0, RNCAsyncStorage and SDWebImage 9.0), which broke
 * build 30 on 2026-09-21 after the Mac moved from Xcode 26 to 27. The app
 * target itself is already above 15, so nothing user-visible changes; only
 * the pods' own settings are lifted to the floor Xcode now demands.
 *
 * Like withFmtConstevalFix, this injects into the generated Podfile's
 * `post_install` block so it survives `expo prebuild --clean` and applies on
 * every `pod install`. Idempotent via the marker.
 */

const MARKER = 'CORK_AND_NOTE_PODS_DEPLOYMENT_TARGET';
const MIN_IOS = '15.0';

const POST_INSTALL_SNIPPET = `
    # >>> ${MARKER}: Xcode 27 rejects pod deployment targets below ${MIN_IOS}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${MIN_IOS}.to_f
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end
    # <<< ${MARKER}
`;

function addPostInstallHook(podfile) {
  if (podfile.includes(MARKER)) {
    return podfile;
  }
  const postInstallRegex = /(post_install do \|installer\|\n)/;
  if (postInstallRegex.test(podfile)) {
    return podfile.replace(postInstallRegex, `$1${POST_INSTALL_SNIPPET}`);
  }
  return podfile + `\npost_install do |installer|${POST_INSTALL_SNIPPET}end\n`;
}

module.exports = function withPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        const podfile = fs.readFileSync(podfilePath, 'utf8');
        fs.writeFileSync(podfilePath, addPostInstallHook(podfile));
      }
      return config;
    },
  ]);
};
