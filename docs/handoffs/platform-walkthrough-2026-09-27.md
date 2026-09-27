# Handoff: bring the platform's walkthrough changes into Cork & Note

Written 2026-09-27, for a Claude session working only in this repo (`nhorto/cork-and-note`).
This session has no access to the conversation that produced this document. Everything you
need is either below or in the linked files.

## Background

Nick runs an app family on a shared platform (`nhorto/app-platform`): Cask & Note (whiskey) and
Agave & Note (tequila and mezcal) share code there. Cork & Note is the original app and still
lives in its own repo. It will eventually move into the platform as `apps/cork`, but that has not
happened yet, and Cork is currently in App Store Review for its 1.0 release.

On 2026-09-27 Nick did a walkthrough of Cask on the simulator and asked for a set of experience
changes. He wants Cork's users to get the same improvements now, adapted to wine, rather than
waiting for the repo move. This document maps each chosen change onto Cork's actual files.

Nothing here has been built. No code in this PR changes; it adds only this one file.

## 1. What changed on the platform, and why (Nick's reasoning, short)

- **The log form buried what was required.** Only the distillery and expression were required to
  save a pour, but the form never said so, and people did not know what they could skip. Nick
  wants that shown without a wall of asterisks.
- **"More detail" was one long panel.** It is splitting into named sections (tasting notes,
  structure, color and glass, bottle facts) so a big section like bottle facts stops crowding
  everything else.
- **Photos on entries are becoming a Pro feature**, because photo storage costs money. Nick
  believed Cork already gated photos. It does not. Its plan screen currently says photos are
  free and unlimited on both tiers. He decided Cork changes too, on the same day: Cork's testers
  are people he knows, on TestFlight only, so there is no promise to existing users to protect
  and no need to grandfather anyone in.
- **The palate/taste report is Pro but hard to find** (buried on Profile). It is moving onto
  Home, with a free teaser so free users see what they would get.
- **Badges are Pro-agnostic but also buried** on Profile. They are moving onto Home too, into the
  hero card.
- **The guide's replies do not stream on the phone**, they arrive all at once. This turned out to
  be the hosted Supabase gateway gzip-compressing the response and holding it until the end,
  because iOS offers gzip compression by default and the app never said not to. The fix is one
  request header.
- **The guide should open straight into a blank chat**, like the chat apps people already use,
  with a New chat button, and the "what can I help with" block and example questions living
  inside that blank chat rather than a separate hub screen.
- **Chips that need more information (like "cigar pairing", "for what?") should never half-fill
  the input and wait for a tap.** A chip that is a full question sends immediately. A chip that
  needs a choice opens a quick picker, then sends.
- **The journal list and item detail read as bland** compared to the richer bottle/cellar detail
  screens. Nick liked the cellar side's art, color and actions better and asked for both the list
  and the detail screen to get some of that treatment.

Full detail, including the options Nick did not pick, is in
`docs/factory/33-walkthrough-feedback-2026-09-27.md` (items WF1 to WF14) and the "Mockup picks"
section at the end of that file, in `nhorto/app-platform`.

## 2. Item by item: what to do in Cork

Cork's own names: the guide is called the sommelier, not Stillman or Tahona. The collection tab
is the cellar. The journal (tasting history) is the "Wines" tab, `app/(tabs)/wines.js`. A tasting
entry lives across `app/log-session.js` (the visit: place, date, notes, visit-level photos) and
`components/WineEntryForm.js` (the actual wine: identity, ratings, flavor notes, photos).

### A. Log form: show what's required, split "more detail" into sections (WF1, WF2)

Mockup: `docs/mockups/log-form-directions.html` in app-platform, direction **A3 with A2's save bar
line** for the required marker, and **B1, four collapsible cards** for the split.

Cork's form (`components/WineEntryForm.js`) already requires only the winemaker field (line ~674,
labelled "Winemaker *") and shows a "Missing Information" alert if it's blank on save (around
line 568). That alert is the exact pattern Nick wants replaced. Cork also already has
`components/CollapsibleSection.js` (the accordion component) and three collapsible sections
today: "Detailed ratings" (four meters: sweetness, tannins, acidity, body), "Flavor notes", and
"Photos", all under a plain "More detail, optional" label (around line 820).

