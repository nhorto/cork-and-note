# App Store Connect listing pack

**Prepared:** 2026-09-07 · Companion to [`launch-plan-2026-09.md`](launch-plan-2026-09.md) §2.2 and [`owner-checklist.md`](owner-checklist.md) §B

Everything App Store Connect asks for, written out so it can be pasted in. Character counts are enforced against Apple's limits — **the name suggested in the launch plan ("Cork & Note: Wine Tasting Journal") is 33 characters and would be rejected**; the one below is 25.

---

## 1. App information

| Field | Value | Limit |
|---|---|---|
| **Name** | `Cork & Note: Wine Journal` | 25/30 |
| **Subtitle** | `Log tastings & winery visits` | 28/30 |
| **Primary category** | Food & Drink | |
| **Secondary category** | Lifestyle | |
| **Bundle ID** | `com.nicholashorton.corkandnote` | |
| **Privacy Policy URL** | https://cork-and-note.vercel.app/privacy | |
| **Support URL** | https://cork-and-note.vercel.app/support | |
| **Marketing URL** | https://cork-and-note.vercel.app | |
| **Copyright** | `2026 Nicholas Horton` | |

## 2. Keywords (95/100)

```
wine,tasting,journal,winery,cellar,sommelier,vineyard,label,scan,notes,bottle,tasting room,vino
```

Do **not** repeat words already in the name or subtitle — Apple indexes those separately, so "wine", "tasting" and "journal" are only here because the name uses different inflections. Revisit monthly against App Store search terms.

## 3. Promotional text (122/170)

Editable any time without a new build — use it for seasonal hooks.

```
Your tasting-room memory. Log every wine, remember where you had it, and ask a sommelier who has actually read your notes.
```

## 4. Description

```
Cork & Note is the wine journal for people who actually go to wineries.

You taste six wines in an afternoon, love the third one, and by the next weekend you cannot remember its name. Cork & Note fixes that.

LOG THE TASTING ROOM
Capture each wine as you taste it — ratings, flavour notes, a photo, and how it made you feel. Tag the winery, the restaurant, or nowhere at all. A wine logged without a location still counts.

SCAN THE LABEL
Point your camera at a bottle or a tasting-room card and let Cork & Note fill in the producer, the vintage and the grapes, so you can get back to drinking.

REMEMBER WHERE YOU HAVE BEEN
Every place you have logged, on a map and in a list, with the wines you tried at each one. See your most-visited winery and everywhere you have explored.

KEEP A CELLAR
Track the bottles you own with drink windows that tell you what is ready now, what needs holding, and what to open tonight before it slips past its peak.

ASK A SOMMELIER
An AI wine companion grounded in your own ratings. Ask what to open with dinner, what you might enjoy next, or let it pick tonight's bottle from your cellar. It knows what you actually liked, because it has read your notes.

BUILT FOR REAL TASTING ROOMS
Works when the signal does not. Cork & Note tells you when you are offline instead of pretending to save.

Cork & Note is for people of legal drinking age. Please drink responsibly.
```

## 5. What's New (first release)

```
The first release of Cork & Note. Log the wines you taste, remember the places you tasted them, keep track of your cellar, and ask a sommelier that knows your palate.
```

## 6. Age rating questionnaire — ✅ submitted 2026-09-08

Apple's 2026 tiers are 4+ / 9+ / 13+ / 16+ / 18+. Everything was answered "None" **except**, and this table is kept as the record of what was submitted:

| Question | Answer |
|---|---|
| Alcohol, Tobacco, or Drug Use or References | **Frequent/Intense** |
| Contests | None |
| Gambling | No |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Profanity or Crude Humor | None |
| Sexual Content or Nudity | None |
| Violence (all forms) | None |
| Unrestricted Web Access | No |
| User Generated Content | No — journal entries are private to the account, not shared or browsable |

Expected result: **18+**. This matches Delectable and Vivino.

## 7. App Privacy questionnaire — ✅ submitted 2026-09-08

Kept as the record of what was submitted. **Revisit it if analytics are ever added** — Usage Data was answered "not collected", and PostHog would change that.

For each item: **Linked to the user: Yes**, **Used for tracking: No**, purpose **App Functionality** unless noted.

| Data type | Collected | Why |
|---|---|---|
| Contact Info → Email Address | Yes | Account creation and sign-in |
| User Content → Photos or Videos | Yes | Wine, visit and cellar photos the user attaches |
| User Content → Other User Content | Yes | Tasting notes, ratings, sommelier chat messages |
| Location → Precise Location | Yes | Map, nearby wineries, tagging a visit's location. Foreground only |
| Identifiers → User ID | Yes | Supabase account id (and the RevenueCat app user id once Pro ships) |
| Diagnostics → Crash Data | No | Not currently collected |
| Usage Data | No | Not currently collected — **change this if PostHog is added** |

