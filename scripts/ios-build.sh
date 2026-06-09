#!/usr/bin/env bash
#
# Build & run the iOS dev client with the environment CocoaPods requires.
#
# CocoaPods crashes ("Unicode Normalization not appropriate for ASCII-8BIT")
# unless the shell uses a UTF-8 locale, so we export it here. The fmt consteval
# build fix is handled automatically by the ./plugins/withFmtConstevalFix Expo
# config plugin during prebuild/pod install — no manual patching needed.
#
# Usage:
#   ./scripts/ios-build.sh                 # build + launch on a simulator
#   ./scripts/ios-build.sh --device        # build + launch on a connected device
#   ./scripts/ios-build.sh --clean         # regenerate ios/ from scratch first
#
set -euo pipefail

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

if [[ "${1:-}" == "--clean" ]]; then
  shift
  echo "==> Regenerating native iOS project (expo prebuild --clean)"
  npx expo prebuild --platform ios --clean
fi

echo "==> expo run:ios $*"
exec npx expo run:ios "$@"