What to build, adapted to wine:
- Drop the `*` from "Winemaker" and instead: one line under the wine identity fields saying
  "The only thing a tasting needs" (or similar), a labelled rule reading "Optional from here"
  placed right after the winemaker field, and a sticky save bar that reads "Pick a winemaker to
  save" (dimmed save button, tapping it scrolls up to the field) then "Ready to save. Everything
  else is optional." once winemaker is filled in. Replace the `Alert.alert('Missing Information', ...)`
  call with that scroll-and-highlight behavior.
- Reorganize the existing collapsed content into four named cards, in this order: **Tasting
  notes** (nose, palate, finish equivalents, i.e. today's "Flavor notes" section content),
  **Structure** (today's "Detailed ratings" meters: sweetness, tannins, acidity, body), **Color
  and glass** (new for Cork, see note below), **Wine facts** (vintage, varietal, region,
  producer; this is the wine version of "bottle facts", and Nick called the whiskey equivalent
  "huge" so give it real room). Cork's identity fields (winemaker, varietal chips, name/type/year)
  currently live inline above the collapsible area; decide whether they move into the new "Wine
  facts" card or stay inline as the required/near-required fields ahead of it. Region does not
  exist as a field in Cork today (a code comment at line ~343 notes "the tasting form has no
  region field, ignored" when applying label-scan suggestions), so adding it is new work, not a
  rename.
  - "Color and glass" has no Cork equivalent yet. Whiskey's version tracks a color grade and the
    glass used to taste it. Wine's natural version is appearance (color/clarity within the wine's
    type, e.g. garnet, straw, salmon) and the stemware or serving glass used. This needs its own
    small design pass before building; do not guess the exact fields without checking with Nick,
    since it is new ground for Cork rather than a straight rename.
  - Keep each section's live one-line summary when collapsed (Cork's `CollapsibleSection` already
    supports `summary` and `hasData`; reuse that, do not build a new pattern).
- Move photos out of the collapsible area entirely, to their own step at the very end of the
  form, right above the save bar, matching item B below (Pro-locked, no free allowance).

### B. Photos on entries become a Pro feature (WF4)

Cork's `app/choose-plan.js` currently lists "Tastings, notes & photos: Unlimited" as free (line
~30 in the comparison table) and its subtitle says "Your journal is free forever, every tasting,
place, photo and note" (line ~95). Both need to change: split "photos" out of that free row into
its own Pro-only row, and reword the subtitle so it stops promising free photos. Check
`app/paywall.js` too; it already treats sending a photo to the sommelier as a Pro perk (line
~196), which stays as is, that part does not change. The entry/tasting photo gate itself
(`components/WineEntryForm.js`, the "Photos" section, and the visit-level photos in
`app/log-session.js`) needs the actual lock: same idea as item A's photo step, a Pro check before
the camera/library buttons work, with a clear "See what Pro includes" link for free users. No
free photo allowance, per Nick, same as the platform's rule.

### C. Guide: blank chat, New chat, chips that send or ask first (WF10 note, WF11, WF12)

Mockup: `docs/mockups/guide-new-chat-directions.html`, **direction 2, open straight into a blank
chat**. Nick specifically wants the message thread itself (the bubbles, the streamed reply, the
whole chat window) to look like the mockup, in Cork too.

Cork's `app/(tabs)/sommelier.js` is closer to this than Cask started out: it already has a "Start
new chat" pill, starter questions inside an active chat ("TRY ASKING", sent as-is on tap), and a
hub hero with an ask box. The gaps against direction 2:
- Today the tab opens on a hub (hero "What can I help you with?", ask box, guided tools, recent
  chats), not straight into a blank chat. Direction 2 removes that hub as its own screen: the tab
  opens on a blank chat by default (or the last chat if it was within the last hour), with a
  labelled New chat button, and the "what I can help with" content and guided tools become the
  first things shown inside that blank chat.
- Cork's `STARTER_CHIPS` (in `sommelier.js`, around line 44) currently half-write the question
  into the input and just focus it, e.g. "Wine basics" prefills "In simple terms, what is ". Per
  WF12, a chip that is a complete question should send immediately, and a chip that needs
  something picked first (Cork's own version of "cigar pairing" might be "food pairing for what?"
  or "closest match in my cellar") should open a quick picker (recent tastings, cellar bottles,
  or "something else"), then send. Check which of Cork's existing chips are which kind and split
  them accordingly; do not just add a picker to all of them.
