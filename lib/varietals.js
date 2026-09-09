// lib/varietals.js — canonical varietal list + grape→type inference (#86, #87, #134).
//
// SINGLE SOURCE OF TRUTH for every varietal picker/autocomplete in the app: the
// cellar add/edit form (components/CellarBottleForm.js) AND the tasting log's
// autocomplete (components/AutocompleteVarietal.js) both import from here, so the
// list can never drift between the two flows again.
//
// Grouped by colour so we can both offer the list AND infer a sensible wine TYPE
// (Red / White / …) from a chosen varietal. Named blends are offered in the
// picker but intentionally do NOT infer a type (a "Bordeaux Blend" can be red or
// white, etc.) — the user picks the type. Multi-grape blends get richer handling
// in #135.

const REDS = [
  'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah/Shiraz', 'Malbec',
  'Cabernet Franc', 'Sangiovese', 'Tempranillo', 'Grenache/Garnacha', 'Petit Verdot',
  'Zinfandel', 'Primitivo', 'Barbera', 'Nebbiolo', 'Petite Sirah', 'Mourvèdre',
  'Carménère', 'Montepulciano', 'Dolcetto', 'Aglianico', "Nero d'Avola", 'Tannat',
  'Touriga Nacional', 'Carignan', 'Cinsault', 'Gamay', 'Pinotage', 'Negroamaro',
  'Sagrantino', 'Corvina', 'Lagrein', 'Mencía', 'Bonarda', 'Blaufränkisch',
  'Zweigelt', 'Saperavi', 'Xinomavro', 'Refosco', 'Teroldego', 'Graciano',
  'Castelão', 'Concord', 'Chambourcin', 'Norton', 'Lemberger', 'Counoise',
  // Regional varieties and North American hybrids commonly found at tastings.
  'Alicante Bouschet', 'Baga', 'Touriga Franca', 'Trincadeira', 'Tinto Cão',
  'Sousão', 'Vinhão', 'Tinta Barroca', 'Tinta Amarela', 'Alfrocheiro', 'Ramisco',
  'Nerello Mascalese', 'Nerello Cappuccio', 'Frappato', 'Corvinone', 'Rondinella',
  'Schiava', 'Schioppettino', 'Marzemino', 'Piedirosso', 'Gaglioppo', 'Susumaniello',
  'Brachetto', 'Ruchè', 'Freisa', 'Grignolino', 'Pelaverga', 'Uva di Troia',
  'Tintilia', 'Colorino', 'Perricone', 'Ciliegiolo', 'Vespolina',
  'Dornfelder', 'Portugieser', 'Trollinger', 'St. Laurent', 'Domina', 'Regent',
  'Poulsard', 'Trousseau', 'Mondeuse', 'Négrette', 'Fer Servadou', 'Pineau d’Aunis',
  'Sciaccarello', 'Marselan', 'Caladoc', 'Carminoir', 'Gamaret', 'Garanoir',
  'Bobal', 'Mazuelo', 'Listán Negro', 'Maturana Tinta', 'Prieto Picudo', 'Sumoll',
  'Agiorgitiko', 'Mavrodaphne', 'Limniona', 'Mandilaria', 'Kotsifali', 'Mavrotragano',
  'Plavac Mali', 'Babić', 'Vranac', 'Kadarka', 'Fetească Neagră', 'Areni',
  'Öküzgözü', 'Boğazkere',
  'Marquette', 'Frontenac', 'Baco Noir', 'De Chaunac', 'Léon Millot',
  'Maréchal Foch', 'St. Croix', 'Noiret', 'Corot Noir', 'Crimson Pearl',
  'Petite Pearl', 'Isabella', 'Black Spanish', 'Ruby Cabernet',
];
const WHITES = [
  'Chardonnay', 'Sauvignon Blanc', 'Pinot Grigio', 'Pinot Gris', 'Riesling',
  'Moscato', 'Muscat', 'Gewürztraminer', 'Viognier', 'Albariño', 'Chenin Blanc',
  'Sémillon', 'Marsanne', 'Roussanne', 'Vermentino', 'Grüner Veltliner', 'Muscadet',
  'Trebbiano', 'Garganega', 'Verdejo', 'Verdicchio', 'Fiano', 'Falanghina', 'Greco',
  'Cortese', 'Pinot Blanc', 'Torrontés', 'Assyrtiko', 'Furmint', 'Godello', 'Glera',
  'Macabeo', 'Colombard', 'Sylvaner', 'Müller-Thurgau', 'Picpoul', 'Arneis',
  'Friulano', 'Malvasia', 'Pecorino', 'Aligoté', 'Chasselas', 'Verdelho',
  'Vidal Blanc', 'Seyval Blanc', 'Palomino',
  'Petit Manseng', 'Gros Manseng', 'Traminette', 'Chardonel', 'Rkatsiteli',
  'La Crescent', 'Frontenac Blanc', 'Frontenac Gris', 'Itasca', 'Clarion',
  'Brianna', 'Cayuga White', 'Vignoles', 'La Crosse', 'Edelweiss', 'Niagara',
  'Blanc du Bois', 'Scuppernong',
  'Grenache Blanc', 'Grenache Gris', 'Clairette', 'Bourboulenc', 'Ugni Blanc',
  'Melon de Bourgogne', 'Savagnin', 'Jacquère', 'Altesse', 'Chasan', 'Mauzac',
  'Rolle', 'Romorantin', 'Muscat Blanc à Petits Grains', 'Muscat of Alexandria',
  'Orange Muscat', 'Muscat Ottonel', 'Muscat Giallo',
  'Grillo', 'Inzolia', 'Catarratto', 'Carricante', 'Grechetto', 'Ribolla Gialla',
  'Timorasso', 'Erbaluce', 'Nosiola', 'Picolit', 'Verduzzo Friulano', 'Biancolella',
  'Coda di Volpe', 'Bianco d’Alessano', 'Malvasia Istriana',
  'Arinto', 'Encruzado', 'Fernão Pires', 'Antão Vaz', 'Bical', 'Loureiro',
  'Avesso', 'Azal', 'Rabigato', 'Viosinho', 'Trajadura', 'Síria', 'Malvasia Fina',
  'Airén', 'Xarel·lo', 'Parellada', 'Garnacha Blanca', 'Albillo Real',
  'Albillo Mayor', 'Hondarrabi Zuri', 'Listán Blanco', 'Treixadura', 'Loureira',
  'Kerner', 'Bacchus', 'Scheurebe', 'Silvaner', 'Gutedel', 'Elbling',
  'Ortega', 'Huxelrebe', 'Solaris', 'Johanniter', 'Welschriesling', 'Neuburger',
  'Rotgipfler', 'Zierfandler', 'Roter Veltliner', 'Hárslevelű', 'Juhfark',
  'Irsai Olivér', 'Fetească Albă', 'Fetească Regală', 'Moschofilero', 'Malagousia',
  'Roditis', 'Savatiano', 'Robola', 'Vilana', 'Vidiano', 'Dafni',
  'Mtsvane', 'Kisi', 'Khikhvi', 'Tsolikouri', 'Chinuri', 'Voskehat',
  'Pošip', 'Žilavka', 'Graševina', 'Malvazija Istarska', 'Smederevka',
  'Emir', 'Narince', 'Koshu', 'Trousseau Gris', 'Sauvignon Gris', 'Delaware', 'Catawba',
];
const SPARKLING = [
  'Champagne', 'Prosecco', 'Cava', 'Crémant', 'Franciacorta', 'Lambrusco',
  'Sekt', 'Asti', 'Pét-Nat', 'Blanc de Blancs', 'Blanc de Noirs', 'Sparkling Rosé',
];
const DESSERT = [
  'Port', 'Sherry', 'Madeira', 'Sauternes', 'Tokaji', 'Ice Wine', 'Vin Santo',
  'Banyuls', 'Moscatel', 'Pedro Ximénez', 'Marsala', 'Late Harvest',
];
// Named blends — offered in the picker, no type inference (see header note).
const BLENDS = [
  'Red Blend', 'White Blend', 'Rosé Blend', 'Bordeaux Blend', 'Rhône Blend',
  'GSM', 'Meritage', 'Field Blend',
];

