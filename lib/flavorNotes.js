// lib/flavorNotes.js — the flavor-note library behind FlavorTagSelector (#216).
//
// Moved out of the component so the list can be tested, and grown from the
// original ~140 notes to ~185: generic parents people actually say out loud
// (Cherry, Citrus, Tropical Fruit, Baking Spice, Minerality, Earthy…) plus
// common misses (Salted Caramel, Chamomile, Menthol, Gooseberry, …).
//
// POPULAR_FLAVORS is the default tab in the picker: the notes that show up on
// nearly every tasting sheet, across all categories. Every entry must also
// exist in FLAVOR_CATEGORIES — a test pins that so the two lists can't drift.

export const FLAVOR_CATEGORIES = {
  'Fruit': [
    'Cherry', 'Red Cherry', 'Black Cherry', 'Sour Cherry', 'Dried Cherry',
    'Strawberry', 'Raspberry', 'Blackberry', 'Blueberry', 'Boysenberry',
    'Cranberry', 'Red Currant', 'Blackcurrant (Cassis)', 'Plum', 'Black Plum',
    'Prune', 'Raisin', 'Fig', 'Date', 'Pomegranate', 'Apple', 'Green Apple',
    'Red Apple', 'Baked Apple', 'Pear', 'Quince', 'Stone Fruit', 'Peach',
    'White Peach', 'Apricot', 'Nectarine', 'Citrus', 'Lemon', 'Lime', 'Orange',
    'Orange Peel', 'Grapefruit', 'Tangerine', 'Tropical Fruit', 'Pineapple',
    'Mango', 'Passion Fruit', 'Lychee', 'Guava', 'Kiwi', 'Gooseberry', 'Banana',
    'Melon', 'Watermelon', 'Jam', 'Stewed Fruit', 'Candied Fruit', 'Bramble',
  ],
  'Floral & Herbal': [
    'Rose', 'Violet', 'Lavender', 'Honeysuckle', 'Jasmine', 'Elderflower',
    'Orange Blossom', 'Acacia', 'Chamomile', 'White Flowers', 'Potpourri',
    'Geranium', 'Thyme', 'Rosemary', 'Mint', 'Menthol', 'Eucalyptus', 'Sage',
    'Basil', 'Oregano', 'Fennel', 'Dill', 'Bay Leaf', 'Lemongrass',
    'Green Bell Pepper', 'Jalapeño', 'Tomato Leaf', 'Fresh Cut Grass', 'Hay',
    'Dried Herbs', 'Black Tea', 'Green Tea',
  ],
  'Spice & Wood': [
    'Baking Spice', 'Cinnamon', 'Vanilla', 'Clove', 'Nutmeg', 'Allspice',
    'Anise', 'Star Anise', 'Black Pepper', 'White Pepper', 'Licorice', 'Ginger',
    'Cardamom', 'Cedar', 'Oak', 'Toasted Oak', 'Charred Oak', 'Coconut',
    'Sandalwood', 'Tobacco', 'Cigar Box', 'Leather', 'Pencil Shavings',
  ],
  'Earth & Mineral': [
    'Minerality', 'Earthy', 'Forest Floor', 'Mushroom', 'Truffle', 'Wet Stone',
    'Chalk', 'Slate', 'Graphite', 'Flint', 'Gravel', 'Clay', 'Petrol',
    'Wet Leaves', 'Barnyard', 'Game', 'Iron/Blood', 'Saline', 'Sea Spray',
    'Crushed Rock', 'Tar', 'Dust',
  ],
  'Other': [
    'Honey', 'Caramel', 'Salted Caramel', 'Butterscotch', 'Toffee', 'Maple',
    'Molasses', 'Brown Sugar', 'Chocolate', 'Dark Chocolate', 'Cocoa', 'Mocha',
    'Coffee', 'Espresso', 'Smoke', 'Toast', 'Butter', 'Cream', 'Crème Brûlée',
    'Bread', 'Yeast', 'Biscuit', 'Brioche', 'Sourdough', 'Graham Cracker',
    'Gingerbread', 'Almond', 'Hazelnut', 'Walnut', 'Marzipan', 'Nougat', 'Cola',
    'Beeswax', 'Rubber',
  ],
};

export const POPULAR_FLAVORS = [
  'Cherry', 'Strawberry', 'Raspberry', 'Blackberry', 'Blueberry', 'Plum',
  'Blackcurrant (Cassis)', 'Cranberry', 'Apple', 'Pear', 'Peach', 'Apricot',
  'Citrus', 'Lemon', 'Grapefruit', 'Tropical Fruit', 'Melon', 'Rose', 'Vanilla',
  'Oak', 'Cedar', 'Baking Spice', 'Black Pepper', 'Chocolate', 'Coffee',
  'Tobacco', 'Leather', 'Butter', 'Honey', 'Smoke', 'Earthy', 'Minerality',
];

// tag → its category, for the little hint shown on search-result pills.
const CATEGORY_OF = (() => {
  const m = {};
  Object.entries(FLAVOR_CATEGORIES).forEach(([cat, tags]) => {
    tags.forEach((t) => { m[t] = cat; });
  });
  return m;
})();

export function flavorCategoryOf(tag) {
  return CATEGORY_OF[tag] || null;
}

// Search the whole library → ONE flat, ranked list (exact match first, then
// prefix matches, then substring matches; alphabetical within each band).
// This is the fix for "type st, then open four collapsed categories" — results
// render directly as tappable pills, never grouped behind headers.
export function searchFlavorNotes(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const rank = (t) => {
    const l = t.toLowerCase();
    return l === q ? 0 : l.startsWith(q) ? 1 : 2;
  };
  return Object.values(FLAVOR_CATEGORIES)
    .flat()
    .filter((t) => t.toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