- `components/ChatBubble.js` and the surrounding chat screen should be restyled to match the
  mockup's bubble and thread look. Read the mockup's bubble section before changing
  `ChatBubble.js`; it is meant to be visually distinct from Cork's current styling.

### D. Home: taste report teaser and badges (WF6, WF7)

Mockup: `docs/mockups/home-palate-and-badges-directions.html`, the picked blend: **badges in the
hero card** (as in its direction 3), **everything else as direction 1** (the taste report as its
own section with a free teaser, below the hero).

Cork already has both underlying features, just not on Home. `lib/tasteProfile.js` is Cork's
"My taste" Pro tool (`MIN_DISTINCT_FOR_REPORT`, `canUsePalateReport`-equivalent gating). Note it
is different from Cask's: Cork's report calls the AI model to write the plain-language summary,
Cask/Agave compute theirs entirely on-device. Do not recompute or re-call the model on every Home
visit; read a cached/stored result the way `lib/achievements.js` already reads earned rows rather
than re-scoring the whole journal. Badges live in `components/AchievementsCard.js` and
`app/profile/achievements.js` today, reached from Profile only.

Home is `app/(tabs)/home.js`, built around a `JourneyCard` (the passport hero, lines ~441 to 500)
with a milestone link to `/profile/achievements`. Add the three most recent badges plus a level
chip into that hero (next to or below the milestone link), and add a new "Your taste" section
below the hero with a free teaser (top few notes, the rest held back, a line explaining what Pro
adds) and the full report content for Pro users.

### E. Journal month strip (WF13, direction J2)

Mockup: `docs/mockups/journal-and-pour-detail-directions.html`, **J2**, the month strip, without
the Log button that direction shows mid-strip (Cork's existing floating Log pill stays where it
is).

Cork's journal is the "Wines" tab, `app/(tabs)/wines.js` (a `FlatList` of tastings, filters via
`lib/winesBrowse.js`, uses the shared `LogFab`). J2 groups rows by month and gives each month a
header strip in the same gradient/hero look as Home's hero card, showing how many tastings, the
average score, the most-used note, and how many producers that month (Cork's equivalent of
distilleries). Group `wines.js`'s flat list by month and add that header; do not add a Log button
inside the strip.

### F. Tasting detail: gradient hero (WF13, direction P2)

Mockup: same file, **P2**, the gradient hero.