// Display order for the picker: reds, whites, sparkling, dessert/fortified, blends.
export const WINE_VARIETALS = [
  ...REDS, ...WHITES, ...SPARKLING, ...DESSERT, ...BLENDS,
];

// Keep existing labels stable; aliases help find the name printed on a bottle.
// Reference sources and curation rules: docs/research/varietals.md.
const ALIASES = {
  'Syrah/Shiraz': ['Syrah', 'Shiraz'],
  'Grenache/Garnacha': ['Grenache', 'Garnacha', 'Cannonau'],
  'Mourvèdre': ['Monastrell', 'Mataro'],
  'Petite Sirah': ['Durif'],
  'Albariño': ['Alvarinho'],
  'Tempranillo': ['Tinta Roriz', 'Aragonez', 'Tinto Fino', 'Tinta del País'],
  'Chenin Blanc': ['Steen'],
  'Pinot Noir': ['Spätburgunder', 'Blauburgunder'],
  'Pinot Gris': ['Grauburgunder', 'Ruländer'],
  'Pinot Blanc': ['Weissburgunder', 'Weißburgunder', 'Pinot Bianco'],
  'Macabeo': ['Viura', 'Macabeu'],
  'Carignan': ['Cariñena'],
  'Cinsault': ['Cinsaut'],
  'Norton': ['Cynthiana'],
  'Vignoles': ['Ravat 51'],
  'Vidal Blanc': ['Vidal'],
  'Fernão Pires': ['Maria Gomes'],
  'Godello': ['Gouveio'],
  'Friulano': ['Tocai Friulano'],
  'Savagnin': ['Savagnin Blanc'],
  'Pét-Nat': ['Pet Nat', 'Petnat', 'Pétillant Naturel'],
};

