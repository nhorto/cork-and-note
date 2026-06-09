const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin: persist the `fmt` consteval build fix.
 *
 * react-native 0.79.x pins the `fmt` pod to git tag 11.0.2 (identical across
 * 0.79.4 -> 0.79.7 — bumping RN does NOT change it). fmt 11.0.2's
 * `FMT_USE_CONSTEVAL` detection enables `consteval` whenever `__cpp_consteval`
 * is defined, which the current Xcode/Apple-Clang toolchain advertises. But its
 * `consteval`-based `FMT_STRING` is then rejected at compile time:
 *
 *   call to consteval function "fmt::fstring<...>::fstring" is not a constant
 *   expression  (ios/Pods/fmt/include/fmt/format-inl.h)
 *
 * The fix is to force `FMT_USE_CONSTEVAL` to 0 in the fmt header. A
 * `-DFMT_USE_CONSTEVAL=0` compiler flag does NOT work: base.h `#define`s the
 * macro unconditionally with no `#ifndef` guard, so the header value always
 * wins. The header itself must be edited.
 *
 * `ios/Pods/` is gitignored and regenerated, so the edit can't just live in the
 * tree. This plugin injects a CocoaPods `post_install` hook into the generated
 * Podfile. The hook runs on every `pod install` (including the one at the end
 * of `expo prebuild`), patching `Pods/fmt/include/fmt/base.h` after the fmt
 * source has been fetched. It is idempotent (guarded by a marker) and survives
 * `expo prebuild --clean`, since the plugin re-runs each prebuild.
 */

const MARKER = 'CORK_AND_NOTE_FMT_CONSTEVAL_PATCH';

// Ruby injected into the Podfile's `post_install do |installer|` block.
const POST_INSTALL_SNIPPET = `
    # >>> ${MARKER}: force-disable fmt consteval (broken on current Xcode/Apple-Clang with fmt 11.0.2)
    fmt_base_h = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base_h)
      fmt_contents = File.read(fmt_base_h)
      unless fmt_contents.include?('${MARKER}')
        fmt_contents = fmt_contents.sub(
          /^#if FMT_USE_CONSTEVAL\\n/,
          "// ${MARKER}: consteval is broken here, force it off regardless of toolchain detection\\n#undef FMT_USE_CONSTEVAL\\n#define FMT_USE_CONSTEVAL 0\\n#if FMT_USE_CONSTEVAL\\n"
        )
        File.write(fmt_base_h, fmt_contents)
        Pod::UI.puts '[withFmtConstevalFix] Patched Pods/fmt/include/fmt/base.h (FMT_USE_CONSTEVAL=0)'
      end
    end
    # <<< ${MARKER}
`;

function addPostInstallHook(podfile) {
  if (podfile.includes(MARKER)) {
    return podfile;
  }

  // Preferred: inject into the existing `post_install do |installer|` block
  // that Expo's default Podfile already ships.
  const postInstallRegex = /(post_install do \|installer\|\n)/;
  if (postInstallRegex.test(podfile)) {
    return podfile.replace(postInstallRegex, `$1${POST_INSTALL_SNIPPET}`);
  }

  // Fallback: no post_install block found — append a complete one.
  const block = `\npost_install do |installer|${POST_INSTALL_SNIPPET}end\n`;
  return podfile + block;
}

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      if (fs.existsSync(podfilePath)) {
        const podfile = fs.readFileSync(podfilePath, 'utf8');
        fs.writeFileSync(podfilePath, addPostInstallHook(podfile));
      }
      return config;
    },
  ]);
};
