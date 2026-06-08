# Logging a Wine Without a Required Location: Competitive UX Research

_Research for cork-and-note (nhorto/cork-and-note, issue #17) — **competitive-research half only**._
_Date: 2026-06-08. All app behaviors below are drawn from public documentation, app-store descriptions, and third-party reviews cited inline; where a source is ambiguous it is flagged as such._

> **Scope note:** This document is the competitive-research portion of issue #17. The product-discovery Q&A — deciding cork-and-note's *actual* logging flow — is deliberately **not** answered here; it will be worked through directly with the app owner. See "What Still Needs a Product Decision" at the end.

## Summary

The leading wine and beverage logging apps converge on one principle: **the wine is the required object; location is optional context.** None of the major wine apps (Vivino, Delectable, CellarTracker) force a user to specify a venue, winery, or restaurant to complete a log. The adjacent beer app Untappd is the clearest reference implementation of a fully location-optional "check-in" model and is included because its location handling is the most explicit and well-documented in the category.

The common pattern is: **identify the wine first (scan / search / photo / manual), then optionally enrich with rating, notes, photos, people, and location — every enrichment field is skippable, and most can be added or edited after the fact.**

---

## 1. Per-App Breakdown: Logging Entry Flow and Location Treatment

### Vivino

**How a log starts.** Vivino's primary entry point is the camera: the user taps the camera icon to scan a wine label (or a restaurant wine list), waits ~2–3 seconds for image recognition, and lands on the wine's profile page with producer, region, vintage, community rating, and food pairings. From the wine profile the user can then take an action — **"Add to Cellar"** (inventory) or rate/review (tasting log). Search by name is also available when scanning fails or for retroactive entry. ([Vivino app](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255), [Vivino wine scanner](https://www.vivino.com/en/wine-news/vivino-wine-scanner), [Travelling Corkscrew, 2026](https://travellingcorkscrew.com.au/blog/best-wine-apps/))

**Location treatment: effectively absent / not a gate.** Vivino's logging model is built around the *wine identity* and a personal taste profile, not a venue check-in. The cellar feature lets users add quantities, tasting notes, drinking windows, and personal reminders — but there is **no required "where did you drink this" field** in the core rate/review flow. The scan flow is explicitly marketed as working "wherever there's a bottle and a label" — restaurants, wine bars, beaches, home — which underscores that location is incidental, not captured as a structured requirement. (Note: physical *cellar location* — i.e., which rack/bin a bottle sits in — is a separate inventory concept surfaced more in the related OENO-by-Vintec app, not a venue/consumption location.) ([Discover Vivino's Wine Cellar feature](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature), [Localsinsider Vivino review](https://localsinsider.com/apps/how-to-discover-good-wines-from-anywhere-vivino-app-review/), [Vintec OENO](https://www.vintec.com/en-us/about-us/oeno-by-vintec/))

**Retroactive logging.** Fully supported. Because the unit of logging is the wine (found by scan or search) and location is not captured, a user can rate/review a wine days later from anywhere. Photos can also be pulled from the library rather than captured live.

### Delectable

**How a log starts.** Tap the camera icon → snap the label → in-app scanner identifies the wine and returns tasting notes, origin, and community reviews. The user can then **"Rate"** (stars out of 5 and/or a written review). Alternatives: upload an existing photo from the library (and even batch-upload multiple bottle photos at once), search by name, or "Request Expert Review" if recognition fails. ([Delectable app](https://apps.apple.com/us/app/delectable-scan-rate-wine/id512106648), [10 Tips for Using Delectable](https://delectable.com/feeds/10_tips_delectable))

**Location treatment: optional, opt-in via explicit prompts.** Delectable surfaces context as **optional tappable prompts**, not required fields:
- **"Where are you?"** — add a location/venue.
- **"Who are you drinking with?"** — tag drinking companions.

Both are presented as things the user *can* add ("to remember great times and great tastes"), and the documented flow lets a user press "Rate" and complete the log **without** touching either prompt. The marketing copy emphasizes adding "the location of where you tried your wines from anywhere in the world," reinforcing that location is enrichment, not a gate. (Public docs don't show an explicit "Skip" button — instead it's a *don't-tap-it* optional prompt, which is the lighter-weight pattern.) ([10 Tips for Using Delectable](https://delectable.com/feeds/10_tips_delectable), [Happily K Delectable review](https://happilyk.com/delectable-wine-app/))

**Retroactive logging.** Explicitly supported — the app's framing is "it's never too late" to log a past wine. Library-photo upload and name search both work without live capture or live location. ([10 Tips for Using Delectable](https://delectable.com/feeds/10_tips_delectable))

### CellarTracker

**How a log starts.** CellarTracker is inventory/cellar-management-first. Entry methods include a **wine scanner, barcode scanner, or manual/search entry**; the user then adds personal tasting notes, reviews, and ratings against a bottle. It taps a very large reference database (13M+ tasting notes, 2M+ professional reviews) to autofill wine identity. ([CellarTracker app](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275), [CellarTracker mobile](https://mobileapp.cellartracker.com/), [CellarTracker.com](https://www.cellartracker.com/))

**Location treatment: absent as a consumption venue; "location" means cellar storage.** CellarTracker's "location" concept is about *where the bottle is stored* (bin, rack, cellar) for inventory, not where it was consumed. The tasting-note/review flow does not require a consumption venue. So for the purposes of "where did you have it," CellarTracker simply doesn't model it — logging is wine + note + rating. ([CellarTracker app](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275), [Rob Millis review](https://medium.com/rob-millis-reviews/review-cellartracker-app-46cf5d35b799))

**Retroactive logging.** Native — the product is designed around logging bottles you own/have owned over time. Reviews note the new app can feel like "more scrolling" vs. the old one, and some workflows are easier on desktop — a friction signal worth noting. ([CellarTracker on Google Play](https://play.google.com/store/apps/details?id=com.cellartracker.appV2&hl=en), [Travelling Corkscrew, 2026](https://travellingcorkscrew.com.au/blog/best-wine-apps/))

### Untappd (beer — included as the clearest location-optional reference model)

**How a log starts.** The unit is a "check-in." The user finds the beer (search or scan), then composes a check-in. ([How to Check-In a Beer](https://help.untappd.com/hc/en-us/articles/360034404451-How-to-Check-In-a-Beer))

**Location treatment: fully optional, with two distinct location concepts.** Untappd is the most explicit in the category that **all enrichment is optional**: "When making a check-in you can add additional information such as a photo, tasting notes, a rating, the serving style, friends, the location or purchased location and flavor profile(s). All of these elements are optional additions to a check-in." It also separates two location types:
- **Location (venue)** — where you're drinking it.
- **Purchased Location** — a store/bottle shop where you bought it to drink elsewhere. Users are told they "do not need to fill in 'Location' and 'Purchased Location' if they are the same spot."

Crucially, **location can be added later**: "If you did not add a location at the time of check-in but had your location services enabled, you will be able to edit the check-in to add a location later." This decouples the act of logging from the act of geolocating. ([Venue Check-Ins](https://help.untappd.com/hc/en-us/articles/7087517915796-Venue-Check-Ins), [How to Edit Check-Ins](https://help.untappd.com/hc/en-us/articles/360034403851-How-to-Edit-Check-Ins))

**Caution flag.** Untappd's location-sharing has a documented privacy downside: a Bellingcat investigation showed that public check-in location data could be used to track individuals' movements. This is directly relevant to making location *optional and clearly controlled* rather than default-on. ([Bellingcat, 2020](https://www.bellingcat.com/news/2020/05/18/military-and-intelligence-personnel-can-be-tracked-with-the-untappd-beer-app/))

### Sommo & Wine-Searcher (brief, for breadth)

- **Sommo (2026):** AI label scan or photo upload auto-fills wine identity, then the user writes a structured tasting note (appearance/nose/palate/conclusion, WSET-style) and can get AI feedback. Logging is journal/note-centric; **no venue requirement** surfaced. Good model for "log the wine + a structured note, location not part of the flow." ([Sommo best wine apps 2026](https://sommo.app/blog/best-wine-apps-2026/), [Travelling Corkscrew, 2026](https://travellingcorkscrew.com.au/blog/best-wine-apps/))
- **Wine-Searcher:** Search-first — you must already know the wine; it's a discovery/price tool more than a tasting log, with no scan-and-check-in flow and no consumption-location concept. Included to show the *search-first* entry pattern as an alternative to scan-first. ([Sommo best wine apps 2026](https://sommo.app/blog/best-wine-apps-2026/))

### Comparison table

| App | Primary entry method(s) | Consumption-location field | Required? | Add location later? | Retroactive logging |
|---|---|---|---|---|---|
| Vivino | Scan label / scan wine list / search | Not modeled in core rate flow | N/A (absent) | N/A | Yes |
| Delectable | Scan label / photo upload / batch upload / search | "Where are you?" optional prompt | Optional (opt-in) | Not documented | Yes ("never too late") |
| CellarTracker | Scan / barcode / search / manual | Storage location only (not venue) | No (venue absent) | N/A | Yes (inventory-native) |
| Untappd (beer) | Search / scan | Location + Purchased Location | Optional (explicit) | Yes (edit later) | Yes |
| Sommo | AI scan / photo upload | Not modeled | N/A | N/A | Yes |
| Wine-Searcher | Search only | Not modeled | N/A | N/A | N/A (not a log) |

---

## 2. Best Practices for Location-Optional Logging

Synthesized from the patterns above:

1. **Make the wine the only required object.** Across every app, the one thing you must resolve is *which wine*. Everything else — rating, notes, photo, people, location — is optional enrichment. cork-and-note should treat "identify the wine" as the only hard gate to a saved log.

2. **Lead with identification, defer context.** The winning flow is `identify → (optional) enrich`. Scan/search first; surface location as a later, skippable step, never an upfront blocker. Forcing a venue before the wine is resolved is the anti-pattern.

3. **Use optional prompts, not required fields.** Delectable's "Where are you?" / "Who with?" tappable prompts and Untappd's "all of these elements are optional" model both let the user *complete and save* without engaging context. A visible-but-skippable affordance beats a modal that demands input.

4. **Decouple logging time from location capture — allow edit-later.** Untappd's "add a location later by editing the check-in" is the key enabler for retroactive and at-home logging. If the log can be edited after save, the user is never pressured to geo-tag in the moment. This single capability covers the "at home," "anywhere," and "retroactively" cases at once.

5. **Model multiple location *types*, and don't conflate them.** Untappd separates **drinking venue** vs. **purchased location**; CellarTracker/Vivino separate **storage location** vs. consumption. cork-and-note's issue describes winery (pin), restaurant (optional pin), and home/anywhere (none) — these are *kinds* of place, and the UI should let "no place" be a first-class, friction-free choice, not a blank-field afterthought.

6. **Support multiple entry methods for the same destination.** Scan (live), photo-from-library (retroactive), search-by-name (scan failed / from memory), and manual entry should all funnel into the same log object. Library-upload + name-search are what make retroactive logging work; without them, scan-first apps would force live capture.

7. **Make pin-dropping opt-in and lightweight.** For the winery/restaurant cases where a pin *is* wanted, the location step should be a quick "use my current location / drop a pin / search a place / skip" — mirroring how Untappd auto-suggests nearby venues but never forces a selection.

8. **Treat location as privacy-sensitive by default.** The Bellingcat finding on Untappd is a direct warning: don't default to capturing/sharing precise location. Keep it user-initiated, and be explicit about what's stored and what's shared.

9. **Plan for graceful recognition failure.** Every scan-first app provides a fallback (Delectable's "Request Expert Review," manual search, X-to-reject-wrong-match). A location-optional flow still needs a *wine-identity*-optional fallback path (manual entry) so a log is never blocked.

---

## 3. Open Questions / Considerations for the cork-and-note Team (discussion points)

These are framed as discussion points, not recommendations — the product flow itself is out of scope for this research.

- **What is the single required field?** The competitive norm is "the wine, and nothing else." Is cork-and-note comfortable making *only* wine-identity required, with rating/notes/location all optional?
- **Default location state.** Should a new log default to "no location" (user opts in to add one), or default to suggesting current location (user opts out)? Untappd uses the latter and pays a privacy cost; Vivino/Delectable lean toward the former.
- **One location concept or several?** Issue #17 lists winery (pin), restaurant (optional pin), home/anywhere (none). Should these be distinct *types* the user picks from, or a single freeform "where" with an optional pin? And is there a separate "purchased at" vs. "drank at" distinction worth modeling (Untappd does)?
- **Edit-later vs. capture-now.** Is "add/change location after saving" in scope? It's the cheapest way to unblock retroactive and at-home logging, but it implies the log is mutable post-save.
- **Retroactive entry method.** Will cork-and-note support photo-from-library and search-by-name (not just live scan)? These are prerequisites for "log a wine I had last week."
- **Pin UX for the winery case.** When a user *does* want a winery/restaurant pin: current-location, drop-a-pin, or place-search (or all three)? How heavy can that step be before it deters the common "no location" path?
- **Privacy posture and sharing.** If logs are social/shareable, what location granularity is stored vs. displayed? How is the Bellingcat-style tracking risk mitigated?
- **Recognition-failure fallback.** What happens when the label scan fails — manual entry, search, a "request review" queue? This determines whether a log can ever be truly blocked.

---

## What Still Needs a Product Decision

The following are explicitly **deferred to the product-discovery Q&A with the app owner** — this research deliberately does not answer them:

1. Which fields are *required* vs. optional in cork-and-note's log (beyond the strong competitive signal that only wine-identity is universally required).
2. Whether location defaults to off (opt-in) or on (opt-out).
3. Whether cork-and-note models one freeform location or distinct types (winery / restaurant / home / none), and whether "purchased vs. consumed" is separated.
4. Whether logs are editable after save (enabling add-location-later, the key retroactive/at-home enabler).
5. Which entry methods ship (live scan, library photo, name search, manual) and therefore how well retroactive logging is supported.
6. The exact pin-drop interaction for the winery/restaurant case, and how lightweight the skip path is.
7. cork-and-note's privacy/sharing posture for any captured location data.

---

### Sources

- [Vivino — App Store](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)
- [Vivino — Discover Vivino's Wine Cellar feature](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature)
- [Vivino — Wine Scanner](https://www.vivino.com/en/wine-news/vivino-wine-scanner)
- [Localsinsider — Vivino app review](https://localsinsider.com/apps/how-to-discover-good-wines-from-anywhere-vivino-app-review/)
- [Vintec — OENO by Vintec](https://www.vintec.com/en-us/about-us/oeno-by-vintec/)
- [Delectable — App Store](https://apps.apple.com/us/app/delectable-scan-rate-wine/id512106648)
- [Delectable — 10 Tips for Using Delectable](https://delectable.com/feeds/10_tips_delectable)
- [Happily K — Delectable wine app review](https://happilyk.com/delectable-wine-app/)
- [CellarTracker — App Store](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)
- [CellarTracker — Mobile app](https://mobileapp.cellartracker.com/)
- [CellarTracker — Google Play](https://play.google.com/store/apps/details?id=com.cellartracker.appV2&hl=en)
- [Rob Millis — CellarTracker review (Medium)](https://medium.com/rob-millis-reviews/review-cellartracker-app-46cf5d35b799)
- [Untappd Help — How to Check-In a Beer](https://help.untappd.com/hc/en-us/articles/360034404451-How-to-Check-In-a-Beer)
- [Untappd Help — Venue Check-Ins](https://help.untappd.com/hc/en-us/articles/7087517915796-Venue-Check-Ins)
- [Untappd Help — How to Edit Check-Ins](https://help.untappd.com/hc/en-us/articles/360034403851-How-to-Edit-Check-Ins)
- [Bellingcat — Tracking via the Untappd app](https://www.bellingcat.com/news/2020/05/18/military-and-intelligence-personnel-can-be-tracked-with-the-untappd-beer-app/)
- [Sommo — Best Wine Apps 2026](https://sommo.app/blog/best-wine-apps-2026/)
- [Travelling Corkscrew — Best Wine Apps 2026](https://travellingcorkscrew.com.au/blog/best-wine-apps/)