function varietalKey(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
}

const SEARCH_ENTRIES = WINE_VARIETALS.map((name) => ({
  name,
  keys: [name, ...(ALIASES[name] || [])].map(varietalKey),
}));

// Exact matches first, then prefixes, then substrings. Return all matches so
// rarer grapes aren't hidden behind a fixed handful of popular suggestions.
export function searchVarietals(value) {
  const query = varietalKey(value);
  if (!query) return [];
  const exact = [];
  const prefixes = [];
  const contains = [];
  for (const { name, keys } of SEARCH_ENTRIES) {
    if (keys.some((key) => key === query)) exact.push(name);
    else if (keys.some((key) => key.startsWith(query))) prefixes.push(name);
    else if (keys.some((key) => key.includes(query))) contains.push(name);
  }
  return [...exact, ...prefixes, ...contains];
}

// grape (lowercased) -> wine type, built from the colour groups above so the
// list and the inference can never drift apart. Blends are deliberately omitted
// (ambiguous colour) and therefore infer no type.
const TYPE_BY_VARIETAL = (() => {
  const m = {};
  const add = (list, type) => list.forEach((v) => { m[v.toLowerCase()] = type; });
  add(REDS, 'Red');
  add(WHITES, 'White');
  add(SPARKLING, 'Sparkling');
  add(DESSERT, 'Dessert');
  return m;
})();

// --- Multi-varietal helpers (#135) -------------------------------------------
// Varietals are stored as a Postgres text[] (a blend can list several grapes),
// but legacy rows + AI suggestions arrive as a single string ("Merlot") or a
// comma-joined string ("Cabernet Sauvignon, Merlot"). These helpers accept ALL
// of those shapes so read sites never crash during/after the transition.

// Normalize any varietal value (array | string | null) → clean array of grapes.
export function parseVarietals(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map((v) => String(v).trim()).filter(Boolean);
}

// Render any varietal value → display/search string ("Cabernet Sauvignon, Merlot").
export function varietalText(value, sep = ', ') {
  return parseVarietals(value).join(sep);
}

// Infer a sensible wine type from a varietal, or null if we don't recognise it
// (includes blends, which are intentionally type-less here). Accepts a single
// grape or a list — infers from the first grape we recognise.
export function inferTypeFromVarietal(varietal) {
  for (const grape of parseVarietals(varietal)) {
    const canonical = matchVarietal(grape);
    const t = canonical ? TYPE_BY_VARIETAL[canonical.toLowerCase()] : null;
    if (t) return t;
  }
  return null;
}

// If `text` is (exactly) a known varietal, return its canonical spelling — used
// to autofill the varietal field when a wine NAME is just a grape (e.g. "Merlot").
// Exact match only, so partial names ("Barrel Oak Cabernet") don't over-fire.
export function matchVarietal(text) {
  if (!text) return null;
  const t = varietalKey(text);
  if (!t) return null;
  // A display name wins over an alias when both exist in the catalogue.
  return SEARCH_ENTRIES.find(({ keys }) => keys[0] === t)?.name
    || SEARCH_ENTRIES.find(({ keys }) => keys.includes(t))?.name
    || null;
}
