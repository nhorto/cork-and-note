// lib/wineRegions.js — curated wine-region reference data (#88 Stage 2, scoped)
//
// WHY THIS EXISTS. Until now the app had no reference geography at all:
// knownRegions() (lib/cellarRegion.js) built its suggestions purely from the
// signed-in user's own past bottles, so a new user got no suggestions and the
// normalisation added in #154 had nothing authoritative to normalise toward.
// docs/research/region-model.md §11 records what that costs in Virginia, the
// launch region, where the same producer prints the state ("Virginia") on a
// blend and the AVA ("Monticello") on the estate wine.
//
// WHAT IT IS. A hand-written list of the regions people actually write on a
// cellar card, each pointing at its parent, so an AVA resolves up to its state
// and its country. It is deliberately NOT exhaustive — appellations number in
// the thousands, and free text stays fully valid everywhere. Priorities, in
// order: every Virginia AVA, the major US regions, then the international
// regions that show up on a normal shelf.
//
// PROVENANCE. Written from general knowledge of wine geography — appellation
// names and the country/state each sits in are facts, not anyone's database.
// Nothing here was scraped or bulk-copied, and it must stay that way: add
// entries by hand, one at a time, when a real bottle needs one.
//
// SHAPE. Tuples of [name, parent, ...aliases] so the list stays readable and
// diffable at a few hundred rows. `parent` is another entry's name, or null for
// a country. Aliases only exist where matching genuinely needs them — the
// lookup already ignores case, accents and punctuation, and already strips
// appellation suffixes ("Barolo DOCG" finds Barolo), so most regions need none.

