# Winery enrichment via Google Places API (New) — feasibility, pricing, plan

**Date:** 2026-09-09 · Part of the Sommo-differentiation workstream
(`sommo-differentiation.md`). Mockup of the target winery page:
`docs/design/mockups/ia-differentiation-2026-09-09.html` (section 3).

## 1. The feature (Pro tier)

Lean into the winery/tasting identity with live Google data:

- **Nearby wineries** on the map / Wineries tab: name, distance, photo, open-now.
- **Winery detail page enrichment**: Google rating + review count, opening hours,
  website/phone, a hero photo, optionally Google's editorial "about" blurb — sitting alongside
  what's already ours (your visits, your wines, your notes, log-a-tasting-here).
- Both gated **Pro**: helps justify $9.99/mo against Sommo's $2.50/mo, and keeps the marginal
  API cost attached to paying users only.

## 2. What it costs (verified against Google's pricing pages, Sept 2026)

Google killed the $200 monthly credit in March 2025; each SKU now has its own free monthly call
cap (Essentials 10K, Pro 5K, Enterprise 1K), then per-1,000 pricing. The calls we need:

| Call | SKU it bills | Free/mo | Then per 1,000 |
|---|---|---|---|
| Nearby Search (name/location/photo-name mask) | Nearby Search **Pro** | 5,000 | $32 |
| Place Details incl. rating, hours, website, phone | Place Details **Enterprise** | 1,000 | $20 |
| …same + `editorialSummary` (the "about" blurb) | Place Details **Enterprise+Atmosphere** | 1,000 | $25 |
| Place photo download | Place Photos | 1,000 | $7 |
| Winery name autocomplete (if we add a search box) | Autocomplete Essentials | 10,000 | $2.83 |

Two gotchas that shape the design:

1. **The field mask decides the bill, at the highest tier of any requested field.** `rating` and
   `regularOpeningHours` are Enterprise-tier fields — there is no cheaper way to show a Google
   star rating. Corollary: **never request `rating` in Nearby Search** (it would bump every map
   search from $32-Pro to $35-Enterprise and cut its free cap 5K→1K). Ratings appear only when a
   winery page is opened.
2. **Google data can't be cached.** Place IDs may be stored forever (we'll persist them on our
   winery records); coordinates for ≤30 days; but ratings, hours, photos, and blurbs must be
   fetched at display time. So enriched rows are live-fetch UI that degrades gracefully offline —
   which we already handle well elsewhere.

**Attribution requirements:** "Google Maps"/Google logo whenever Places data is shown (we
already render on Google Maps for the map tab; detail pages need a small attribution mark),
photo author attribution, and a link out to the place on Google Maps.

### Monthly cost scenarios

Assumes a fairly heavy enriched user: 10 nearby searches + 20 detail views + 30 photo loads per
month. Marginal cost ≈ **$0.93 per enriched active user** ($1.03 with the editorial blurb).

| Enriched MAU | Est. total/mo | With editorial blurb |
|---|---|---|
| 100 | ~$34 | ~$39 |
| 500 | ~$278 | ~$323 |
| 2,000 | ~$1,673 | ~$1,868 |

Since the feature is Pro-only, "enriched MAU" ≈ paying subscribers, and $0.93 against $9.99/mo
revenue is comfortable. If it were free-tier, cost would scale with all users — don't.

**Cost levers, in order:** Pro-gate (done by design) → keep Nearby at the Pro mask → one
size-capped hero photo per page instead of a gallery → skip/gate `editorialSummary` (saves $5/1K)
→ session tokens if we add autocomplete → set a Google Cloud **budget alert** (e.g. $50) day one.

### Alternatives considered (briefly)

OpenStreetMap/Foursquare have free winery pins but no trustworthy ratings/hours/photos; Yelp's
display terms are restrictive. A later hybrid (cheap pins for discovery, Google details on tap)
is the main cost dodge if volume ever makes it worth it. Start Google-only: one vendor, best
winery coverage, and we already ship Google Maps.

## 3. Build plan (proposed epic)

1. **Plumbing:** enable Places API (New) on the existing Google Cloud project, new API key
   (separate from the Maps SDK key, restricted to Places API + our bundle id), budget alert.
   Server-side proxy through a Supabase edge function so the key never ships in the app and we
   can rate-limit + entitle-check per user (same pattern as the `chat` function).
2. **Winery records get a `google_place_id`** (backfill by Text Search IDs-Only — free — plus
   manual confirm on first open; new wineries picked from nearby results carry it natively).
3. **Wineries tab:** merge map + visited list; add Nearby (Pro) with the Pro field mask.
4. **Winery page enrichment:** rating/hours/photo/links block (Pro), attribution, offline
   degradation.
5. Later/optional: editorial blurb, name autocomplete with session tokens.

## 4. Needed from Nick

- Confirm the Google Cloud project has an active **billing account** (required even inside free
  caps). Everything else — enabling Places API (New), creating/restricting the key, setting the
  budget alert, wiring it into the edge function — I can do with existing access; I'll flag if a
  console step turns out to be owner-gated.
- A call on `editorialSummary` (the +$5/1K "about" blurb): include, skip, or decide after seeing
  it in TestFlight (recommend: decide after seeing it — it's a one-line field-mask change).
