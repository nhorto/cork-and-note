# Richer winery-page content without heavy Google spend — sources, costs, plan

**Repo:** `nhorto/cork-and-note` · **Issue:** #226 (research) · **Epic:** #203
**Status:** Research doc. **No code changed by this document.** Implementation is proposed as the phased plan in §7.
**Date:** 2026-09-10
**Companion doc:** `winery-enrichment-google-places.md` (the Google-only cost analysis this extends).

---

## 0. The ask

The winery detail page (`app/winery/[id].js`) today shows the user's own data (visits,
wines, notes) plus the **Pro-gated Google card** — rating, hours, one photo — served live
through `supabase/functions/places/index.ts` (Place Details Enterprise + Place Photos, nothing
cached but the place ID). The owner wants **more per winery** — photos, a description, story,
offerings — without significant Google Places spend.

The structural insight of this doc: **Google is the only source we use that forbids storing
its content.** Every other viable source (Overture, the winery's own website, Wikidata/
Wikipedia) lets us enrich **at build time, store the result in `winery_directory`, and serve
it to everyone for $0 marginal cost**. Google should stay what it already is — a thin, live,
Pro-only layer for the two things nothing free provides (star rating + live hours) — and the
new richness should come from stored layers underneath it.

---

## 1. TL;DR — the recommendation

1. **Don't buy more Google.** The current field mask already bills the cheapest SKU that can
   carry a rating (Enterprise, $20/1K after 1K free). There is **no cheaper mask that keeps
   `rating`** (§2.3), and `editorialSummary` (the obvious "description" field) upgrades every
   call to Enterprise + Atmosphere (+$5/1K) *and* is banned from caching. Skip it.
2. **Re-extract more Overture columns we already paid nothing for** — `phones`, `socials`,
   `emails`, `brand`, alternate categories — same release, same license, one DuckDB query,
   stored forever. (§3.1)
3. **Build-time first-party enrichment** from each winery's own `website` (present in the
   directory): `og:title` / `og:description` / `og:image` + schema.org JSON-LD. One ~14.5K-URL
   crawl, quarterly refresh, robots.txt honored, image displayed by URL (not copied) with a
   prominent link-back. This is the highest-coverage description + photo source available at
   any price — it's the winery's own self-description, in their own words. (§5)
4. **Wikidata/Wikipedia layer for the famous few hundred** — free-text description + a
   Commons photo with per-file attribution. Low coverage (~3–5% of the directory), high value
   on exactly the wineries users search for. (§3.2)
5. **Skip Yelp, Foursquare, and Tripadvisor.** All three are now paid-per-call with 24-hour
   (or no) caching and heavy display-attribution rules — structurally the same trap as
   Google, with worse winery coverage. (§4)
6. **Cost at scale:** the free layers are $0/month at any volume. The Google Pro card stays
   ~$0 up to ~1,000 winery-page opens/month (inside free SKU caps) and ~**$180–240/mo at
   10,000 opens** — and because it's Pro-gated, that spend only exists when revenue does. (§6)

---

## 2. Google Places: verified costs, SKU mechanics, caching rules

Verified against Google's pricing and SKU pages, 2026-09-10. The March 2025 change (no more
pooled $200 credit; per-SKU free monthly call caps) still stands.

### 2.1 Price table (Places API New, per 1,000 calls, first paid tier)

| SKU | Free calls/mo | Then per 1K |
|---|---:|---:|
| Place Details **Essentials** | 10,000 | $5.00 |
| Place Details **Pro** | 5,000 | $17.00 |
| Place Details **Enterprise** ← *our `details` mode* | 1,000 | $20.00 |
| Place Details **Enterprise + Atmosphere** | 1,000 | $25.00 |
| Place **Photos** ← *our `photo` mode* | 1,000 | $7.00 |
| Text Search **Essentials (IDs-only)** ← *our `match` mode* | **unlimited** | free |
| Text Search Pro | 5,000 | $32.00 |
| Nearby Search Pro | 5,000 | $32.00 |
| Autocomplete Essentials | 10,000 | $2.83 |

