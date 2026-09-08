#!/usr/bin/env bash
# Capture the App Store screenshot set from a booted simulator.
#
#   ./scripts/capture-screenshots.sh [output-dir]
#
# Prerequisites:
#   1. A build from the `simulator` EAS profile installed on a booted 6.9"
#      simulator (iPhone 16/17 Pro Max -> 1320x2868, the size Apple requires):
#        eas build -p ios --profile simulator
#        xcrun simctl boot "iPhone 16 Pro Max" && open -a Simulator
#        xcrun simctl install booted /path/to/CorkNote.app
#   2. SUPABASE_ACCESS_TOKEN in the environment (see ~/.zshrc).
#
# How it works: the app is driven by writing an initial route into its
# AsyncStorage and relaunching, rather than by tapping. `simctl` has no touch
# injection, `idb-companion` no longer builds against current Command Line
# Tools, and AppleScript clicking needs macOS Accessibility permission, which a
# non-interactive session cannot be granted. The `simulator` build profile sets
# EXPO_PUBLIC_SCREENSHOT_MODE=1, which compiles in the hook in app/_layout.js
# that reads the route. It is absent from every other profile.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-docs/marketing/screenshots}"
BUNDLE=com.nicholashorton.corkandnote
REF=ixecayqpogkiawempzgc
DEMO_EMAIL=review@corkandnote.com
DEMO_PASS="${CORKNOTE_DEMO_PASSWORD:-}"

if [ -z "$DEMO_PASS" ]; then
  echo "Set CORKNOTE_DEMO_PASSWORD (the App Review demo account password)." >&2
  exit 1
fi

mkdir -p "$OUT"

KEYS=$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$REF/api-keys?reveal=true")
ANON=$(echo "$KEYS" | python3 -c "import json,sys;print([k['api_key'] for k in json.load(sys.stdin) if k['name']=='anon'][0])")
SESSION=$(curl -s -X POST "https://$REF.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASS\"}")

# A clean, consistent status bar across the whole set.
xcrun simctl status_bar booted override \
  --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3 >/dev/null 2>&1 || true

# name:route pairs, in listing order (see docs/business/app-store-listing.md §9)
# Map is captured LAST and with a shorter settle time on purpose: the Explore
# screen asks for location permission a beat after it loads, and that system
# alert then sticks around for subsequent launches. Taking it last keeps every
# other shot clean; the short delay catches the map with its pins rendered but
# before the prompt appears.
SHOTS=(
  "1-home:/(tabs)/home:14"
  "2-log-a-tasting:/log-session?mode=wine:14"
  "3-winery-visits:WINERY:14"
  "5-sommelier:/(tabs)/sommelier:14"
  "4-explore-map:/(tabs)/map:6"
)

for entry in "${SHOTS[@]}"; do
  NAME="$(echo "$entry" | cut -d: -f1)"
  ROUTE="$(echo "$entry" | cut -d: -f2)"
  DELAY="$(echo "$entry" | cut -d: -f3)"

  if [ "$ROUTE" = "WINERY" ]; then
    # Resolve the demo account's most-visited winery at run time.
    ROUTE="/winery/$(SESSION="$SESSION" ANON="$ANON" REF="$REF" python3 - <<'PY'
import json, os, subprocess
tok = json.loads(os.environ["SESSION"])["access_token"]
uid = json.loads(os.environ["SESSION"])["user"]["id"]
url = f"https://{os.environ['REF']}.supabase.co/rest/v1/wineries?user_id=eq.{uid}&select=id,name&order=id&limit=1"
out = subprocess.run(["curl","-s",url,"-H",f"apikey: {os.environ['ANON']}","-H",f"Authorization: Bearer {tok}"],
                     capture_output=True, text=True).stdout
print(json.loads(out)[0]["id"])
PY
)"
  fi

  xcrun simctl terminate booted "$BUNDLE" >/dev/null 2>&1 || true
  sleep 1

  CONTAINER=$(xcrun simctl get_app_container booted "$BUNDLE" data)
  SESSION="$SESSION" CONTAINER="$CONTAINER" REF="$REF" ROUTE="$ROUTE" python3 - <<'PY'
import json, os, time, pathlib, hashlib
sess = json.loads(os.environ["SESSION"])
sess.setdefault("expires_at", int(time.time()) + int(sess.get("expires_in", 3600)))
d = pathlib.Path(os.environ["CONTAINER"]) / "Library" / "Application Support" \
    / "com.nicholashorton.corkandnote" / "RCTAsyncLocalStorage_V1"
d.mkdir(parents=True, exist_ok=True)
entries = {
    f"sb-{os.environ['REF']}-auth-token": json.dumps(sess),
    "__screenshot_route__": os.environ["ROUTE"],
}
manifest = {}
for key, value in entries.items():
    # RN stores values over 1024 bytes in a file named md5(key), with the
    # manifest holding null; smaller values sit inline.
    if len(value) > 1024:
        (d / hashlib.md5(key.encode()).hexdigest()).write_text(value)
        manifest[key] = None
    else:
        manifest[key] = value
(d / "manifest.json").write_text(json.dumps(manifest))
PY

  xcrun simctl launch booted "$BUNDLE" >/dev/null 2>&1
  sleep "$DELAY"
  xcrun simctl io booted screenshot "$OUT/$NAME.png" >/dev/null 2>&1
  echo "captured $NAME  ($ROUTE)"
done

xcrun simctl terminate booted "$BUNDLE" >/dev/null 2>&1 || true
echo
echo "Wrote to $OUT:"
magick identify "$OUT"/*.png 2>/dev/null || ls -la "$OUT"
