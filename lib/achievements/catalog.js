// lib/achievements/catalog.js — every badge in the Wine Journey, as data (#295).
//
// This file is the single source of truth for what can be earned, what it is
// worth, and how it reads on screen. It is deliberately data-only apart from
// three small lookups at the bottom: the evaluator (evaluate.js) walks these
// tables, so adding a badge is a catalog edit and nothing else.
//
// Two shapes of badge:
//   - tiered families: one badge that levels up Bronze, Silver, Gold, Platinum
//     as a single number grows (wineries visited, wines tasted, ...).
//   - one-offs: earned once when a condition is met, grouped onto shelves.
// Plus per-grape badges, which are tiered on their own smaller ladder
// (Fan, Lover, Devotee) so "Chardonnay Lover" means the same thing for every
// grape in the launch list.
//
// Points are only ever awarded BY a badge, never by a raw action, so the level
// ladder can never be farmed by logging the same wine twice. Earned rows keep
// their own points (see the migration), so a badge is never revoked and points
// never go down.

// The surfaces landed in #296, so the engine is live. Kept as a flag so the
// whole feature can be switched off in one edit if a threshold turns out to be
// wrong in the wild: refreshAchievements() becomes a no-op and no row is ever
// written. Badges already earned are never revoked either way.
export const ACHIEVEMENTS_ENABLED = true;

// ── Tiered families ─────────────────────────────────────────────────────────

export const TIERS = ['bronze', 'silver', 'gold', 'platinum'];
export const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };
export const TIER_POINTS = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

// `metric` names a key on the facts object (facts.js). `thresholds` lines up
// with TIERS: index 0 is Bronze, index 3 is Platinum.
export const FAMILIES = [
  { key: 'winery_explorer', name: 'Winery Explorer', icon: 'map-marker-path',  metric: 'distinctWineries',    thresholds: [1, 5, 15, 40],   unit: 'wineries',  rule: 'Distinct wineries with a logged visit.' },
  { key: 'wine_discoverer', name: 'Wine Discoverer', icon: 'glass-wine',       metric: 'distinctWines',       thresholds: [1, 10, 25, 100], unit: 'wines',     rule: 'Distinct wines tasted. Vintages count once.' },
  { key: 'grape_explorer',  name: 'Grape Explorer',  icon: 'fruit-grapes',     metric: 'distinctVarietals',   thresholds: [3, 8, 15, 30],   unit: 'varietals', rule: 'Distinct grapes tasted.' },
  { key: 'region_explorer', name: 'Region Explorer', icon: 'map-outline',      metric: 'distinctAvas',        thresholds: [1, 3, 6, 12],    unit: 'regions',   rule: 'Wine regions with a visited winery. US AVAs for now.' },
  { key: 'cellar_curator',  name: 'Cellar Curator',  icon: 'archive-outline',  metric: 'distinctCellarWines', thresholds: [1, 10, 25, 75],  unit: 'wines',     rule: 'Distinct wines ever added to your cellar.' },
  { key: 'journal_keeper',  name: 'Journal Keeper',  icon: 'notebook-outline', metric: 'tastings',            thresholds: [1, 10, 50, 200], unit: 'tastings',  rule: 'Tastings logged, anywhere.' },
];

// ── Per-grape badges ────────────────────────────────────────────────────────

export const GRAPE_TIERS = ['fan', 'lover', 'devotee'];
export const GRAPE_TIER_LABEL = { fan: 'Fan', lover: 'Lover', devotee: 'Devotee' };
export const GRAPE_TIER_POINTS = { fan: 10, lover: 25, devotee: 50 };
export const GRAPE_THRESHOLDS = [3, 10, 25];

// The launch list: twelve grapes anyone can name, plus six that a Virginia
// drinker meets in their first month. `key` is the canonical display name from
// lib/varietals.js. `merge` lists other canonical names that are the same grape
// under a different label, so a Shiraz drinker and a Syrah drinker earn the
// same badge.
export const GRAPES = [
  { key: 'Cabernet Sauvignon' },
  { key: 'Merlot' },
  { key: 'Pinot Noir' },
  { key: 'Syrah', merge: ['Shiraz', 'Syrah/Shiraz'] },
  { key: 'Zinfandel' },
  { key: 'Malbec' },
  { key: 'Sangiovese' },
  { key: 'Tempranillo' },
  { key: 'Chardonnay' },
  { key: 'Sauvignon Blanc' },
  { key: 'Riesling' },
  { key: 'Pinot Grigio', merge: ['Pinot Gris'] },
  { key: 'Cabernet Franc' },
  { key: 'Petit Verdot' },
  { key: 'Viognier' },
  { key: 'Petit Manseng' },
  { key: 'Chambourcin' },
  { key: 'Norton' },
];