Cork's tasting detail is `app/wine/[id].js`. Right now it opens on a plain `ScreenHeader`, the
wine name, a small rating card, and a photo row (see lines ~221 to 267); it is the bland screen
Nick was comparing unfavorably to the richer bottle/cellar detail. `app/cellar/[id].js` is Cork's
version of the richer screen (worth reading for the "what good looks like" comparison, the same
way Cask compared its pour detail against its Bunker bottle detail). P2 puts a gradient panel at
the top (glass glyph, name, a large score, the tasting's flavor notes as chips on the panel) with
four round action buttons below it (log again, edit, share, ask the sommelier). Cork already has
an edit-log link (`handleEditLog`) to reuse for the edit action.

### G. Streaming check (WF10)

Cork has its own Supabase project and its own `chat` edge function, separate from the platform's.
**Checked directly: Cork has the same bug waiting to happen.** `lib/chatStream.js` sets
`Accept`, `Authorization`, `apikey`, and `Content-Type` headers on its streaming XHR request
(around line 68 to 71) but never sets `Accept-Encoding`, so iOS will offer gzip by default. The
edge function, `supabase/functions/chat/index.ts`, sets `Content-Type: application/x-ndjson` and
`Cache-Control: no-cache, no-transform` on its streaming response (lines ~483 to 489) but no
`X-Accel-Buffering` header. Full diagnosis and the reasoning for both changes:
`docs/research/wf10-streaming-diagnosis.md` in app-platform.

Fix, mirroring the platform's card:
1. `lib/chatStream.js`: add `xhr.setRequestHeader('Accept-Encoding', 'identity');` next to the
   other headers, with a short comment on why (the hosted Supabase gateway gzips whatever the
   caller allows, and a gzip stage can hold a stream until the end; iOS offers gzip by default).
2. `supabase/functions/chat/index.ts`: add `"X-Accel-Buffering": "no"` next to `Cache-Control` in
   the streaming response headers, with a comment that it stops nginx-style gateways from
   buffering.
3. Confirm with an authenticated curl against Cork's hosted function, the same way the platform's
   diagnosis doc did: once with `--compressed` and once without, and check whether lines arrive
   spread over time or all at once.

Do not deploy the edge function change from this card; treat the deploy as its own explicit step,
the same way the platform's card does.

### H. Add bottle on the cellar tab (WF8)

**Already done in Cork, nothing to build.** `app/(tabs)/cellar.js` already has its own floating
"Add bottle" button (around line 306 to 312, `accessibilityLabel="Add bottle"`, routes to
`/cellar/add`), separate from the shared `LogFab` "Log" pill used on Home and the Wines tab. If a
session picks this up, just confirm it still reads clearly next to whatever the log form changes
above end up looking like, and otherwise leave it alone.

### I. Agave bottle glyph (does not apply)

`docs/mockups/agave-bottle-glyph-directions.html` is about telling tequila and mezcal bottle art
apart in Agave & Note. Cork has no equivalent problem (one bottle glyph, one drink family) and
this item does not translate. Skip it.

### J. Spelling

Write "color", not "colour", and other American spellings throughout, in code, comments and app
copy. Cork's existing copy already does this; keep it that way in anything new.

## 3. Links

Mockups (all on `main` in `nhorto/app-platform`):
- https://github.com/nhorto/app-platform/blob/main/docs/mockups/log-form-directions.html
- https://github.com/nhorto/app-platform/blob/main/docs/mockups/guide-new-chat-directions.html
- https://github.com/nhorto/app-platform/blob/main/docs/mockups/home-palate-and-badges-directions.html
- https://github.com/nhorto/app-platform/blob/main/docs/mockups/journal-and-pour-detail-directions.html
- https://github.com/nhorto/app-platform/blob/main/docs/mockups/agave-bottle-glyph-directions.html
  (for reference only, see item I)

Cards and background:
- https://github.com/nhorto/app-platform/blob/main/docs/factory/33-walkthrough-feedback-2026-09-27.md
- https://github.com/nhorto/app-platform/blob/main/docs/research/wf10-streaming-diagnosis.md

The platform's own pull requests show the working code for the whiskey/tequila side of several
of these items (read for the shape of a change, then re-derive it for Cork's actual files rather
than porting code directly, since Cork's components are not the same as the platform's shared
`packages/ui` components): PRs #514, #515, #516, #519, #520, #524 in `nhorto/app-platform`.

## 4. Suggested order, card split, and what to leave alone

Cork is in App Store Review for its 1.0 release right now. **Nothing from this document should
go into a build submitted for review, or a build heading to existing TestFlight testers, without
Nick saying so first.** Treat every card below as work for a separate branch/PR, reviewed and
merged only when Nick is ready to include it in a release.

One card, one PR each, in this order:

1. **Streaming fix (item G).** Small, isolated, two files, no UI risk, worth doing first and
   separately from everything else. Do not deploy the edge function from the card.
2. **Photos become Pro (item B).** Copy plus a gate; touches `choose-plan.js`, `paywall.js`,
   `WineEntryForm.js`, `log-session.js`. No design decisions left to make; Nick already decided
   this one.
3. **Log form: required marker and save bar (item A, first half).** The `Optional from here`
   rule and the save bar wording, without yet touching the section split. Smaller and lower risk
   than the full reorganization.
4. **Log form: four collapsible sections (item A, second half).** Needs the "color and glass"
   design question answered first (flag it to Nick rather than guessing).
5. **Home: badges and taste teaser (item D).** Needs a decision on how the teaser reads without
   re-calling the model on every visit.
6. **Journal month strip (item E).**
7. **Tasting detail gradient hero (item F).** Worth reading `app/cellar/[id].js` first for the
   richer pattern already in the repo.
8. **Guide: blank chat, New chat, chip behavior, bubble restyle (item C).** The biggest and most
   design-dependent item; Cork's guide already differs from the platform's starting point more
   than the others do, so expect this one to need its own confirmation with Nick before or during
   the build, not just at the mockup stage.

Leave alone: item H (already done), item I (does not apply), anything in the catalog, flavor-chip
research, or Agave-specific work from the platform's feedback file, none of which concerns Cork.
Do not touch App Store Review-facing copy or flows outside what a specific card above names.