**Nothing is used for tracking, and no data is shared with data brokers or advertisers.** Third-party processors (Supabase, Anthropic) act on our behalf and are disclosed in the privacy policy.

## 8. Review notes

```
Cork & Note requires an account because every tasting note, photo and cellar
bottle is private to the user. A demo account is provided below and is seeded
with visits, wines and cellar bottles so all features are reachable.

Demo account:
  Email:    review@corkandnote.com
  Password: (provided separately - this repo is public)

Notes for the reviewer:
1. The AI sommelier (Profile > Ask the sommelier, and "Tonight's Pick" on Home)
   sends the text of the conversation, context from the user's own tasting
   history, and any photo they choose to scan to Anthropic's API to generate a
   response. This is disclosed in the privacy policy. Under Anthropic's
   commercial terms this data is not used to train models.
2. Label scanning uses the camera only when the user taps a scan button.
3. Location is requested only when the user opens the map or tags a visit, and
   is never collected in the background.
4. Account deletion is at Profile > Account settings > Delete account. It
   permanently removes the account and all associated data immediately.
```

## 9. Screenshots — 6.9" iPhone (required)

**Captured 2026-09-07 and committed to [`docs/marketing/screenshots/`](../marketing/screenshots/)** at 1320x2868, the exact 6.9" size Apple requires. Taken from the seeded demo account on an iPhone 16 Pro Max simulator, with a normalised 9:41 / full-signal status bar.

| # | File | Screen | Caption |
|---|---|---|---|
| 1 | `1-home.png` | Home | Every wine you've tasted, in one place |
| 2 | `2-log-a-tasting.png` | Add wine (scan prompt + rating form) | Capture it while you're still in the tasting room |
| 3 | `3-winery-visits.png` | Winery page with past visits | Remember what you drank, and where |
| 4 | `4-explore-map.png` | Explore map with your places | See everywhere you've been |
| 5 | `5-sommelier.png` | Sommelier + Tonight's Pick | Ask a sommelier who's read your notes |

6.5" is optional — Apple scales the 6.9" set down. iPad shots are not needed unless the app is submitted as universal.

**To regenerate** (after a UI change, or for a different device size):

```sh
eas build -p ios --profile simulator          # standalone sim build
xcrun simctl boot "iPhone 16 Pro Max" && open -a Simulator
xcrun simctl install booted /path/to/CorkNote.app
CORKNOTE_DEMO_PASSWORD=... ./scripts/capture-screenshots.sh
```

The script drives the app by writing an initial route into its AsyncStorage and
relaunching, rather than by tapping: `simctl` has no touch injection,
`idb-companion` no longer builds against current Command Line Tools, and
AppleScript clicking needs macOS Accessibility permission. The hook that reads
that route is compiled in **only** when the `simulator` build profile sets
`EXPO_PUBLIC_SCREENSHOT_MODE=1`, so it cannot exist in a production binary.

Two things worth improving before submission if there's time: shot 2 shows an
empty form (a partly-filled one would sell the feature harder), and shot 5 has
no past conversations. Both are demo-data changes, not code.

## 10. Demo account — created and seeded 2026-09-07

The review account already exists on production and is seeded, so every feature
is reachable on first launch:

| | |
|---|---|
| Email | `review@corkandnote.com` |
| Password | **not committed** — this repository is public. Paste it straight into App Store Connect from the credentials handed over separately. |
| Seeded with | 4 visits (one deliberately place-less, to show location-optional logging), 5 wines with ratings and flavour notes, 3 wineries with real map pins, 4 cellar bottles spanning every drink-window status (ready / drink soon / too young / past peak), 1 wishlist entry |

To re-seed or change it later, ask Claude — the account is managed through the
Supabase Management API, not through a committed script, precisely so the
password never lands in git.

---

**Still needed before submission (as of 2026-09-08):**

- **The owner's read-through of the legal pages.** The governing law (Maryland) and legal name (Nicholas Horton, individual) were answered on 2026-09-08 and are in `lib/legalContent.js`; what is left is Nick reading the result.
- **A real support email in the listing and in the legal pages.** The mailbox exists as of 2026-09-08 but its address has not reached the repo. Note that **§8 and §10 below name `review@corkandnote.com`, on a domain that is not owned yet** — the demo account works, but that address needs replacing before submission.
- **Paywall screenshots for review.** v1 ships with the paywall (decided 2026-09-08), so App Review will look at the purchase screen. Needs the next EAS build to capture.

The 6.9" screenshot set is captured and committed (§9). Age ratings and App Privacy are submitted (§6, §7).
