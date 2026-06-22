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

// Infer a sensible wine type from a varietal, or null if we don't recognise it
// (includes blends, which are intentionally type-less here).
export function inferTypeFromVarietal(varietal) {
  if (!varietal) return null;
  return TYPE_BY_VARIETAL[String(varietal).trim().toLowerCase()] || null;
}

// If `text` is (exactly) a known varietal, return its canonical spelling — used
// to autofill the varietal field when a wine NAME is just a grape (e.g. "Merlot").
// Exact match only, so partial names ("Barrel Oak Cabernet") don't over-fire.
export function matchVarietal(text) {
  if (!text) return null;
  const t = String(text).trim().toLowerCase();
  if (!t) return null;
  return WINE_VARIETALS.find((v) => v.toLowerCase() === t) || null;
}
