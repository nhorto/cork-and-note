# Meta ads research: competitors, what works, and our first two weeks (2026-10-01)

Inputs: Meta Ad Library and Google Ads Transparency pulls for 17 wine apps, 2025–2026 creative and app-install research, and our existing plan (`iphone-launch-ad-plan-2026-09-22.md`). Competitor positioning is in `docs/research/competitive-landscape-2026-09-30.md`.

Competitor frame captures and raw Ad Library dumps are saved outside the repo in `Cork and Note Advertisements/05 Research and plans/2026-10-01 Competitor Meta ads/`.

## 0. Status first

- **Our two statics have been live since 2026-09-30** (they show up in the Ad Library).
- **The binary in review/live has no Meta SDK** (see `docs/handoff/meta-attribution-release-2026-10-01.md`, PR #327). Meta therefore gets no install events.
  - Delivery optimized for installs is learning from nothing.
  - Ads Manager will under-report.
- **Recommendation:** run at the minimum spend until the Meta build is live, then restart learning. Until then:
  - Use App Store Connect first-time downloads and Supabase new users as the only truth.
  - Never add the two together with Meta's numbers.

## 1. Who actually advertises

Only three wine apps run real US app-install campaigns on Meta right now.

| Advertiser | Volume | Format | Angle | Lesson |
|---|---|---|---|---|
| **InVintory** | ~74 US ads (~610 global). One creative ran **15 months** (Jan 2025–Apr 2026). New batch since 2026-09-18 | 100% vertical video, 25–70 s, burned-in captions. Creator-in-cellar plus 3D-cellar screen recordings. End card: "Apple App of the Day · Featured in Wine Spectator, Decanter" | Fear of loss: "That 1980 Bordeaux you forgot about? It already peaked and passed"; "If you love wine but don't track your bottles, you're probably wasting the best ones" | Loss-aversion hooks plus product demo work and last a long time. Trust badges sit on the end card. Web checkout promos ("25% off with SUMMER26") |
| **Vinoperte** | ~52 US ads, started 2026-04-30, ~31 active, new creatives weekly | Almost all video. **10+ different creators** and founder selfie ("Hey folks, my name is Emily and I built a free wine app") | The restaurant moment: "Have you ever been… overwhelmed by all of the wines on the wine list?" Copy attacks crowd ratings: "Other wine apps recommend what 40,000 strangers like…" | Many creators with one tight use case. **Founder-led "I built a free app" is a working format for a solo dev.** Their 4.7★/98 ratings came from this |
| **Ask Sommelier AI** | ~20 US ads since 2026-09-21 | Carousels and short educational videos ("5 wine myths…", palate quiz), driving traffic to Instagram | Luxury, education first | Too new to judge |
| Vivino | One US install static (Aug 6–31 2026, now off): "Stop guessing. Order wines you know you'll love." The rest is EU marketplace catalog ads | Static | Scale and social proof ("trusted by 73M") | Vivino isn't fighting for installs on US Meta. Little competition at the top |

Also seen:
- **Winary:** about 46 French creator-selfie videos ("How many bottles do you really have in your cellar?").
- **Cellarvine:** 2 statics from 2026-10-01, "An AI sommelier in your pocket."
- **Sommy WineCoach:** 73 ads, now inactive. Its hook was "Just deleted another wine app…"

**Not advertising on Meta:** CellarTracker, **Sommo**, **Cork (corkapp.io)**, Pocket Wine, Uncorked, Wine Tripper, Palett, Sommelio, Vino AI, Hugo, Vinea, Wine Whisperer, Wine Folly, Hello Vino. **Nobody advertises winery visits, trips or a winery map.** Only tourism boards and tour operators do, and none of them push an app. That lane is empty.

Couldn't access: TikTok Top Ads (needs login), Apple Search Ads (not public), and paid spy tools. Hooks were read from on-screen text, not audio. To check by hand, use the page IDs below in `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&view_all_page_id=<ID>`:

| Page | ID |
|---|---|
| InVintory | 784272565288253 |
| Vinoperte | 1064527926735347 |
| Ask Sommelier AI | 1271064302762552 |
| Vivino | 78219022708 |
| Winary | 865129813339908 |
| Cellarvine | 1220911554430689 |
| Sommy | 776328618890216 |

## 2. What works for app-install creative (2025–2026 evidence)

- **Creative is now the targeting.** Meta's Andromeda delivery system treats similar-looking ads as one. Count *distinct ideas*, not variants.
- **UGC-style video and real app walkthroughs win.**
  - Liftoff 2025: UGC-style video lifted impression-to-install rate ~152%.
  - AppsFlyer 2025: tutorial-style UGC beat testimonials on installs and day-7 retention.
- **Cheap formats find winners.** Motion's analysis of $500K of spend found text-only ads, product shots with text overlay, and founder or behind-the-scenes content beat cinematic video. Founder content had a hit rate above 8%. Overall only ~5% of creatives become winners.
- **The first 3 seconds carry the ad.** Never open on a logo.
- **Specs:**
  - 9:16 master plus a 4:5 feed version.
  - Captions burned in.
  - 15–25 s, plus a 6–10 s cutdown of any winner.
  - Safe zones: keep text out of the top ~14%, bottom ~35% and ~6% on each side.
- **Avoid:**
  - Polished vineyard b-roll with music (it reads as a winery ad).
  - Feature dumps.
  - Unreadable UI.
  - Near-duplicate variants.
  - Judging ads inside 72 h (iOS data is delayed).
  - Optimizing for link clicks.

## 3. Rules for wine creative

- **Meta:** alcohol-related ads must target **21+ in the US**, and alcohol ads are banned in 19 countries. Meta defers content rules to industry codes.
- **Wine Institute advertising code (Oct 2025):**
  - No excessive drinking.
  - No implied social or sexual success.
  - No drinking near driving.
  - Anyone shown must be **25+**.
  - No health claims.
  - No youth appeal.
  - FTC disclosure for paid creators.
- **Apple:**
  - 1.4.3: don't encourage excessive alcohol.
  - Screenshots must be 4+ appropriate.
- **What this means for our ads:**
  - Trip-planner ads show a tour van, rideshare or designated driver.
  - Passport and recap ads count *wineries and places*, never wines drunk.
  - One tasting pour per person.
  - Mock labels, not real ones.
  - Don't name competitors.
  - No "No subscription" until the credits + unlock pricing actually ships.
  - "14,000+ US wineries" is accurate (14,482).

## 4. Unit economics reality

Under a $14.99 one-time unlock (~$12.74 net after Apple's 15%), break-even CPI is about **$0.38 at a 3% unlock rate** and about **$1.27 at 10%**, before credit revenue. US iOS lifestyle CPIs run roughly **$3–8**. So the first months of paid ads buy *learning, reviews and ranking*, not profit.

Next steps on this:
- Send `first wine logged` and the unlock purchase (with value) as Meta app events so this can be measured.
- Revisit pricing and credits once real unlock and credit rates exist.

## 5. Plan for the first two weeks (~$300–400, ~$20–28/day)

**Structure**
- One App Promotion campaign, Advantage+, iOS.
- One ad set: US, minimum age 21, English.
- Optimize for **installs**.
- No interest targeting.
- Wine country is carried by the creative, not by geo targeting.

**Creative: 3–4 distinct ideas, not variants**
1. **"Loved the wine. Keep the name."** Our proven winner ($0.72 CPC on the Android pilot), rebuilt for iPhone.
2. **"Find your next favorite winery."** The aerial winery map. This is the empty lane nobody advertises.
3. **"6 wines, 1 photo."** Tasting-card scan (r3-02a), our unique feature.
4. *(Add when it can be filmed)* **Founder selfie:** "I'm Nick, I kept losing the names of wines I loved at wineries, so I built a free app." This copies Vinoperte's working format, and it costs nothing.

All need 9:16 versions. That job is with another agent, using the resize prompt dated 2026-10-01.

**Rules for judging**
- Judge each ad after ≥72 h and roughly 3× target CPI in spend.
- Kill an ad at $30 spend with zero installs, or if CPI is more than 2× target.
- Make changes in weekly batches. Scale +15–20% every 3–4 days, and only if day-1 "first wine logged" holds at about 40% or more.

**Benchmarks to compare against**

| Metric | Benchmark |
|---|---|
| CPI | $3–8 |
| CPM | $10–20 (higher late November) |
| Link CTR | 1–2% (2%+ is strong) |
| Video hook rate | ≥25% |
| App Store page conversion | 25–40% |

**Before the Meta build ships:** do the minimum, and treat any reported results as directional only.

## 6. Concept backlog (next rounds)

Five more ideas:
- **"The AI that read my notes":** chat that cites your own ratings.
- **"Me pretending I know this wine list":** a restaurant skit, Vinoperte's lane but with your palate.
- **"Things I wish I'd written down":** a text-only notes-app static.
- **"My winery passport":** pins dropping on a map. Ship this once the passport feature exists.
- **"4 apps → 1":** notes app, spreadsheet, map pins and scanner icons replaced by one app.

Loss-aversion hooks à la InVintory, adapted to our user:
- "That wine you loved in Napa? You'll never find it again."
- "Your best tasting room find is a blurry photo in your camera roll."

Seasonal:

| Window | Theme |
|---|---|
| October | Harvest season and fall trips. Test now, while CPMs are cheap |
| Nov 1–20 | Thanksgiving: "what to open from your cellar" |
| Nov 21–Dec 2 | Hold spend (Black Friday CPM spike) |
| Dec 3–23 | Hosting and "ready to drink now" |
| Dec 26–Jan 10 | "Your year in wine," counting places, not bottles |
| January | Cheapest CPMs, but Dry January. Lead with "plan your spring wine trips," no health angles |
| March–October | Trip season. Winery passport and planner |

## Sources (selection)

- Meta Ad Library pages above.
- [Google Ads Transparency: invintory.com](https://adstransparency.google.com/?region=US&domain=invintory.com)
- [Meta alcohol policy](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/alcohol/)
- [Wine Institute advertising standards (2025)](https://wineinstitute.org/wp-content/uploads/2025/10/Wine-Advertising-Standards-Guidelines.pdf)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Liftoff creative index](https://liftoff.ai/?p=34539)
- [AppsFlyer creative trends](https://www.appsflyer.com/company/newsroom/pr/ai-emotion-creative-trends/)
- [Motion: $500K Meta analysis](https://motionapp.com/library/talk/we-analyzed-500k-in-meta-ads-to-find-hooks-formats-that-always-win/)
- [Motion creative benchmarks 2026](https://motionapp.com/library/research/creative-benchmarks-2026/)
- [Jon Loomer on Andromeda](https://www.jonloomer.com/meta-andromeda/)
- [Meta Advantage+ app campaigns](https://developers.facebook.com/blog/post/2025/06/03/advantage-plus-campaign-experience-for-sales-and-app/)
- [Geist Q4 CPM trends](https://geistm.com/blog/meta-rate-trends-q4-2025/)