// prettier-ignore
const REGION_ROWS = [
  // ─── United States ────────────────────────────────────────────────────────
  ['United States', null, 'USA', 'US', 'America'],

  // Virginia — the launch region, so its AVAs are covered in full (all ten),
  // plus the statewide appellation that multi-AVA blends carry.
  // "VA" is the one two-letter state code we accept: it is unambiguous here and
  // Virginia is the launch region. The others are not — "WA" is both Washington
  // and Western Australia — and "Napa Valley, CA" already matches on its head.
  ['Virginia', 'United States', 'VA'],
  ['Monticello', 'Virginia'],
  ['Shenandoah Valley', 'Virginia', 'Shenandoah Valley (Virginia)'],
  ['Northern Neck George Washington Birthplace', 'Virginia', 'Northern Neck'],
  ["Virginia's Eastern Shore", 'Virginia', 'Eastern Shore of Virginia'],
  ['Virginia Peninsula', 'Virginia'],
  ['Middleburg Virginia', 'Virginia', 'Middleburg'],
  ['North Fork of Roanoke', 'Virginia'],
  ['Rocky Knob', 'Virginia'],
  ['Appalachian High Country', 'Virginia'],

  // California
  ['California', 'United States'],
  ['North Coast', 'California'],
  ['Napa Valley', 'North Coast', 'Napa'],
  ['Oakville', 'Napa Valley'],
  ['Rutherford', 'Napa Valley'],
  ['Stags Leap District', 'Napa Valley'],
  ['Howell Mountain', 'Napa Valley'],
  ['Spring Mountain District', 'Napa Valley'],
  ['Mount Veeder', 'Napa Valley'],
  ['Diamond Mountain District', 'Napa Valley'],
  ['Yountville', 'Napa Valley'],
  ['Oak Knoll District of Napa Valley', 'Napa Valley', 'Oak Knoll District'],
  ['St. Helena', 'Napa Valley'],
  ['Calistoga', 'Napa Valley'],
  ['Atlas Peak', 'Napa Valley'],
  ['Coombsville', 'Napa Valley'],
  ['Chiles Valley', 'Napa Valley'],
  ['Los Carneros', 'Napa Valley', 'Carneros'],
  ['Sonoma County', 'North Coast', 'Sonoma'],
  ['Russian River Valley', 'Sonoma County'],
  ['Alexander Valley', 'Sonoma County'],
  ['Dry Creek Valley', 'Sonoma County'],
  ['Sonoma Coast', 'Sonoma County'],
  ['Sonoma Valley', 'Sonoma County'],
  ['Knights Valley', 'Sonoma County'],
  ['Chalk Hill', 'Sonoma County'],
  ['Bennett Valley', 'Sonoma County'],
  ['Petaluma Gap', 'Sonoma County'],
  ['Rockpile', 'Sonoma County'],
  ['Mendocino County', 'North Coast', 'Mendocino'],
  ['Anderson Valley', 'Mendocino County'],
  ['Lake County', 'North Coast'],
  ['Central Coast', 'California'],
  ['Paso Robles', 'Central Coast'],
  ['Santa Barbara County', 'Central Coast'],
  ['Sta. Rita Hills', 'Santa Barbara County', 'Santa Rita Hills'],
  ['Santa Ynez Valley', 'Santa Barbara County'],
  ['Santa Maria Valley', 'Santa Barbara County'],
  ['Ballard Canyon', 'Santa Barbara County'],
  ['Monterey', 'Central Coast', 'Monterey County'],
  ['Santa Lucia Highlands', 'Monterey'],
  ['Arroyo Seco', 'Monterey'],
  ['Carmel Valley', 'Monterey'],
  ['San Luis Obispo Coast', 'Central Coast', 'SLO Coast'],
  ['Edna Valley', 'San Luis Obispo Coast'],
  ['Arroyo Grande Valley', 'San Luis Obispo Coast'],
  ['Santa Cruz Mountains', 'Central Coast'],
  ['Livermore Valley', 'Central Coast'],
  ['Sierra Foothills', 'California'],
  ['California Shenandoah Valley', 'Sierra Foothills', 'Shenandoah Valley (California)'],
  ['El Dorado', 'Sierra Foothills'],
  ['Lodi', 'California'],
  ['Clarksburg', 'California'],
  ['Temecula Valley', 'California'],

  // Oregon
  ['Oregon', 'United States'],
  ['Willamette Valley', 'Oregon'],
  ['Dundee Hills', 'Willamette Valley'],
  ['Ribbon Ridge', 'Willamette Valley'],
  ['Yamhill-Carlton', 'Willamette Valley'],
  ['Chehalem Mountains', 'Willamette Valley'],
  ['Eola-Amity Hills', 'Willamette Valley'],
  ['McMinnville', 'Willamette Valley'],
  ['Southern Oregon', 'Oregon'],
  ['Rogue Valley', 'Southern Oregon'],
  ['Applegate Valley', 'Southern Oregon'],
  ['Umpqua Valley', 'Southern Oregon'],
  ['Columbia Gorge', 'Oregon'],

  // Washington
  ['Washington', 'United States', 'Washington State'],
  ['Columbia Valley', 'Washington'],
  ['Yakima Valley', 'Columbia Valley'],
  ['Walla Walla Valley', 'Columbia Valley'],
  ['Red Mountain', 'Columbia Valley'],
  ['Horse Heaven Hills', 'Columbia Valley'],
  ['Wahluke Slope', 'Columbia Valley'],
  ['Rattlesnake Hills', 'Columbia Valley'],
  ['Ancient Lakes of Columbia Valley', 'Columbia Valley', 'Ancient Lakes'],
  ['Puget Sound', 'Washington'],

  // New York
  ['New York', 'United States', 'New York State'],
  ['Finger Lakes', 'New York'],
  ['Seneca Lake', 'Finger Lakes'],
  ['Cayuga Lake', 'Finger Lakes'],
  ['Long Island', 'New York'],
  ['North Fork of Long Island', 'Long Island'],
  ['Hudson River Region', 'New York'],
  ['Niagara Escarpment', 'New York'],

  // Rest of the US — the states a US collector plausibly logs, kept shallow.
  ['Texas', 'United States'],
  ['Texas Hill Country', 'Texas'],
  ['Texas High Plains', 'Texas'],
  ['Michigan', 'United States'],
  ['Old Mission Peninsula', 'Michigan'],
  ['Leelanau Peninsula', 'Michigan'],
  ['Idaho', 'United States'],
  ['Snake River Valley', 'Idaho'],
  ['Arizona', 'United States'],
  ['Willcox', 'Arizona'],
  ['Verde Valley', 'Arizona'],
  ['Colorado', 'United States'],
  ['Grand Valley', 'Colorado'],
  ['Missouri', 'United States'],
  ['Augusta', 'Missouri'],
  ['North Carolina', 'United States'],
  ['Yadkin Valley', 'North Carolina'],
  ['Maryland', 'United States'],
  ['Pennsylvania', 'United States'],
  ['New Jersey', 'United States'],
  ['Outer Coastal Plain', 'New Jersey'],
  ['West Virginia', 'United States'],
  ['New Mexico', 'United States'],

  // ─── Canada & Mexico ──────────────────────────────────────────────────────
  ['Canada', null],
  ['Ontario', 'Canada'],
  ['Niagara Peninsula', 'Ontario'],
  ['Prince Edward County', 'Ontario'],
  ['British Columbia', 'Canada'],
  ['Okanagan Valley', 'British Columbia'],
  ['Mexico', null],
  ['Valle de Guadalupe', 'Mexico'],

  // ─── France ───────────────────────────────────────────────────────────────
  ['France', null],
  ['Bordeaux', 'France'],
  ['Médoc', 'Bordeaux'],
  ['Haut-Médoc', 'Médoc'],
  ['Pauillac', 'Haut-Médoc'],
  ['Margaux', 'Haut-Médoc'],
  ['Saint-Julien', 'Haut-Médoc'],
  ['Saint-Estèphe', 'Haut-Médoc'],
  ['Graves', 'Bordeaux'],
  ['Pessac-Léognan', 'Graves'],
  ['Sauternes', 'Bordeaux'],
  ['Barsac', 'Sauternes'],
  ['Saint-Émilion', 'Bordeaux'],
  ['Pomerol', 'Bordeaux'],
  ['Fronsac', 'Bordeaux'],
  ['Entre-Deux-Mers', 'Bordeaux'],
  ['Burgundy', 'France', 'Bourgogne'],
  ['Chablis', 'Burgundy'],
  ['Côte de Nuits', 'Burgundy'],
  ['Gevrey-Chambertin', 'Côte de Nuits'],
  ['Chambolle-Musigny', 'Côte de Nuits'],
  ['Morey-Saint-Denis', 'Côte de Nuits'],
  ['Vosne-Romanée', 'Côte de Nuits'],
  ['Nuits-Saint-Georges', 'Côte de Nuits'],
  ['Côte de Beaune', 'Burgundy'],
  ['Beaune', 'Côte de Beaune'],
  ['Pommard', 'Côte de Beaune'],
  ['Volnay', 'Côte de Beaune'],
  ['Meursault', 'Côte de Beaune'],
  ['Puligny-Montrachet', 'Côte de Beaune'],
  ['Chassagne-Montrachet', 'Côte de Beaune'],
  ['Côte Chalonnaise', 'Burgundy'],
  ['Mercurey', 'Côte Chalonnaise'],
  ['Mâconnais', 'Burgundy', 'Mâcon'],
  ['Pouilly-Fuissé', 'Mâconnais'],
  ['Beaujolais', 'France'],
  ['Morgon', 'Beaujolais'],
  ['Fleurie', 'Beaujolais'],
  ['Moulin-à-Vent', 'Beaujolais'],
  ['Champagne', 'France'],
  ['Rhône Valley', 'France', 'Rhône'],
  ['Northern Rhône', 'Rhône Valley'],
  ['Côte-Rôtie', 'Northern Rhône'],
  ['Condrieu', 'Northern Rhône'],
  ['Hermitage', 'Northern Rhône'],
  ['Crozes-Hermitage', 'Northern Rhône'],
  ['Saint-Joseph', 'Northern Rhône'],
  ['Cornas', 'Northern Rhône'],
  ['Southern Rhône', 'Rhône Valley'],
  ['Châteauneuf-du-Pape', 'Southern Rhône'],
  ['Gigondas', 'Southern Rhône'],
  ['Vacqueyras', 'Southern Rhône'],
  ['Tavel', 'Southern Rhône'],
  ['Côtes du Rhône', 'Southern Rhône'],
  ['Loire Valley', 'France', 'Loire'],
  ['Sancerre', 'Loire Valley'],
  ['Pouilly-Fumé', 'Loire Valley'],
  ['Vouvray', 'Loire Valley'],
  ['Chinon', 'Loire Valley'],
  ['Bourgueil', 'Loire Valley'],
  ['Saumur', 'Loire Valley'],
  ['Anjou', 'Loire Valley'],
  ['Savennières', 'Loire Valley'],
  ['Muscadet', 'Loire Valley', 'Muscadet Sèvre et Maine'],
  ['Alsace', 'France'],
  ['Provence', 'France'],
  ['Côtes de Provence', 'Provence'],
  ['Bandol', 'Provence'],
  ['Languedoc', 'France'],
  ['Corbières', 'Languedoc'],
  ['Minervois', 'Languedoc'],
  ['Picpoul de Pinet', 'Languedoc'],
  ['Roussillon', 'France'],
  ['Banyuls', 'Roussillon'],
  ['Southwest France', 'France', 'Sud-Ouest'],
  ['Cahors', 'Southwest France'],
  ['Madiran', 'Southwest France'],
  ['Jurançon', 'Southwest France'],
  ['Bergerac', 'Southwest France'],
  ['Jura', 'France'],
  ['Savoie', 'France'],
  ['Corsica', 'France', 'Corse'],

  // ─── Italy ────────────────────────────────────────────────────────────────
  ['Italy', null, 'Italia'],
  ['Tuscany', 'Italy', 'Toscana'],
  ['Chianti', 'Tuscany'],
  ['Chianti Classico', 'Tuscany'],
  ['Brunello di Montalcino', 'Tuscany', 'Montalcino'],
  ['Vino Nobile di Montepulciano', 'Tuscany'],
  ['Bolgheri', 'Tuscany'],
  ['Maremma Toscana', 'Tuscany', 'Maremma'],
  ['Piedmont', 'Italy', 'Piemonte'],
  ['Barolo', 'Piedmont'],
  ['Barbaresco', 'Piedmont'],
  ['Langhe', 'Piedmont'],
  ['Roero', 'Piedmont'],
  ['Gavi', 'Piedmont'],
  ['Asti', 'Piedmont'],
  ["Barbera d'Alba", 'Piedmont'],
  ["Barbera d'Asti", 'Piedmont'],
  ['Veneto', 'Italy'],
  ['Valpolicella', 'Veneto'],
  ['Amarone della Valpolicella', 'Valpolicella', 'Amarone'],
  ['Soave', 'Veneto'],
  ['Bardolino', 'Veneto'],
  ['Prosecco', 'Veneto'],
  ['Conegliano Valdobbiadene', 'Prosecco', 'Prosecco Superiore'],
  ['Friuli-Venezia Giulia', 'Italy', 'Friuli'],
  ['Collio', 'Friuli-Venezia Giulia'],
  ['Trentino-Alto Adige', 'Italy'],
  ['Alto Adige', 'Trentino-Alto Adige', 'Südtirol'],
  ['Trentino', 'Trentino-Alto Adige'],
  ['Lombardy', 'Italy', 'Lombardia'],
  ['Franciacorta', 'Lombardy'],
  ['Valtellina', 'Lombardy'],
  ['Emilia-Romagna', 'Italy'],
  ['Umbria', 'Italy'],
  ['Montefalco', 'Umbria'],
  ['Orvieto', 'Umbria'],
  ['Marche', 'Italy'],
  ['Verdicchio dei Castelli di Jesi', 'Marche'],
  ['Abruzzo', 'Italy'],
  ["Montepulciano d'Abruzzo", 'Abruzzo'],
  ['Lazio', 'Italy'],
  ['Campania', 'Italy'],
  ['Taurasi', 'Campania'],
  ['Fiano di Avellino', 'Campania'],
  ['Greco di Tufo', 'Campania'],
  ['Puglia', 'Italy', 'Apulia'],
  ['Primitivo di Manduria', 'Puglia'],
  ['Salice Salentino', 'Puglia'],
  ['Basilicata', 'Italy'],
  ['Aglianico del Vulture', 'Basilicata'],
  ['Sicily', 'Italy', 'Sicilia'],
  ['Etna', 'Sicily'],
  ['Sardinia', 'Italy', 'Sardegna'],

  // ─── Spain ────────────────────────────────────────────────────────────────
  ['Spain', null, 'España'],
  ['Rioja', 'Spain'],
  ['Rioja Alta', 'Rioja'],
  ['Rioja Alavesa', 'Rioja'],
  ['Castilla y León', 'Spain'],
  ['Ribera del Duero', 'Castilla y León'],
  ['Rueda', 'Castilla y León'],
  ['Toro', 'Castilla y León'],
  ['Bierzo', 'Castilla y León'],
  ['Catalonia', 'Spain', 'Cataluña', 'Catalunya'],
  ['Priorat', 'Catalonia'],
  ['Montsant', 'Catalonia'],
  ['Penedès', 'Catalonia'],
  ['Galicia', 'Spain'],
  ['Rías Baixas', 'Galicia'],
  ['Valdeorras', 'Galicia'],
  ['Ribeira Sacra', 'Galicia'],
  ['Andalusia', 'Spain', 'Andalucía'],
  ['Jerez', 'Andalusia', 'Sherry', 'Jerez-Xérès-Sherry'],
  ['Málaga', 'Andalusia'],
  ['Navarra', 'Spain'],
  ['Somontano', 'Spain'],
  ['Jumilla', 'Spain'],
  ['La Mancha', 'Spain'],

  // ─── Portugal ─────────────────────────────────────────────────────────────
  ['Portugal', null],
  ['Douro', 'Portugal', 'Douro Valley'],
  ['Dão', 'Portugal'],
  ['Bairrada', 'Portugal'],
  ['Vinho Verde', 'Portugal'],
  ['Alentejo', 'Portugal'],
  ['Lisboa', 'Portugal'],
  ['Setúbal', 'Portugal'],
  ['Madeira', 'Portugal'],

  // ─── Germany, Austria & central Europe ────────────────────────────────────
  ['Germany', null, 'Deutschland'],
  ['Mosel', 'Germany', 'Mosel-Saar-Ruwer'],
  ['Rheingau', 'Germany'],
  ['Rheinhessen', 'Germany'],
  ['Pfalz', 'Germany'],
  ['Nahe', 'Germany'],
  ['Baden', 'Germany'],
  ['Franken', 'Germany', 'Franconia'],
  ['Ahr', 'Germany'],
  ['Württemberg', 'Germany'],
  ['Mittelrhein', 'Germany'],
  ['Austria', null, 'Österreich'],
  ['Wachau', 'Austria'],
  ['Kremstal', 'Austria'],
  ['Kamptal', 'Austria'],
  ['Weinviertel', 'Austria'],
  ['Burgenland', 'Austria'],
  ['Neusiedlersee', 'Burgenland'],
  ['Leithaberg', 'Burgenland'],
  ['Steiermark', 'Austria', 'Styria'],
  ['Hungary', null],
  ['Tokaj', 'Hungary', 'Tokaji'],
  ['Eger', 'Hungary'],
  ['Villány', 'Hungary'],
  ['Switzerland', null],
  ['Valais', 'Switzerland'],
  ['Slovenia', null],
  ['Croatia', null],
  ['Greece', null],
  ['Santorini', 'Greece'],
  ['Nemea', 'Greece'],
  ['Naoussa', 'Greece'],
  ['England', null],
  ['Sussex', 'England'],
  ['Kent', 'England'],
  ['Georgia', null],
  ['Kakheti', 'Georgia'],
  ['Lebanon', null],
  ['Bekaa Valley', 'Lebanon'],
  ['Israel', null],
  ['Galilee', 'Israel'],
  ['Judean Hills', 'Israel'],

  // ─── South America ────────────────────────────────────────────────────────
  ['Argentina', null],
  ['Mendoza', 'Argentina'],
  ['Uco Valley', 'Mendoza', 'Valle de Uco'],
  ['Luján de Cuyo', 'Mendoza'],
  ['Maipú', 'Mendoza'],
  ['Salta', 'Argentina'],
  ['Cafayate', 'Salta'],
  ['Patagonia', 'Argentina'],
  ['Río Negro', 'Patagonia'],
  ['Neuquén', 'Patagonia'],
  ['San Juan', 'Argentina'],
  ['Chile', null],
  ['Central Valley', 'Chile'],
  ['Maipo Valley', 'Central Valley'],
  ['Rapel Valley', 'Central Valley'],
  ['Colchagua Valley', 'Rapel Valley'],
  ['Cachapoal Valley', 'Rapel Valley'],
  ['Curicó Valley', 'Central Valley'],
  ['Maule Valley', 'Central Valley'],
  ['Aconcagua', 'Chile'],
  ['Aconcagua Valley', 'Aconcagua'],
  ['Casablanca Valley', 'Aconcagua'],
  ['San Antonio Valley', 'Aconcagua'],
  ['Coquimbo', 'Chile'],
  ['Limarí Valley', 'Coquimbo'],
  ['Elqui Valley', 'Coquimbo'],
  ['Southern Chile', 'Chile'],
  ['Itata Valley', 'Southern Chile'],
  ['Bío Bío Valley', 'Southern Chile'],
  ['Uruguay', null],
  ['Canelones', 'Uruguay'],

  // ─── Australia & New Zealand ──────────────────────────────────────────────
  ['Australia', null],
  ['South Australia', 'Australia'],
  ['Barossa Valley', 'South Australia', 'Barossa'],
  ['Eden Valley', 'South Australia'],
  ['McLaren Vale', 'South Australia'],
  ['Clare Valley', 'South Australia'],
  ['Coonawarra', 'South Australia'],
  ['Adelaide Hills', 'South Australia'],
  ['Langhorne Creek', 'South Australia'],
  ['Victoria', 'Australia'],
  ['Yarra Valley', 'Victoria'],
  ['Mornington Peninsula', 'Victoria'],
  ['Heathcote', 'Victoria'],
  ['Rutherglen', 'Victoria'],
  ['Grampians', 'Victoria'],
  ['New South Wales', 'Australia'],
  ['Hunter Valley', 'New South Wales'],
  ['Orange', 'New South Wales'],
  ['Mudgee', 'New South Wales'],
  ['Canberra District', 'New South Wales'],
  ['Western Australia', 'Australia'],
  ['Margaret River', 'Western Australia'],
  ['Great Southern', 'Western Australia'],
  ['Tasmania', 'Australia'],
  ['New Zealand', null],
  ['Marlborough', 'New Zealand'],
  ['Central Otago', 'New Zealand'],
  ["Hawke's Bay", 'New Zealand'],
  ['Wairarapa', 'New Zealand'],
  ['Martinborough', 'Wairarapa'],
  ['Nelson', 'New Zealand'],
  ['Gisborne', 'New Zealand'],
  ['North Canterbury', 'New Zealand', 'Waipara'],

  // ─── South Africa ─────────────────────────────────────────────────────────
  ['South Africa', null],
  ['Western Cape', 'South Africa'],
  ['Stellenbosch', 'Western Cape'],
  ['Paarl', 'Western Cape'],
  ['Franschhoek', 'Western Cape'],
  ['Constantia', 'Western Cape'],
  ['Swartland', 'Western Cape'],
  ['Walker Bay', 'Western Cape'],
  ['Hemel-en-Aarde', 'Walker Bay'],
  ['Elgin', 'Western Cape'],
  ['Robertson', 'Western Cape'],
];

