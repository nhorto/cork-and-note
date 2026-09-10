# Royal Velvet and Purple After Dark

Selected on 2026-09-10 from `mockups/purple-gold-studio.html`.

| Role | Royal Velvet / Light | Purple After Dark / Dark |
| --- | --- | --- |
| Purple fill | `#54258A` | `#64399B` |
| Gold accent | `#D6B45D` | `#E0BE6C` |
| Background | `#FAF8F4` | `#191321` |
| Card surface | `#FFFFFF` | `#261D31` |
| Supporting purple | `#EEE6F7` | `#362643` |
| Main text | `#2E2438` | `#F5EEF9` |
| Secondary labels | `#746779` | `#B9A9C8` |
| Ready / visited | `#55745E` | `#90B49A` |

Account settings → Appearance offers System (default), Light, and Dark. The choice
is device-local and persists in AsyncStorage. System responds to OS changes;
manual choices also set native appearance for keyboards, alerts and sheets.
The native launch splash follows the OS before JS runs; the saved app preference
is restored before the navigator renders and the splash is dismissed.

`styles/theme.js` defines both palettes and shared design tokens.
`styles/ThemeProvider.js` owns persistence and subscriptions. `createThemedStyles`
caches each component's styles once per theme. All themed routes and shared
components subscribe, including memoized components, so changes do not remount
navigation or reset an in-progress form.

Purple fills retain the selected rich color. A separate `primary.ink` becomes
readable lavender in dark mode; gold ink is deeper on light backgrounds.
`onPrimary`, `onAccent`, `onStatus`, and `onPhoto` distinguish foreground roles.
The home Journey card uses the selected bold-purple treatment. Drink-window
badges use active colors via `drinkWindowMeta(status, colors)` without changing
business labels or sorting. MapKit follows the selected native appearance;
Google Maps receives a dark map style. Custom markers refresh on theme changes.

## PNG logo

Generated using the **built-in imagegen tool** with
`mockups/logo-round-2/images/render-01-tasting-nib.png` as the edit target.
The original result is `assets/images/brand-mark.png`, with a copy in Downloads
named `Cork-and-Note-Royal-Velvet-Logo.png`. The same purple/gold mark serves both
themes. `scripts/generate-icons.sh` packages icons, splash, authentication,
favicon, and shared site image derivatives. The old Spritz master is archived.

Final generation prompt:

> Use case: logo-brand / precise-object-edit. Edit target: the provided Cork & Note burgundy gold wine-glass and fountain-pen-nib emblem. Regenerate as the final production PNG app logo in the approved Royal Velvet palette. Preserve the centered wine glass silhouette with the fountain pen nib cutout inside its bowl, narrow stem and stable curved foot, and ONE complete enclosing circular gold ring. Change the burgundy background to perfectly flat opaque rich royal purple #54258A and the symbol plus ring to perfectly flat warm antique gold #D6B45D. Clean flat ink with crisp antialiased edges, no paper texture, no metallic shimmer, no gradients or shadows. The full square canvas is opaque purple to all four edges and corners. Gold circle centered, about 74 percent of canvas width; slightly sturdy ring about 1.5 percent canvas width for legibility at small app-icon sizes. Wine glass centered inside it, about 48 percent canvas height, faithful fountain-pen nib negative space with small breather hole and slit. Balanced, refined and friendly. No letters, words, text, extra marks, border outside the circle, device mockup, perspective, watermark, transparent areas, or rounded outer corners. Deliver one square high-resolution PNG master icon.

## Verification

Tests cover persistence, System/manual switching, storage failures, rapid-choice
ordering, draft preservation, both palettes' token coverage, and key
text/button/Journey/status contrast pairings. iOS and Android production
JS/Hermes exports validate the full native import graph. Native icon and splash
changes require a new native build to appear on the launcher and launch screen.

The full web export is blocked by the existing direct `react-native-maps` import,
which reaches a native-only module during web bundling. Project-wide TypeScript
also includes existing Deno/edge-function configuration errors. These are separate
from the appearance change.

A local React Native Web review harness rendered Home, Login, Appearance, the wine
form, Cellar, and Chat in both modes using the actual components. Native services
and backend calls were stubbed for that visual review; it is not a device test.

Final verification: 18 Jest suites / 405 tests passed; app lint reported zero
errors (20 existing warnings). iOS and Android Hermes exports succeeded. The
rendered Appearance controls were clicked in both modes and a saved selection
was verified after a browser reload. No new app TypeScript errors remain.

Native smoke check: launched this workspace through the installed development
client on the iPhone 16 Pro Max simulator and confirmed the authenticated home
screen renders with Royal Velvet and the updated navigation colors.