// Hybrid and lesser-known grapes, for the "Off the Beaten Vine" one-off. These
// are the cold-hardy and native crosses that east-coast and midwest wineries
// actually pour, all present in lib/varietals.js.
export const HYBRIDS = [
  'Norton', 'Traminette', 'Vidal Blanc', 'Petit Manseng', 'Chambourcin',
  'Marquette', 'Frontenac', 'Frontenac Blanc', 'Frontenac Gris', 'La Crescent',
  'Itasca', 'Vignoles', 'Seyval Blanc', 'Chardonel', 'Cayuga White', 'Catawba',
  'Concord', 'Niagara',
];

// ── One-offs ────────────────────────────────────────────────────────────────
// `test(facts)` returns true when the badge is earned. Every fact it reads is
// defined in facts.js, and every one is monotonic in practice, so a badge that
// has been earned stays earned.

export const ONE_OFFS = [
  { key: 'curious_palate',  shelf: 'grapes',  name: 'Curious Palate',        icon: 'fruit-grapes-outline', points: 15, rule: '3 tastings of a grape outside the launch list.', test: (f) => f.maxNonLaunchVarietalCount >= 3 },
  { key: 'off_beaten_vine', shelf: 'grapes',  name: 'Off the Beaten Vine',   icon: 'leaf',                 points: 30, rule: '5 different hybrid or lesser known grapes.',     test: (f) => f.distinctHybrids >= 5 },

  { key: 'full_spectrum',   shelf: 'styles',  name: 'Full Spectrum',         icon: 'palette-outline',      points: 30, rule: 'A red, a white, a rosé, a sparkling and a dessert wine.', test: (f) => ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert'].every((t) => (f.typeCounts[t] || 0) > 0) },
  { key: 'bubbles',         shelf: 'styles',  name: 'Bubbles',               icon: 'glass-flute',          points: 15, rule: '5 sparkling wines.',                             test: (f) => (f.typeCounts.Sparkling || 0) >= 5 },
  { key: 'think_pink',      shelf: 'styles',  name: 'Think Pink',            icon: 'glass-wine',           points: 15, rule: '5 rosés.',                                       test: (f) => (f.typeCounts['Rosé'] || 0) >= 5 },
  { key: 'sweet_tooth',     shelf: 'styles',  name: 'Sweet Tooth',           icon: 'candy-outline',        points: 15, rule: '5 dessert wines.',                               test: (f) => (f.typeCounts.Dessert || 0) >= 5 },

  { key: 'regular',         shelf: 'places',  name: 'Regular',               icon: 'store-outline',        points: 30, rule: '5 visits to the same winery.',                   test: (f) => f.maxVisitsToOneWinery >= 5 },
  { key: 'day_tripper',     shelf: 'places',  name: 'Day Tripper',           icon: 'car-outline',          points: 15, rule: '3 wineries in one day.',                         test: (f) => f.maxWineriesInOneDay >= 3 },
  { key: 'home_turf',       shelf: 'places',  name: 'Home Turf',             icon: 'home-map-marker',      points: 30, rule: '10 wineries in one state.',                      test: (f) => f.maxWineriesInOneState >= 10 },
  { key: 'crossed_lines',   shelf: 'places',  name: 'Crossed State Lines',   icon: 'sign-direction',       points: 15, rule: 'Wineries in 2 states.',                          test: (f) => f.distinctStates >= 2 },
  { key: 'road_tripper',    shelf: 'places',  name: 'Road Tripper',          icon: 'road-variant',         points: 30, rule: 'Wineries in 5 states.',                          test: (f) => f.distinctStates >= 5 },

  { key: 'cork_popped',     shelf: 'cellar',  name: 'Cork Popped',           icon: 'bottle-wine',          points: 15, rule: 'First bottle opened from your cellar.',          test: (f) => f.bottlesOpened >= 1 },
  { key: 'patience',        shelf: 'cellar',  name: 'Patience',              icon: 'timer-sand',           points: 30, rule: 'Opened a bottle you held for a year or more.',   test: (f) => f.longestHoldDays >= 365 },
  { key: 'right_on_time',   shelf: 'cellar',  name: 'Right on Time',         icon: 'check-decagram',       points: 15, rule: 'Opened a bottle inside its drink window.',       test: (f) => f.openedInWindow >= 1 },
  { key: 'well_travelled',  shelf: 'cellar',  name: 'Well Travelled Cellar', icon: 'earth',                points: 30, rule: 'Cellar bottles from 5 regions.',                 test: (f) => f.distinctCellarRegions >= 5 },
  { key: 'globe_trotter',   shelf: 'cellar',  name: 'Globe Trotter',         icon: 'airplane',             points: 30, rule: 'Cellar bottles from 3 countries.',               test: (f) => f.distinctCellarCountries >= 3 },

  { key: 'critic',          shelf: 'journal', name: 'Critic',                icon: 'star-outline',         points: 15, rule: '25 rated tastings.',                             test: (f) => f.ratedTastings >= 25 },
  { key: 'wordsmith',       shelf: 'journal', name: 'Wordsmith',             icon: 'pencil-outline',       points: 15, rule: '25 tastings with notes.',                        test: (f) => f.tastingsWithNotes >= 25 },
  { key: 'shutterbug',      shelf: 'journal', name: 'Shutterbug',            icon: 'camera-outline',       points: 15, rule: '10 tastings with a photo.',                      test: (f) => f.tastingsWithPhotos >= 10 },
  { key: 'flavor_hunter',   shelf: 'journal', name: 'Flavor Hunter',         icon: 'nose',                 points: 30, rule: '25 different flavor notes used.',                test: (f) => f.distinctFlavorNotes >= 25 },
  { key: 'year_round',      shelf: 'journal', name: 'Year Round',            icon: 'calendar-month',       points: 50, rule: 'Tastings in all 12 months of the year.',         test: (f) => f.distinctMonths >= 12 },
];

export const SHELVES = [
  { key: 'grapes', name: 'Grapes' },
  { key: 'styles', name: 'Styles' },
  { key: 'places', name: 'Places' },
  { key: 'cellar', name: 'Cellar' },
  { key: 'journal', name: 'Journal' },
];

// ── Levels ──────────────────────────────────────────────────────────────────
// Named after bottle formats, smallest to largest. The gaps widen so the early
// levels come quickly and Nebuchadnezzar stays a real climb: the whole catalog
// is worth about 3,100 points, so level 9 is reachable but not routine.

export const LEVELS = [
  { level: 1, points: 0,    title: 'Split' },
  { level: 2, points: 50,   title: 'Half Bottle' },
  { level: 3, points: 150,  title: 'Bottle' },
  { level: 4, points: 300,  title: 'Magnum' },
  { level: 5, points: 500,  title: 'Jeroboam' },
  { level: 6, points: 800,  title: 'Methuselah' },
  { level: 7, points: 1200, title: 'Salmanazar' },
  { level: 8, points: 1700, title: 'Balthazar' },
  { level: 9, points: 2300, title: 'Nebuchadnezzar' },
];

/**
 * The level a points total sits at, plus the one above it.
 * @returns {{ level, title, points, next: { level, title, points } | null }}
 */
export function levelForPoints(points) {
  const total = Number.isFinite(Number(points)) ? Math.max(0, Number(points)) : 0;
  let current = LEVELS[0];
  for (const entry of LEVELS) {
    if (total >= entry.points) current = entry;
    else break;
  }
  const next = LEVELS.find((entry) => entry.points > total) || null;
  return { ...current, next };
}

// The badge_key stored for a per-grape badge. Namespaced so a grape can never
// collide with a family or one-off key.
export function grapeBadgeKey(grapeKey) {
  return `grape:${grapeKey}`;
}

const FAMILY_BY_KEY = new Map(FAMILIES.map((f) => [f.key, { ...f, kind: 'family' }]));
const ONE_OFF_BY_KEY = new Map(ONE_OFFS.map((o) => [o.key, { ...o, kind: 'oneOff' }]));
const GRAPE_BY_KEY = new Map(
  GRAPES.map((g) => [grapeBadgeKey(g.key), { ...g, kind: 'grape', name: g.key }])
);

/** The definition behind a stored badge_key, or null when the catalog changed. */
export function badgeByKey(key) {
  return FAMILY_BY_KEY.get(key) || GRAPE_BY_KEY.get(key) || ONE_OFF_BY_KEY.get(key) || null;
}

// Canonical grape name to the launch-list key it counts toward, for the merged
// synonyms (Shiraz to Syrah, Pinot Gris to Pinot Grigio). Lower-cased so the
// lookup survives a differently cased source.
export const GRAPE_MERGE = new Map();
for (const grape of GRAPES) {
  GRAPE_MERGE.set(grape.key.toLowerCase(), grape.key);
  for (const alt of grape.merge || []) GRAPE_MERGE.set(alt.toLowerCase(), grape.key);
}

export const LAUNCH_GRAPES = new Set(GRAPES.map((g) => g.key));
export const HYBRID_SET = new Set(HYBRIDS.map((h) => h.toLowerCase()));
