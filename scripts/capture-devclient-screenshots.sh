#!/usr/bin/env bash
# Capture App Store screenshots from the dev-client build on a booted
# simulator, loading JS from a Metro instance started with
# EXPO_PUBLIC_SCREENSHOT_MODE=1 (see scripts/capture-screenshots.sh for the
# EAS-simulator-build variant this is adapted from).
#
#   CORKNOTE_DEMO_PASSWORD=... ./scripts/capture-devclient-screenshots.sh <metro-port> <out-dir> <appearance> <name:route:delay>...
set -euo pipefail

PORT="$1"; OUT="$2"; APPEARANCE="$3"; shift 3
BUNDLE=com.nicholashorton.corkandnote
REF=ixecayqpogkiawempzgc
DEMO_EMAIL=review@corkandnote.com
DEMO_PASS="${CORKNOTE_DEMO_PASSWORD:?Set CORKNOTE_DEMO_PASSWORD}"
DEVURL="corkandnote://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${PORT}"

mkdir -p "$OUT"

# The app's own anon key from .env — the Management API token can no longer
# reveal keys (privilege change server-side).
ANON=$(grep '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$(dirname "$0")/../.env" | cut -d= -f2-)
SESSION=$(curl -s -X POST "https://$REF.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASS\"}")
echo "$SESSION" | python3 -c "import json,sys; s=json.load(sys.stdin); assert 'access_token' in s, s" \
  || { echo "demo login failed" >&2; exit 1; }

xcrun simctl ui booted appearance "$APPEARANCE"
xcrun simctl status_bar booted override \
  --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3 >/dev/null 2>&1 || true

for entry in "$@"; do
  NAME="$(echo "$entry" | cut -d: -f1)"
  ROUTE="$(echo "$entry" | cut -d: -f2)"
  DELAY="$(echo "$entry" | cut -d: -f3)"

  if [ "$ROUTE" = "WINERY" ]; then
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
    if len(value) > 1024:
        (d / hashlib.md5(key.encode()).hexdigest()).write_text(value)
        manifest[key] = None
    else:
        manifest[key] = value
(d / "manifest.json").write_text(json.dumps(manifest))
PY

  # The dev client needs the deep link to load straight into the Metro bundle
  # instead of showing the launcher home screen.
  xcrun simctl launch booted "$BUNDLE" >/dev/null 2>&1
  sleep 2
  xcrun simctl openurl booted "$DEVURL"
  sleep "$DELAY"
  xcrun simctl io booted screenshot "$OUT/$NAME.png" >/dev/null 2>&1
  echo "captured $NAME  ($ROUTE)"
done

xcrun simctl terminate booted "$BUNDLE" >/dev/null 2>&1 || true
ls -la "$OUT"
