// lib/varietals.js — canonical varietal list + grape→type inference (#86, #87).
//
// Single source of truth for the cellar add/edit form's varietal PICKER and the
// "the wine name is just a grape" autofill. Grouped by colour so we can both
// offer the list AND infer a sensible wine TYPE (Red / White / …) from a chosen
// varietal. (components/AutocompleteVarietal.js keeps its own copy for the
// tasting flow; this module is the cellar-side source — safe to unify later.)

const REDS = [
  'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah/Shiraz', 'Malbec',
  'Cabernet Franc', 'Sangiovese', 'Tempranillo', 'Grenache', 'Petit Verdot',
  'Zinfandel', 'Barbera', 'Nebbiolo', 'Petite Sirah', 'Mourvedre',
];
const WHITES = [
  'Chardonnay', 'Sauvignon Blanc', 'Pinot Grigio', 'Pinot Gris', 'Riesling',
  'Moscato', 'Gewürztraminer', 'Viognier', 'Albariño', 'Chenin Blanc',
  'Sémillon', 'Marsanne', 'Roussanne', 'Vermentino', 'Grüner Veltliner', 'Muscadet',
];
const SPARKLING = ['Champagne', 'Prosecco', 'Cava'];
const DESSERT = ['Port', 'Sherry', 'Madeira'];

// Display order for the picker: reds, whites, sparkling, then dessert/fortified.
export const WINE_VARIETALS = [...REDS, ...WHITES, ...SPARKLING, ...DESSERT];

// grape (lowercased) -> wine type, built from the colour groups above so the
// list and the inference can never drift apart.
const TYPE_BY_VARIETAL = (() => {
  const m = {};
  const add = (list, type) => list.forEach((v) => { m[v.toLowerCase()] = type; });
  add(REDS, 'Red');
  add(WHITES, 'White');
  add(SPARKLING, 'Sparkling');
  add(DESSERT, 'Dessert');
  return m;
})();

// Infer a sensible wine type from a varietal, or null if we don't recognise it.
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
