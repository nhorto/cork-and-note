# Region reference data — the curated list behind the autocomplete

**Repo:** `nhorto/cork-and-note` · **Issue:** #88 · **Companion to:** [`region-model.md`](./region-model.md)
**Status:** Shipped. **Date:** 2026-09-09

`region-model.md` is the decision doc: why region stays free text, what the exact-string
model costs, and what Stage 2 would look like if it were ever needed (§5.2). §11 then
found that the launch region is the one where it hurts most — Virginia producers print
the state on a blend and the AVA on the estate wine, so one cellar bought within an
hour's drive produces two unrelated filter chips.

This is the record of Stage 2 arriving, scoped to what §11.3 called the only genuinely
small option: **seed the suggestions, change nothing else.**

## What exists now

- `lib/wineRegions.js` — the curated list. Each region names its parent, so an AVA
  resolves up through its state to its country.
- `lib/cellarRegion.js` — suggestions are the user's own regions unioned with the
  reference list, theirs first; write-time canonicalisation re-spells toward whatever
  is on offer.
- The Region field on the cellar form shows the parent chain under each suggestion,
  which is what tells you the Shenandoah Valley you are picking is the one in Virginia
  and not the one in the Sierra Foothills.

No schema change, no migration, no new column. `region` is still free text and a region
the list has never heard of is still stored exactly as typed — §8's migration hazard
never comes up because nothing migrated.

## Rules for the list

**Provenance.** It is written by hand from general knowledge of wine geography.
Appellation names and the country each sits in are facts; somebody's assembled database
is not. **Do not bulk-import one.** Add entries individually, when a real bottle needs
one.

**Curation bar.** "Would someone write this on a cellar card?" Virginia is covered in
full because it is the launch region. Everywhere else gets the regions people actually
log, not every appellation that exists. The list decays if it tries to be complete, and
a half-maintained ontology is worse than clean free text.

**Adding a region.** Append `[name, parent, ...aliases]`. The parent must already be in
the list; the tests fail if it isn't. Aliases are rarely needed — matching already
ignores case, accents and punctuation, already drops an appellation tier
("Barolo DOCG" → Barolo) and already reads the head of "Napa Valley, California".
Two-letter state codes are deliberately not aliases: "WA" is both Washington and
Western Australia. `VA` is the one exception.

**It only ever suggests.** Nothing is rewritten into a region that wasn't already being
offered, so canonicalisation can collapse a duplicate but can never relabel a wine.
Virginia and Monticello are genuinely different appellations and stay that way.

## Deliberately not done

- **Facets and group-by still key on the exact string** (`lib/cellarBrowse.js`). Now
  that a region knows its parent, "group by country" and a truthful "N regions" stat
  are possible — but they want the region-model §8 rules and a decision from the owner
  first, not a drive-by.
- **Region is still cellar-only.** Tasted wines have no region column (§7).
- **Nothing derives a region from a winery's location** (§6 rejected it, and still does).
- **No shared winery directory.** `data/wineries_with_coordinates_and_id.json` was
  deleted rather than revived: it had no AVA data, site-relative `website` paths, and
  one winery geocoded into Austria. Reviving a catalog is a decision about the per-user
  RLS model, and it would not start from that file.
