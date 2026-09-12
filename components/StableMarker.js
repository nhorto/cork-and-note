// components/StableMarker.js
//
// A <Marker> with a custom child view that renders the same on both platforms.
//
// react-native-maps draws a custom marker on Android by snapshotting the child
// view into a bitmap, and it only re-snapshots while tracksViewChanges is on.
// Leave it on and every marker redraws on every frame (panning crawls); turn it
// off at mount and the marker paints blank, because the first snapshot happens
// before layout and before the icon font has loaded. That trap is why pins used
// to fall back to Google's default teardrops on Android.
//
// So each marker tracks changes for a short settle window after it mounts, then
// freezes. `pulse` re-opens the window when the marker's content changes (the
// zoom-threshold label flip), matching what the iOS path already did.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Marker } from 'react-native-maps';

// Long enough for layout + the Ionicons font, short enough to be invisible.
const SETTLE_MS = 900;

// iOS keeps the marker view live, so it needs no settle window — only the
// label-flip pulse, exactly as before.
const needsSettle = () => Platform.OS === 'android';

export default function StableMarker({ pulse = false, children, ...props }) {
  const [settling, setSettling] = useState(needsSettle);

  useEffect(() => {
    if (!needsSettle()) return undefined;
    const t = setTimeout(() => setSettling(false), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker
      // Android anchors a custom view at its bottom edge; iOS centers it on the
      // coordinate. Center it on both so the pin sits where iOS puts it.
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      tracksViewChanges={settling || pulse}
      {...props}
    >
      {children}
    </Marker>
  );
}