Sources: [pricing table](https://developers.google.com/maps/billing-and-pricing/pricing),
[SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details).

### 2.2 Which fields sit in which SKU (the ones we care about)

| Tier | Fields |
|---|---|
| Essentials | `id`, `formattedAddress`, `location`, `types`, `viewport` |
| Pro | `displayName`, `googleMapsUri`, `primaryType` |
| Enterprise | `rating`, `userRatingCount`, `regularOpeningHours`, `currentOpeningHours`, `websiteUri`, `nationalPhoneNumber` |
| Enterprise + Atmosphere | `editorialSummary`, `generativeSummary`, `reviews` |

Billing is **highest tier of any requested field**; `photos` bills separately as Place Photos.

### 2.3 Can we downgrade the field mask? Mostly no — but we can *shrink the photo bill*

- Our `details` mask requests `rating`/`userRatingCount`/hours → **Enterprise is the floor**
  for the card as designed. Dropping to a Pro mask ($17/1K, 5K free) means dropping the
  rating and hours — i.e. dropping the card's whole point. Not worth $3/1K.
- `websiteUri` and `nationalPhoneNumber` in the mask are **redundant once §3.1 lands**
  (Overture has them, storable). Removing them doesn't change the SKU, but it's hygiene:
  never fetch live what we already store.
- **`editorialSummary` stays out.** It's +$5/1K on *every* details call, its free cap is the
  same 1K, and — decisive — it may not be cached, so it can never become stored content.
  The first-party `og:description` (§5) is a better description at $0.
- The real Google lever is the **photo call**: once §5 gives most wineries a stored
  `og:image` hero (and users' own visit photos already take precedence), the `photo` mode
  becomes a rare fallback instead of a per-page-open call. At 10K opens/mo that alone is
  ~$63/mo saved (§6).

### 2.4 Caching policy (what the layered strategy is legally built on)

Per the [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
and [service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms):
**place IDs may be stored indefinitely** (we do); **lat/lng up to 30 consecutive days**;
**everything else — names, ratings, hours, photos, summaries — has no caching allowance**
and must be fetched at display time. This is why "cache Google harder" is not an available
strategy, and why the enrichment must come from sources that permit storage.

---

## 3. Open/free sources

### 3.1 Overture Maps — columns we left on the table (best effort-to-value ratio here)

Our 14,482-row directory (`data/winery-directory/`, release `2026-08-19.0`,
CDLA-Permissive-2.0) extracted only name/coords/address/website. The same
[place schema](https://docs.overturemaps.org/schema/reference/places/place/) also carries,
per row where the upstream providers have it:

- **`phones`** — display + tap-to-call, replaces the Enterprise `nationalPhoneNumber` fetch.
- **`socials`** — Facebook/Instagram URLs; tasting-room culture lives on Instagram, this is
  a genuinely rich "story" link for a small winery.
- **`emails`**, **`brand`** (incl. Wikidata QIDs where present — a free join key for §3.2).
- **`categories.alternate`** — e.g. a winery that's also `wine_tasting_room`/`wine_tours`:
  cheap "offerings" chips.

Cost: one re-run of the documented DuckDB query with more columns selected, same license and
attribution we already carry. Storable forever, no display restrictions beyond the existing
citation. **Do this first.**

### 3.2 Wikidata + Wikipedia + Commons — deep content, shallow coverage

- Live SPARQL count (2026-09-10): **374** US entities with `instance of = winery` (Q156362)
  — call it a few hundred to ~1K including vineyard/company-typed items. So ~**3–5% of the
  directory**, but it's the *famous* 3–5% (Mondavi, Ste. Michelle, Barboursville…), which is
  where users most expect a story.
- Per matched entity: Wikipedia **summary extract** via the free
  [REST API](https://en.wikipedia.org/api/rest_v1/) (`/page/summary/{title}`) — a real
  encyclopedic paragraph, license **CC BY-SA 4.0** → store it, show "From Wikipedia" + link.
- **Commons image** (`P18` or the [Wineries in the US category](https://commons.wikimedia.org/wiki/Category:Wikimedia_Commons)) —
  each file has its own license (mostly CC BY/BY-SA); per-file attribution string must be
  shown or linked. Storable/resizable within license terms.
- Matching: `brand.wikidata` from §3.1 where present, else name+state+coords match at build
  time. Wikidata itself is CC0 — no strings on the structured data.

### 3.3 OpenStreetMap — thin marginal value here; use with care

Taginfo (2026-09-10): ~**17.5K `craft=winery` objects globally**; of those, `website` 41.3%,
`phone` 29.8%, **`opening_hours` only 14.5%** ([taginfo](https://taginfo.openstreetmap.org/tags/craft=winery)).
US share is a fraction of that, and Overture already blends OSM-derived data. The one unique
field — stored opening hours — has coverage too low to promise users, and OSM's **ODbL
share-alike** applies to a database we'd derive by blending it into `winery_directory`
(attribution required, and arguments about publishing the derived DB get real). Verdict:
**skip as a bulk layer**; revisit only if we ever want a stored-hours fallback and are happy
to publish the merged extract.

---

## 4. Commercial alternatives — all three fail the same test (verified Sept 2026)

The test: *does it let us store content so cost doesn't scale with page views?* No.

| API | Cost (2026) | Caching | Display terms | Verdict |
|---|---|---|---|---|
| **Yelp Fusion / Places** | Free tier ended; plans ~[$7.99–$14.99/1K calls](https://business.yelp.com/data/resources/pricing/), 300–500 calls/day caps | [Max 24h](https://terms.yelp.com/developers/api_terms/20250113_en_us/) | Mandatory Yelp branding/attribution on any listing data; content "must stand alone" | Same live-fetch trap as Google, worse winery coverage, plus fees on the free tier of *our* app. **Skip.** |
| **Foursquare Places** | Since June 2026: [500 free Pro calls/mo, then $15/1K](https://docs.foursquare.com/developer/reference/upcoming-changes) | Live API; the open dataset (FSQ OS Places) is now [gated on Hugging Face](https://huggingface.co/foursquare) (see directory README history) | FSQ attribution | Barely cheaper than Google Details with less winery data (no ratings culture for rural wineries). **Skip.** |
| **Tripadvisor** | Content API (5K free calls/mo) **sunset 2026-08-31** — already dead; successor **Terra API**: [1K free calls, then pay-as-you-go](https://developer-tripadvisor.com/content-api/) | Live-fetch oriented | Bubble-rating rendering, review dates, TA credit required | Betting a feature on an API mid-sunset is how the FSQ OS Places blocker happened. **Skip.** |

---

## 5. First-party website enrichment (the centerpiece)

Most of the 14,482 rows carry a `website`. Every modern winery homepage self-describes for
exactly this kind of display: `og:title`, `og:description`, `og:image` exist *so that third
parties render preview cards*, and many sites additionally ship schema.org
`Winery`/`LocalBusiness`/`FoodEstablishment` JSON-LD (description, image, openingHours,
amenities). A build-time pipeline:

1. **Fetch** each `website` homepage (14.5K URLs is trivial: ~1–2 req/s with a honest
   `User-Agent` identifying cork-and-note + contact email finishes in a few hours; run as an
   owner-run script like `load-winery-directory.mjs`, not in the client and not in CI).
2. **Respect `robots.txt`** for our UA before fetching each site (and skip on disallow).
   Legally we're fetching one public page per site — the kind of access the *hiQ v.
   LinkedIn* line of cases treats as lawful for public data — but honoring robots is cheap
   and removes the argument entirely.
3. **Extract** og tags + JSON-LD; store `og_title`, `og_description` (truncate ~300 chars),
   `og_image_url`, `jsonld_description`, `jsonld_hours` (display-only, "per their website"),
   `fetched_at` on `winery_directory`.
4. **Display**: description shown quoted with source line — *"From ⟨winery⟩'s website ↗"* —
   linking out. **Short quoted self-descriptions with attribution and a link-back are
   low-risk**; they're also exactly what the sites publish those tags for.
5. **Images — the one honest risk in this section.** Two options:
   - *Hotlink the `og:image` URL* (no copy on our servers). Under the Ninth Circuit's
     [server test (Perfect 10 v. Amazon)](https://en.wikipedia.org/wiki/Perfect_10,_Inc._v._Amazon.com,_Inc.)
     embedding without copying doesn't infringe the display right — but note honestly:
     [SDNY rejected the server test in *Goldman v. Breitbart*](https://www.venable.com/insights/publications/2025/08/federal-courts-split-on-server-test-in-copyright)
     and the circuits remain split. Hotlinking also leaks our users' requests to 14K origins
     and breaks when sites restructure.
   - *Cache a resized thumbnail in Supabase Storage.* Technically a copy — weaker copyright
     posture than hotlinking, stronger UX. Mitigation: it's the image the site designates
     for third-party preview, shown as a link-preview card for that same site.
   - **Recommendation:** hotlink at render time with graceful fallback (user photos →
     Google photo for Pro → placeholder), keep the card visually a *link preview* (tap opens
     the site), and publish an easy takedown path (support email; delist on request,
     honored within days). Revisit thumbnail-caching only if hotlink breakage proves ugly.
6. **Freshness:** re-run quarterly (og data drifts slowly); re-fetch on-demand rows whose
   image URL 404s. Store `fetch_status` so dead sites don't re-block the run.

Expected coverage (to be measured in the Phase-1 spike, not promised): winery sites are
marketing sites; og tags are near-universal on Squarespace/Wix/WordPress builds. A realistic
expectation is **60–80% of rows with a usable description and 50–70% with a usable image** —
an order of magnitude beyond any other source, free or paid.

---

## 6. Cost model — winery-detail views per month

"View" = one winery-page open. Free layers (Overture + first-party + Wikipedia) are stored,
so their serving cost is $0 at any volume (Supabase Pro already covers this comfortably —
see companion doc §2.5). Google spend only exists for **Pro users** opening pages, at 1
Details Enterprise call/open, photo call only when no stored/user image exists (assume 30%
of opens post-enrichment vs 100% today).

| Pro winery-page opens/mo | Today (details + photo every open) | Recommended (details + 30% photo) | If we also added `editorialSummary` |
|---:|---:|---:|---:|
| 100 | $0 (inside 1K free caps) | **$0** | $0 |
| 1,000 | ~$0 (at the cap edge) | **~$0** | ~$0 |
| 10,000 | $180 + $63 = **~$243** | $180 + $14 = **~$194** | $216 + $14 = ~$230 |
| 50,000 | ~$1,323 | **~$1,083** | ~$1,328 |

(Math: details (n−1,000)×$20/1K; photos (0.3n−1,000)×$7/1K, floored at 0. Free-tier caps
reset monthly.) Context: 10K Pro page-opens/mo ≈ 1,250 Pro subscribers at the ~8 opens/user
observed assumption ≈ $12K+/mo revenue against ~$194 of Google — **~1.6% of revenue**. The
existing per-user rate limits and Google Cloud quota caps (hard stop) stay as the ceiling.
Free-tier users at *any* volume: $0, because they only ever touch stored layers.

---

## 7. Proposed phased implementation

1. **Phase 1 — Overture re-extract** (small): re-run the documented DuckDB query selecting
   `phones`, `socials`, `emails`, `brand`, `categories.alternate`; add columns +
   migration; render phone/socials/offerings chips on the winery page for everyone.
   *Also:* the deferred `fsq_place_id`→`external_place_id` rename (directory README) rides
   along.
2. **Phase 2 — first-party enrichment spike, then full run** (the big win): script per §5;
   spike on ~200 random rows first to measure real og coverage and publish the number;
   then full run + `winery_directory` columns + the link-preview card UI + takedown path
   in the site/app footer.
3. **Phase 3 — Wikidata/Wikipedia layer** (small, high polish): build-time match (QIDs from
   `brand` + name/state), store summary + Commons image ref + attribution strings; "From
   Wikipedia" block for the famous wineries.
4. **Phase 4 — Google trim** (tiny): drop `websiteUri`/`nationalPhoneNumber` from the
   details mask (redundant post-Phase 1); make `photo` mode fallback-only when no stored
   hero exists. No SKU change; shrinks the photo bill ~70%.
5. **Not doing:** `editorialSummary`, Yelp, Foursquare live API, Tripadvisor/Terra, bulk OSM.

---

## 8. Sources

- Google pricing: https://developers.google.com/maps/billing-and-pricing/pricing · SKU/field tiers: https://developers.google.com/maps/billing-and-pricing/sku-details
- Google caching/attribution policy: https://developers.google.com/maps/documentation/places/web-service/policies · https://cloud.google.com/maps-platform/terms/maps-service-terms
- Overture place schema: https://docs.overturemaps.org/schema/reference/places/place/ · attribution: https://docs.overturemaps.org/attribution/
- Wikidata SPARQL (winery count run 2026-09-10): https://query.wikidata.org/ · Wikipedia REST summaries: https://en.wikipedia.org/api/rest_v1/ · Commons category: https://commons.wikimedia.org/wiki/Category:Wineries_in_the_United_States
- OSM taginfo `craft=winery`: https://taginfo.openstreetmap.org/tags/craft=winery · tag docs: https://wiki.openstreetmap.org/wiki/Tag:craft%3Dwinery
- Yelp pricing/terms: https://business.yelp.com/data/resources/pricing/ · https://terms.yelp.com/developers/api_terms/20250113_en_us/ · display: https://terms.yelp.com/developers/display_requirements/
- Foursquare pricing change: https://docs.foursquare.com/developer/reference/upcoming-changes · https://foursquare.com/pricing/
- Tripadvisor Content API sunset / Terra: https://developer-tripadvisor.com/content-api/
- Server test / embedding split: https://en.wikipedia.org/wiki/Perfect_10,_Inc._v._Amazon.com,_Inc. · https://www.venable.com/insights/publications/2025/08/federal-courts-split-on-server-test-in-copyright