// Every region, in the curated order above. Order matters: it is the order the
// autocomplete offers matches in, and it only ever shows the first handful.
export const WINE_REGIONS = REGION_ROWS.map(([name, parent, ...aliases]) => ({
  name,
  parent: parent ?? null,
  aliases,
}));

// Lookup key: lower-cased, accent-folded, punctuation-flattened. So "Cote Rotie",
// "côte-rôtie" and "Côte Rôtie" are one key, and a user who cannot type an
// accent on a phone keyboard still lands on the canonical spelling.
const stripAccents =
  typeof String.prototype.normalize === 'function'
    ? (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : (s) => s;

export function regionKey(value) {
  return stripAccents(String(value ?? '').toLowerCase())
    .replace(/[’'`´]/g, '')
    .replace(/[-–—/.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Appellation tiers people transcribe straight off the label ("Barolo DOCG",
// "Monticello AVA"). Stripped only when matching — never stored, since the
// user's own words are theirs to keep.
const APPELLATION_SUFFIX = /\s+(ava|aoc|aop|ac|docg|doca|doc|dop|do|igt|igp|ig|gi|pdo|pgi|qba|vdp|dac)$/i;

export function stripAppellationSuffix(value) {
  const v = String(value ?? '').trim();
  const stripped = v.replace(APPELLATION_SUFFIX, '').trim();
  return stripped || v;
}

// name/alias key -> region. Built once; names win over aliases so an alias can
// never shadow a real region's own name.
const BY_KEY = (() => {
  const map = new Map();
  for (const region of WINE_REGIONS) {
    const key = regionKey(region.name);
    if (!map.has(key)) map.set(key, region);
  }
  for (const region of WINE_REGIONS) {
    for (const alias of region.aliases) {
      const key = regionKey(alias);
      if (!map.has(key)) map.set(key, region);
    }
  }
  return map;
})();

// The strings we will try, most literal first, when matching free text against
// the reference list: as typed, then without its appellation suffix, then the
// part before a comma ("Napa Valley, California") with the same two passes.
export function regionCandidates(value) {
  const v = String(value ?? '').trim();
  if (!v) return [];
  const head = v.includes(',') ? v.slice(0, v.indexOf(',')).trim() : '';
  const out = [v, stripAppellationSuffix(v), head, head && stripAppellationSuffix(head)];
  return [...new Set(out.filter(Boolean))];
}

// The reference region a free-text value refers to, or null when we do not know
// it — which stays the common case, and is fine. Never guesses: a value only
// matches by exact name, exact alias, or one of the candidate forms above.
export function findRegion(value) {
  for (const candidate of regionCandidates(value)) {
    const hit = BY_KEY.get(regionKey(candidate));
    if (hit) return hit;
  }
  return null;
}

// The chain from a region up to its country: Oakville -> Napa Valley ->
// North Coast -> California -> United States. Depth-capped so a bad parent
// edit can never hang the app; the dataset test asserts there is no cycle.
export function regionPath(value) {
  const start = findRegion(value);
  if (!start) return [];
  const path = [start];
  const seen = new Set([regionKey(start.name)]);
  let current = start;
  while (current.parent && path.length < 12) {
    const parent = BY_KEY.get(regionKey(current.parent));
    if (!parent || seen.has(regionKey(parent.name))) break;
    path.push(parent);
    seen.add(regionKey(parent.name));
    current = parent;
  }
  return path;
}

// The country a region sits in, or null if it is not in the reference list.
// Countries are the roots of the tree, so this is just the end of the path.
export function regionCountry(value) {
  const path = regionPath(value);
  return path.length ? path[path.length - 1].name : null;
}

// What the autocomplete shows under a suggestion: everything above the region
// itself, most specific first ("Napa Valley · California · United States"). The
// row clips to one line, so the least useful end truncates. Null for a country
// and for anything not in the reference list.
export function regionSubtitle(value) {
  const path = regionPath(value);
  if (path.length < 2) return null;
  return path.slice(1).map((r) => r.name).join(' · ');
}
